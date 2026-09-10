import { createHash, randomUUID } from 'node:crypto';
import { mkdir, open, readFile, rename, lstat } from 'node:fs/promises';
import { dirname } from 'node:path';

export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object' && value && Object.getPrototypeOf(value) === Object.prototype)
    return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  throw new Error('non_json_value');
}
export const digest = (value: unknown): string => 'sha256:' + createHash('sha256').update(canonical(value)).digest('hex');
export const fail = (code: string): never => { throw new Error(code); };
export async function readJSON(path: string): Promise<any> {
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024 * 1024) fail('unsafe_json_file');
  return JSON.parse(await readFile(path, 'utf8'));
}
export async function atomicJSON(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temp = path + '.' + randomUUID() + '.tmp';
  const handle = await open(temp, 'wx', 0o600);
  try { await handle.writeFile(canonical(value) + '\n'); await handle.sync(); } finally { await handle.close(); }
  await rename(temp, path);
  if (digest(await readJSON(path)) !== digest(value)) fail('write_readback_failed');
}
