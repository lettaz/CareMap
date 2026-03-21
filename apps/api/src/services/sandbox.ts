import { Sandbox } from "@e2b/code-interpreter";
import { env } from "../config/env.js";
import { getSignedUrl } from "./storage.js";

export interface SandboxOptions {
  timeoutMs?: number;
  maxResultRows?: number;
  maxRetries?: number;
  onStdout?: (line: string) => void;
  onStderr?: (line: string) => void;
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  results: unknown[];
  retryCount: number;
}

const DEFAULT_TIMEOUT = 30_000;
const DEFAULT_MAX_ROWS = 1000;
const DEFAULT_MAX_RETRIES = 2;

const TRANSIENT_ERROR_PATTERNS = [
  "port is not open",
  "sandbox timeout",
  "ECONNRESET",
  "ECONNREFUSED",
  "socket hang up",
  "502",
  "503",
  "504",
];

function isTransientError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_ERROR_PATTERNS.some((p) => msg.includes(p));
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function createSandbox(): Promise<Sandbox> {
  const templateId = env.E2B_TEMPLATE_ID ?? "code-interpreter-v1";
  return Sandbox.create(templateId, {
    apiKey: env.E2B_API_KEY,
    secure: false,
  });
}

export interface FileUrlEntry {
  path: string;
  url: string;
  downloadName?: string;
}

export async function getSignedFileUrls(
  storagePaths: string[],
  nameMap?: Map<string, string>,
): Promise<FileUrlEntry[]> {
  const results = await Promise.all(
    storagePaths.map(async (path) => ({
      path,
      url: await getSignedUrl(path, 900),
      downloadName: nameMap?.get(path),
    })),
  );
  return results;
}

function resolveDownloadName(f: FileUrlEntry): string {
  if (f.downloadName) return f.downloadName;
  return f.path.split("/").pop() ?? "file";
}

async function executeOnce(
  code: string,
  fileUrls: FileUrlEntry[],
  opts: SandboxOptions,
): Promise<ExecutionResult> {
  const maxRows = opts.maxResultRows ?? DEFAULT_MAX_ROWS;
  const timeout = opts.timeoutMs ?? DEFAULT_TIMEOUT;
  const sandbox = await createSandbox();

  try {
    if (fileUrls.length > 0) {
      const downloadCode = [
        'import os, urllib.request',
        'os.makedirs("/tmp/data", exist_ok=True)',
        ...fileUrls.map(
          (f) =>
            `urllib.request.urlretrieve("${f.url}", "/tmp/data/${resolveDownloadName(f)}")`,
        ),
      ].join("\n");
      await sandbox.runCode(downloadCode, { timeoutMs: timeout });
    }

    const cappedCode = `
${code}

# Cap result rows for safety
import json as _json
if '_result' in dir() and isinstance(_result, list) and len(_result) > ${maxRows}:
    _result = _result[:${maxRows}]
`;

    let stdout = "";
    let stderr = "";

    const execution = await sandbox.runCode(cappedCode, {
      timeoutMs: timeout,
      onStdout: (msg: { line?: string } | string) => {
        const text = typeof msg === "string" ? msg : (msg?.line ?? String(msg));
        stdout += text + "\n";
        opts.onStdout?.(text);
      },
      onStderr: (msg: { line?: string } | string) => {
        const text = typeof msg === "string" ? msg : (msg?.line ?? String(msg));
        stderr += text + "\n";
        opts.onStderr?.(text);
      },
    });

    const errorMsg = execution.error
      ? `${execution.error.name ?? "Error"}: ${execution.error.value ?? ""}\n${execution.error.traceback ?? ""}`
      : "";

    return {
      stdout: stdout.trim(),
      stderr: (stderr.trim() + "\n" + errorMsg).trim(),
      exitCode: execution.error ? 1 : 0,
      results: execution.results?.map((r) => r.text ?? r) ?? [],
      retryCount: 0,
    };
  } finally {
    await sandbox.kill().catch(() => {});
  }
}

export async function executeInSandbox(
  code: string,
  fileUrls: FileUrlEntry[] = [],
  opts: SandboxOptions = {},
): Promise<ExecutionResult> {
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeOnce(code, fileUrls, opts);
      result.retryCount = attempt;

      if (result.exitCode !== 0 && attempt < maxRetries && isTransientError(result.stderr)) {
        const backoff = 1000 * 2 ** attempt;
        await sleep(backoff);
        continue;
      }

      return result;
    } catch (err) {
      lastError = err;

      if (attempt < maxRetries && isTransientError(err)) {
        const backoff = 1000 * 2 ** attempt;
        await sleep(backoff);
        continue;
      }

      throw err;
    }
  }

  throw lastError ?? new Error("Sandbox execution failed after retries");
}

export async function executeWithFileUpload(
  code: string,
  storagePaths: string[],
  opts: SandboxOptions = {},
  nameMap?: Map<string, string>,
): Promise<ExecutionResult> {
  const fileUrls = await getSignedFileUrls(storagePaths, nameMap);
  return executeInSandbox(code, fileUrls, opts);
}

export function buildFileDownloadPreamble(
  fileUrls: FileUrlEntry[],
  targetDir = "/tmp/data",
): string {
  const lines = [
    "import os, urllib.request",
    `os.makedirs("${targetDir}", exist_ok=True)`,
  ];

  for (const f of fileUrls) {
    const filename = resolveDownloadName(f);
    lines.push(`urllib.request.urlretrieve("${f.url}", "${targetDir}/${filename}")`);
    lines.push(`print(f"Downloaded: ${filename}")`);
  }

  return lines.join("\n");
}
