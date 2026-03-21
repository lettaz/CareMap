import type { FastifyPluginAsync } from "fastify";
import crypto from "node:crypto";
import { supabase } from "../config/supabase.js";
import { ValidationError, NotFoundError, AppError } from "../lib/errors.js";
import { ingestBuffer } from "../services/ingest.js";

class AuthError extends AppError {
  constructor(message: string) {
    super(message, 401, "UNAUTHORIZED");
    this.name = "AuthError";
  }
}

function verifyHmac(body: string, secret: string, signature: string): boolean {
  const expected = `sha256=${crypto.createHmac("sha256", secret).update(body).digest("hex")}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

function jsonRowsToCsvBuffer(rows: Record<string, unknown>[]): { buffer: Buffer; columns: string[] } {
  if (rows.length === 0) throw new ValidationError("Payload contains no rows");

  const columns = [...new Set(rows.flatMap((r) => Object.keys(r)))];

  const escape = (val: unknown): string => {
    if (val === null || val === undefined) return "";
    const str = String(val);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines = [columns.map(escape).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escape(row[col])).join(","));
  }

  return {
    buffer: Buffer.from(lines.join("\n"), "utf-8"),
    columns,
  };
}

export const webhookIngestRoutes: FastifyPluginAsync = async (app) => {
  app.post<{ Params: { webhookId: string } }>("/:webhookId", async (request, reply) => {
    const { webhookId } = request.params;

    const { data: webhook, error: whErr } = await supabase
      .from("webhooks")
      .select()
      .eq("id", webhookId)
      .single();

    if (whErr || !webhook) throw new NotFoundError("Webhook", webhookId);
    if (!webhook.is_active) throw new AppError("Webhook is disabled", 403, "WEBHOOK_DISABLED");

    const apiKeyHeader = request.headers["x-webhook-key"] as string | undefined;
    const signatureHeader = request.headers["x-webhook-signature"] as string | undefined;

    if (apiKeyHeader) {
      if (apiKeyHeader !== webhook.api_key) throw new AuthError("Invalid API key");
    } else if (signatureHeader && webhook.hmac_secret) {
      const rawBody = typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);
      if (!verifyHmac(rawBody, webhook.hmac_secret, signatureHeader)) {
        throw new AuthError("Invalid HMAC signature");
      }
    } else {
      throw new AuthError("Missing authentication. Provide X-Webhook-Key or X-Webhook-Signature header");
    }

    const contentType = (request.headers["content-type"] ?? "").toLowerCase();
    const isMultipart = contentType.includes("multipart");
    const isJson = contentType.includes("application/json");

    let buffer: Buffer;
    let filename: string;
    let fileType: "csv" | "tsv" | "xlsx" | "webhook-json";

    if (isMultipart) {
      if (webhook.payload_type === "json") {
        throw new ValidationError("This webhook only accepts JSON payloads");
      }

      const file = await request.file();
      if (!file) throw new ValidationError("No file in multipart request");

      const isAllowed = /\.(csv|tsv|txt|xlsx|xls)$/i.test(file.filename);
      if (!isAllowed) throw new ValidationError("Unsupported file type. Accepted: CSV, TSV, TXT, XLSX");

      buffer = await file.toBuffer();
      filename = file.filename;
      const isExcel = /\.(xlsx|xls)$/i.test(filename);
      const isTsv = /\.(tsv)$/i.test(filename);
      fileType = isExcel ? "xlsx" : isTsv ? "tsv" : "csv";
    } else if (isJson) {
      if (webhook.payload_type === "file") {
        throw new ValidationError("This webhook only accepts file uploads");
      }

      const body = request.body as Record<string, unknown> | Record<string, unknown>[];
      const rows: Record<string, unknown>[] = Array.isArray(body)
        ? body
        : Array.isArray(body?.rows)
          ? body.rows as Record<string, unknown>[]
          : [body];

      if (rows.length === 0) throw new ValidationError("Payload contains no rows");

      const { buffer: csvBuf } = jsonRowsToCsvBuffer(rows);
      buffer = csvBuf;
      filename = `webhook_${webhook.name.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}.csv`;
      fileType = "webhook-json";
    } else {
      throw new ValidationError("Unsupported Content-Type. Use application/json or multipart/form-data");
    }

    const result = await ingestBuffer({
      projectId: webhook.project_id,
      nodeId: webhook.node_id,
      filename,
      buffer,
      fileType,
    });

    await supabase
      .from("webhooks")
      .update({
        last_triggered_at: new Date().toISOString(),
        trigger_count: (webhook.trigger_count ?? 0) + 1,
      })
      .eq("id", webhookId);

    return reply.status(200).send({
      success: true,
      sourceFileId: result.sourceFileId,
      rowCount: result.rowCount,
      columnCount: result.columnCount,
      suggestedLabel: result.suggestedLabel,
    });
  });
};
