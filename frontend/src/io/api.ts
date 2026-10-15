export interface Capabilities { name: string; version: string; desktop: boolean; dataDir: string; libraryDir: string; fonts: boolean }
export interface LibraryItem { name: string; modified: number; size: number }
export interface OpenedProject { session: string; name: string; manifest: Record<string, unknown>; images: Record<string, string>; version?: string }
export interface LibraryFolder { folder: string; default: string; custom: boolean; fixed: boolean; synced: Array<{ label: string; base: string; suggested: string }> }
export interface FilePart { name: string; blob: Blob }
export interface FontInfo { id: string; family: string; style: string; full: string; postscript: string; variable?: boolean }
export interface SpellHit { word: string; suggestions: string[] }
export interface SimilarFont { id: string; family: string; style: string; score: number }
export interface LlmStatus { configured: boolean; baseUrl: string; model: string; hasKey: boolean; store: 'system' | 'file'; vision?: boolean }
export interface BridgeItem { id: string; name: string; arguments: Record<string, unknown>; inapp?: boolean }
const BRIDGE_HEADER = 'X-Formpth-Bridge';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try { res = await fetch(`/api${path}`, init); } catch {
    throw new ApiError('The formpth engine is not reachable. Start it with ./formpth boot.', 0);
  }
  if (!res.ok) {
    let detail = res.statusText || `Request failed (${res.status})`;
    try { const j = (await res.json()) as { detail?: unknown }; if (typeof j.detail === 'string') detail = j.detail; } catch { detail = res.statusText || detail; }
    throw new ApiError(detail, res.status);
  }
  return res;
}

function form(fields: Record<string, string>, files: FilePart[] = [], key = 'files'): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  for (const part of files) f.append(key, part.blob, part.name);
  return f;
}
const json = async <T>(r: Response): Promise<T> => (await r.json()) as T;

