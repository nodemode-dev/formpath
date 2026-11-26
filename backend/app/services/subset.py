import io

from fontTools import subset
from fontTools.ttLib import TTFont

MAX_BYTES = 128 * 1024 * 1024
_LAYOUT = ["GSUB", "GPOS", "GDEF", "BASE", "JSTF", "MATH", "DSIG", "LTSH", "VDMX", "hdmx", "gasp", "kern", "PCLT"]


class SubsetError(Exception):
    pass


def _instance(font: TTFont, axes: dict[str, float]) -> None:
    if "fvar" not in font:
        return
    spot = {a.axisTag: a.defaultValue for a in font["fvar"].axes}
    for a in font["fvar"].axes:
        if a.axisTag in axes:
            spot[a.axisTag] = max(a.minValue, min(a.maxValue, float(axes[a.axisTag])))
    try:
        from fontTools.varLib import instancer
    except ImportError as exc:
        raise SubsetError("This font is variable and the engine cannot fix its axes. Export with Preserve text as live text off.") from exc
    try:
        instancer.instantiateVariableFont(font, spot, inplace=True, downgradeCFF2="CFF2" in font)
    except Exception as exc:
        raise SubsetError(f"This variable font could not be fixed at its axis values ({exc}). Export with Preserve text as live text off.") from exc


def build(data: bytes, gids: list[int], axes: dict[str, float]) -> tuple[bytes, str]:
    if len(data) > MAX_BYTES:
        raise SubsetError("That font file is larger than 128 MiB.")
    try:
        font = TTFont(io.BytesIO(data), lazy=True)
        count = len(font.getGlyphOrder())
    except Exception as exc:
        raise SubsetError("That file is not a font formpath can read.") from exc
    keep = sorted({g for g in gids if 0 <= g < count} | {0})
    opts = subset.Options()
    opts.retain_gids = True
    opts.notdef_outline = True
    opts.notdef_glyph = True
    opts.glyph_names = False
    opts.layout_features = []
    opts.hinting = True
    opts.name_IDs = [1, 2, 3, 4, 6]
    opts.name_languages = [0x409]
    opts.legacy_kern = False
    opts.drop_tables = sorted(set(opts.drop_tables) | set(_LAYOUT))
    try:
        sub = subset.Subsetter(opts)
        sub.populate(gids=keep)
        sub.subset(font)
    except Exception as exc:
        raise SubsetError(f"This font could not be subset ({exc}).") from exc
    _instance(font, axes)
    if "CFF2" in font:
        try:
            from fontTools.cffLib.CFF2ToCFF import convertCFF2ToCFF
            tmp = io.BytesIO()
            font.save(tmp)
            font = TTFont(io.BytesIO(tmp.getvalue()), recalcBBoxes=False)
            convertCFF2ToCFF(font)
        except Exception as exc:
            raise SubsetError(f"This font uses CFF2 outlines that could not be converted for embedding ({exc}). Export with Preserve text as live text off.") from exc
    font.flavor = None
    out = io.BytesIO()
    font.save(out)
    return out.getvalue(), "cff" if "CFF " in font else "truetype"
