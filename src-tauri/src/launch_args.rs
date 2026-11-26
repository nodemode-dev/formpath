use std::ffi::OsString;
use std::path::{Path, PathBuf};

pub fn program_end(argv: &[OsString], exe: &Path) -> usize {
    let exe = exe.to_string_lossy().to_lowercase();
    let mut program = argv.first().map(|arg| arg.to_string_lossy().to_lowercase()).unwrap_or_default();
    let mut end = 1;
    while end < argv.len() && program != exe {
        program = format!("{program} {}", argv[end].to_string_lossy().to_lowercase());
        if !exe.starts_with(&program) {
            break;
        }
        end += 1;
    }
    if program == exe { end } else { 1 }
}

pub fn paths(argv: Vec<OsString>, cwd: &Path, exe: &Path) -> Vec<PathBuf> {
    let end = program_end(&argv, exe);
    argv.into_iter()
        .skip(end)
        .filter(|arg| !arg.is_empty() && !arg.to_string_lossy().starts_with('-'))
        .map(|arg| cwd.join(arg))
        .collect()
}

pub fn own() -> Vec<PathBuf> {
    paths(std::env::args_os().collect(), &std::env::current_dir().unwrap_or_default(), &std::env::current_exe().unwrap_or_default())
}
