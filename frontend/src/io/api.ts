export interface Capabilities { name: string; version: string; desktop: boolean; dataDir: string; libraryDir: string; fonts: boolean }
export interface LibraryItem { name: string; modified: number; size: number }
export interface OpenedProject { session: string; name: string; manifest: Record<string, unknown>; images: Record<string, string>; version?: string }
export interface LibraryFolder { folder: string; default: string; custom: boolean; fixed: boolean; synced: Array<{ label: string; base: string; suggested: string }> }
export interface FilePart { name: string; blob: Blob }
export interface FontInfo { id: string; family: string; style: string; full: string; postscript: string }
export interface LlmStatus { configured: boolean; baseUrl: string; model: string; hasKey: boolean; store: 'system' | 'file' }

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
  async llmSave(baseUrl: string, model: string, key: string | null, forgetKey = false): Promise<LlmStatus> {
    return json(await request('/llm/settings', { method: 'POST', body: form({ base_url: baseUrl, model, ...(key ? { key } : {}), ...(forgetKey ? { forget_key: 'true' } : {}) }) }));
  },
  async llmModels(): Promise<string[]> { return (await json<{ models: string[] }>(await request('/llm/models'))).models; },

  async nodemodeStatus(target: string): Promise<{ running: boolean; receiver: boolean; detail?: string } | null> {
    try { return await json(await request(`/nodemode/status?target=${encodeURIComponent(target)}`)); } catch { return null; }
  },
  async sendToNodeMode(target: string, title: string, items: unknown[], parts: FilePart[]): Promise<{ placed: boolean; detail?: string; files: Array<{ url: string }> }> {
    return json(await request('/nodemode/send', { method: 'POST', body: form({ target, title, items: JSON.stringify(items) }, parts) }));
  },

  async mcpNext(allowed: boolean, signal: AbortSignal): Promise<{ id: string; name: string; arguments: Record<string, unknown> } | null> {
    const res = await fetch(`/api/mcp/bridge/next?allowed=${allowed ? 1 : 0}`, { signal });
    if (res.status === 204 || !res.ok) return null;
    return (await res.json()) as { id: string; name: string; arguments: Record<string, unknown> };
  },
  async mcpResult(id: string, result: unknown): Promise<void> { await fetch('/api/mcp/bridge/result', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, result }) }); },
  async mcpStop(): Promise<void> { try { await fetch('/api/mcp/bridge/stop', { method: 'POST' }); } catch { } },
  async mcpStatus(): Promise<{ live: boolean; allowed: boolean; endpoint: string; tools: number } | null> { try { return await json(await request('/mcp/status')); } catch { return null; } },
};
