import { apiUrl } from "./client";

export interface SSECallbacks {
  onEvent: (type: string, data: unknown) => void;
  onError?: (error: Error) => void;
  onDone?: () => void;
}

/**
 * Stream SSE from a POST endpoint (for ingest, pipeline trigger, harmonize).
 * Returns AbortController so the caller can cancel.
 */
export function streamSSE(
  path: string,
  body: object,
  { onEvent, onError, onDone }: SSECallbacks,
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch(apiUrl(path), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(`SSE request failed (${res.status}): ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "message";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            try {
              onEvent(eventType, JSON.parse(raw));
            } catch {
              onEvent(eventType, raw);
            }
            eventType = "message";
          }
        }
      }

      onDone?.();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError?.(err as Error);
      }
    }
  })();

  return controller;
}

/**
 * Upload a file via multipart POST with SSE response (used by ingest).
 */
export function uploadWithSSE(
  path: string,
  file: File,
  queryParams: Record<string, string>,
  { onEvent, onError, onDone }: SSECallbacks,
): AbortController {
  const controller = new AbortController();
  const params = new URLSearchParams(queryParams).toString();
  const url = `${apiUrl(path)}?${params}`;

  const formData = new FormData();
  formData.append("file", file);

  (async () => {
    try {
      const res = await fetch(url, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(`Upload failed (${res.status}): ${text}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        let eventType = "message";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6);
            try {
              onEvent(eventType, JSON.parse(raw));
            } catch {
              onEvent(eventType, raw);
            }
            eventType = "message";
          }
        }
      }

      onDone?.();
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError?.(err as Error);
      }
    }
  })();

  return controller;
}
