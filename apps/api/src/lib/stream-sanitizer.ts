const DATA_PREFIX = "data: ";

function stripProviderMetadata(line: string): string {
  if (!line.startsWith(DATA_PREFIX)) return line;

  const json = line.slice(DATA_PREFIX.length);
  if (!json.includes("providerMetadata")) return line;

  try {
    const parsed = JSON.parse(json);
    if (parsed && typeof parsed === "object" && "providerMetadata" in parsed) {
      delete parsed.providerMetadata;
      return DATA_PREFIX + JSON.stringify(parsed);
    }
  } catch {
    // not valid JSON — pass through unchanged
  }

  return line;
}

export function createSanitizedStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            if (buffer.length > 0) {
              controller.enqueue(encoder.encode(stripProviderMetadata(buffer)));
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            controller.enqueue(encoder.encode(stripProviderMetadata(line) + "\n"));
          }
        }
      } catch {
        controller.close();
      }
    },
  });
}
