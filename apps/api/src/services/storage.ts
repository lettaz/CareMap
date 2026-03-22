import { supabase } from "../config/supabase.js";

const BUCKET = "caremap-files";

export function rawPath(projectId: string, sourceFileId: string): string {
  return `raw/${projectId}/${sourceFileId}/original.csv`;
}

export function cleanedPath(projectId: string, sourceFileId: string): string {
  return `cleaned/${projectId}/${sourceFileId}/cleaned.csv`;
}

export function harmonizedDir(projectId: string): string {
  return `harmonized/${projectId}`;
}

export function harmonizedTablePath(projectId: string, tableName: string): string {
  return `harmonized/${projectId}/${tableName}.csv`;
}

export function manifestPath(projectId: string): string {
  return `harmonized/${projectId}/manifest.json`;
}

export async function uploadFile(
  path: string,
  buffer: Buffer,
  contentType: string,
  maxRetries = 3,
): Promise<string> {
  let lastError: string | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (!error) return path;

    lastError = error.message;
    const isTransient = /fetch failed|ECONNRESET|socket hang up|timeout|5\d{2}/i.test(lastError);
    if (!isTransient || attempt === maxRetries) break;

    await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
  }

  throw new Error(`Storage upload failed: ${lastError}`);
}

export async function downloadFile(path: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(path);

  if (error) throw new Error(`Storage download failed: ${error.message}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function getSignedUrl(
  path: string,
  expiresInSeconds = 900,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) throw new Error(`Signed URL creation failed: ${error.message}`);
  return data.signedUrl;
}

export async function deleteFiles(paths: string[]): Promise<void> {
  const { error } = await supabase.storage
    .from(BUCKET)
    .remove(paths);

  if (error) throw new Error(`Storage deletion failed: ${error.message}`);
}

export async function listFiles(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list(prefix);

  if (error) throw new Error(`Storage listing failed: ${error.message}`);
  return (data ?? []).map((f) => `${prefix}/${f.name}`);
}

export function exportPath(projectId: string, filename: string): string {
  return `exports/${projectId}/${Date.now()}_${filename}`;
}

export async function listHarmonizedTables(projectId: string): Promise<string[]> {
  const files = await listFiles(harmonizedDir(projectId));
  return files.filter((f) => !f.endsWith("manifest.json"));
}