export const api = {
  async capabilities(): Promise<Capabilities | null> { try { return await json<Capabilities>(await request('/capabilities')); } catch { return null; } },
  async library(): Promise<LibraryItem[]> { return json<LibraryItem[]>(await request('/projects')); },
  async save(name: string, manifest: object, files: FilePart[], base = ''): Promise<{ name: string; path: string; version?: string; conflict?: boolean; kept?: string }> {
    return json(await request('/projects/save', { method: 'POST', body: form({ name, manifest: JSON.stringify(manifest), base }, files) }));
  },
  async libraryFolder(): Promise<LibraryFolder | null> { try { return await json<LibraryFolder>(await request('/projects/folder')); } catch { return null; } },
  async setLibraryFolder(folder: string, move: boolean): Promise<LibraryFolder & { moved: number }> {
    return json(await request('/projects/folder', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder, move }) }));
  },
  async package(manifest: object, files: FilePart[], root = ''): Promise<Blob> { return (await request('/projects/package', { method: 'POST', body: form({ manifest: JSON.stringify(manifest), ...(root ? { root } : {}) }, files) })).blob(); },
  async openLibrary(name: string): Promise<OpenedProject> { return json(await request(`/projects/library/${encodeURIComponent(name)}`)); },
  async deleteLibrary(name: string): Promise<void> { await request(`/projects/library/${encodeURIComponent(name)}`, { method: 'DELETE' }); },
  async importProject(files: File[], paths: string[] = []): Promise<OpenedProject> {
    const f = new FormData();
    files.forEach((file, i) => { f.append('files', file, file.name); if (paths.length) f.append('paths', paths[i] ?? file.name); });
    return json(await request('/projects/import', { method: 'POST', body: f }));
  },
  async fetchAsset(url: string): Promise<Blob> { return (await request(url.replace(/^\/api/, ''))).blob(); },
  async exportFile(blob: Blob, name: string): Promise<string> { return (await json<{ path: string }>(await request('/io/export', { method: 'POST', body: form({ name }, [{ name, blob }], 'file') }))).path; },

  async actionSets(): Promise<{ folder: string; sets: Array<{ file: string; set: unknown }> }> { return json(await request('/actions/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })); },
  async saveActionSet(name: string, set: unknown): Promise<{ path: string }> { return json(await request('/actions/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, set }) })); },
  async deleteActionSet(name: string): Promise<void> { await request('/actions/delete', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }); },
  async listFolder(folder: string, kinds: string[], dirs = false): Promise<{ folder: string; parent?: string; dirs?: string[]; files: Array<{ name: string; path: string; size: number; mtime?: number }> }> { return json(await request('/files/list', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ folder, kinds, dirs }) })); },
  async readFile(path: string): Promise<Blob> { return (await request('/files/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })).blob(); },
  async readFileInfo(path: string): Promise<{ blob: Blob; name: string; path: string; size: number; mtime: number }> {
    const r = await request('/files/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) });
    const h = (k: string): string => decodeURIComponent(r.headers.get(k) ?? '');
    return { blob: await r.blob(), name: h('X-Formpth-Name') || path.split(/[\\/]/).pop() || path, path: h('X-Formpth-Path') || path, size: Number(r.headers.get('X-Formpth-Size') ?? 0), mtime: Number(r.headers.get('X-Formpth-Mtime') ?? 0) };
  },
  async statFiles(paths: string[]): Promise<Array<{ path: string; exists: boolean; size: number; mtime: number }>> { return (await json<{ files: Array<{ path: string; exists: boolean; size: number; mtime: number }> }>(await request('/files/stat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ paths }) }))).files; },
  async writeFile(folder: string, name: string, blob: Blob): Promise<string> { return (await json<{ path: string }>(await request('/files/write', { method: 'POST', body: form({ folder, name }, [{ name, blob }], 'file') }))).path; },

  async spellCheck(words: string[], lang: string): Promise<SpellHit[]> { return (await json<{ unknown: SpellHit[] }>(await request('/spell/check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ words, lang }) }))).unknown; },
  async spellDictionary(): Promise<string[]> { return (await json<{ words: string[] }>(await request('/spell/dictionary'))).words; },
  async spellDictionaryEdit(add: string[], remove: string[] = []): Promise<string[]> { return (await json<{ words: string[] }>(await request('/spell/dictionary', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ add, remove }) }))).words; },
  async similarFonts(id: string, limit = 10): Promise<SimilarFont[]> { try { return (await json<{ fonts: SimilarFont[] }>(await request(`/fonts/similar?id=${encodeURIComponent(id)}&limit=${limit}`))).fonts; } catch { return []; } },
  async fonts(): Promise<FontInfo[]> { try { return await json<FontInfo[]>(await request('/fonts')); } catch { return []; } },
  async findFont(family: string, style: string): Promise<FontInfo | null> { try { return await json<FontInfo>(await request(`/fonts/find?family=${encodeURIComponent(family)}&style=${encodeURIComponent(style)}`)); } catch { return null; } },
  async fontFile(id: string): Promise<ArrayBuffer> { return (await request(`/fonts/file/${encodeURIComponent(id)}`)).arrayBuffer(); },

  async plugins(): Promise<Array<{ name: string; size: number }>> { try { return await json<Array<{ name: string; size: number }>>(await request('/plugins')); } catch { return []; } },
  async pluginCode(name: string): Promise<string> { return (await request(`/plugins/${encodeURIComponent(name)}`)).text(); },
  async addPlugin(name: string, code: string): Promise<void> { await request(`/plugins/${encodeURIComponent(name)}`, { method: 'PUT', headers: { 'Content-Type': 'text/javascript' }, body: code }); },
  async removePlugin(name: string): Promise<void> { await request(`/plugins/${encodeURIComponent(name)}`, { method: 'DELETE' }); },

  async assistantStep(messages: unknown[], tools = true): Promise<{ content: string; tool_calls: Array<{ id: string; name: string; arguments: string }> }> {
    return json(await request('/llm/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages, tools }) }));
  },
  async llmStatus(): Promise<LlmStatus | null> { try { return await json<LlmStatus>(await request('/llm/status')); } catch { return null; } },
  async llmSave(baseUrl: string, model: string, key: string | null, forgetKey = false, vision?: boolean): Promise<LlmStatus> {
    return json(await request('/llm/settings', { method: 'POST', body: form({ base_url: baseUrl, model, ...(key ? { key } : {}), ...(forgetKey ? { forget_key: 'true' } : {}), ...(vision !== undefined ? { vision: String(vision) } : {}) }) }));
  },
  async llmGenerate(system: string, prompt: string, o: { image?: string; temperature?: number; maxTokens?: number } = {}): Promise<{ text: string; model: string }> {
    return json(await request('/llm/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ system, prompt, image: o.image ?? null, temperature: o.temperature ?? 0.8, max_tokens: o.maxTokens ?? 6000 }) }));
  },
  async llmModels(): Promise<string[]> { return (await json<{ models: string[] }>(await request('/llm/models'))).models; },

  async nodemodeStatus(target: string): Promise<{ running: boolean; receiver: boolean; detail?: string } | null> {
    try { return await json(await request(`/nodemode/status?target=${encodeURIComponent(target)}`)); } catch { return null; }
  },
  async sendToNodeMode(target: string, title: string, items: unknown[], parts: FilePart[]): Promise<{ placed: boolean; detail?: string; files: Array<{ url: string }> }> {
    return json(await request('/nodemode/send', { method: 'POST', body: form({ target, title, items: JSON.stringify(items) }, parts) }));
  },

  async mcpSession(): Promise<string | null> {
    try { const res = await fetch('/api/mcp/bridge/session', { method: 'POST', cache: 'no-store' }); return res.ok ? ((await res.json()) as { secret?: string }).secret ?? null : null; } catch { return null; }
  },
  async mcpNext(secret: string, allowed: boolean): Promise<{ status: number; item: BridgeItem | null }> {
    const res = await fetch('/api/mcp/bridge/next', { method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json', [BRIDGE_HEADER]: secret }, body: JSON.stringify({ allowed }) });
    return { status: res.status, item: res.status === 200 ? ((await res.json()) as BridgeItem) : null };
  },
  async mcpResult(secret: string, id: string, result: unknown): Promise<void> { await fetch('/api/mcp/bridge/result', { method: 'POST', headers: { 'Content-Type': 'application/json', [BRIDGE_HEADER]: secret }, body: JSON.stringify({ id, result }) }); },
  async mcpStop(secret: string): Promise<void> { try { await fetch('/api/mcp/bridge/stop', { method: 'POST', headers: { [BRIDGE_HEADER]: secret } }); } catch { } },
  async mcpStatus(): Promise<{ live: boolean; allowed: boolean; endpoint: string; tools: number } | null> { try { return await json(await request('/mcp/status')); } catch { return null; } },
  async terminals(): Promise<TerminalInfo[]> { return (await json<{ terminals: TerminalInfo[] }>(await request('/terminal'))).terminals; },
  async openTerminal(cols: number, rows: number, cwd?: string): Promise<TerminalInfo> { return json(await request('/terminal', post({ cols, rows, ...(cwd ? { cwd } : {}) }))); },
  async writeTerminal(id: string, data: string): Promise<void> { await request(`/terminal/${encodeURIComponent(id)}/write`, post({ data })); },
  async readTerminal(id: string, chars = 4000): Promise<{ id: string; alive: boolean; text: string }> { return json(await request(`/terminal/${encodeURIComponent(id)}/read?chars=${chars}`)); },
  async restartTerminal(id: string): Promise<TerminalInfo> { return json(await request(`/terminal/${encodeURIComponent(id)}/restart`, { method: 'POST' })); },
  async closeTerminal(id: string): Promise<void> { await request(`/terminal/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  async claudeStatus(): Promise<ClaudeStatus> { return json(await request('/claude/status')); },
  async claudePrefs(values: Partial<Record<'claudeBin' | 'claudeFolder' | 'claudeFirstMessage', string>>): Promise<Record<string, string>> { return json(await request('/claude/prefs', post(values))); },
  async claudeOpen(body: { prompt?: string; cols?: number; rows?: number; fresh?: boolean; resume?: string }): Promise<TerminalInfo> { return json(await request('/claude/open', post(body))); },
  async chatState<T>(): Promise<T> { return json(await request('/claude/chat')); },
  async chatSend(text: string, context = '', note = ''): Promise<void> { await request('/claude/chat/send', post({ text, context, note })); },
  async chatCancel(): Promise<void> { await request('/claude/chat/cancel', { method: 'POST' }); },
  async chatReset(): Promise<void> { await request('/claude/chat/reset', { method: 'POST' }); },
  async chatSessions(): Promise<{ sessions: Array<{ id: string; title: string; modified: number; current: boolean }>; folder: string }> { return json(await request('/claude/chat/sessions')); },
  async chatAdopt(session: string): Promise<void> { await request('/claude/chat/adopt', post({ session })); },
  chatImage(name: string): string { return `/api/claude/chat/image/${encodeURIComponent(name)}`; },
};

export interface TerminalInfo { id: string; title: string; cwd: string; alive: boolean; kind: 'shell' | 'claude' }
export interface ClaudeStatus { installed: boolean; path: string | null; version: string | null; install: string; folder: string; terminal: TerminalInfo | null; binNote: string; firstMessage: string }

function post(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export function socketTo(path: string): WebSocket {
  return new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/api${path}`);
}
