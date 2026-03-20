import { Download, Table2, BarChart3, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { cn } from "@/lib/utils";

interface ToolResultRendererProps {
  toolName: string;
  output: unknown;
}

export function ToolResultRenderer({ toolName, output }: ToolResultRendererProps) {
  if (!output || typeof output !== "object") return null;

  const data = output as Record<string, unknown>;

  switch (toolName) {
    case "run_query":
      return <QueryResult data={data} />;
    case "export_data":
      return <ExportResult data={data} />;
    case "execute_cleaning":
    case "run_harmonization":
      return <PipelineResult data={data} toolName={toolName} />;
    case "propose_target_schema":
      return <SchemaResult data={data} />;
    case "run_script":
      return <ScriptResult data={data} />;
    case "profile_columns":
      return <ProfileResult data={data} />;
    default:
      return <GenericResult data={data} />;
  }
}

function QueryResult({ data }: { data: Record<string, unknown> }) {
  const columns = data.columns as string[] | undefined;
  const rows = data.rows as Record<string, unknown>[] | undefined;
  const generatedCode = data.generatedCode as string | undefined;
  const codeType = data.codeType as string | undefined;
  const rowCount = rows?.length ?? 0;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      {generatedCode && (
        <div className="rounded-md overflow-hidden">
          <CodeBlock code={generatedCode} language={codeType === "python" ? "python" : "sql"} />
        </div>
      )}
      {columns && rows && rowCount > 0 && (
        <div className="overflow-x-auto rounded-md border border-cm-border-subtle">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-cm-bg-elevated">
                {columns.map((col) => (
                  <th key={col} className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-cm-text-secondary">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((row, i) => (
                <tr key={i} className="border-t border-cm-border-subtle">
                  {columns.map((col) => (
                    <td key={col} className="whitespace-nowrap px-3 py-1 text-cm-text-primary">
                      {String(row[col] ?? "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {rowCount > 20 && (
            <p className="px-3 py-1 text-xs text-cm-text-tertiary">
              Showing 20 of {rowCount} rows
            </p>
          )}
        </div>
      )}
      {rowCount === 0 && (
        <p className="text-xs text-cm-text-secondary flex items-center gap-1.5">
          <Table2 className="h-3.5 w-3.5" /> No rows returned
        </p>
      )}
    </div>
  );
}

function ExportResult({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean;
  const url = data.downloadUrl as string | undefined;
  const filename = data.filename as string | undefined;
  const format = data.format as string | undefined;

  if (!success) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
        <XCircle className="h-4 w-4 shrink-0" />
        Export failed: {String(data.error ?? "Unknown error")}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-green-50">
        <Download className="h-4 w-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-cm-text-primary truncate">{filename ?? "export"}</p>
        <p className="text-xs text-cm-text-tertiary">{format?.toUpperCase()} file ready</p>
      </div>
      {url && (
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 text-xs"
          onClick={() => window.open(url, "_blank")}
        >
          Download
        </Button>
      )}
    </div>
  );
}

function PipelineResult({ data, toolName }: { data: Record<string, unknown>; toolName: string }) {
  const success = data.success as boolean;
  const label = toolName === "execute_cleaning" ? "Cleaning" : "Harmonization";

  return (
    <div className={cn(
      "flex items-center gap-2 rounded-lg border p-3 text-xs",
      success
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-red-200 bg-red-50 text-red-700"
    )}>
      {success ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      <span className="font-medium">{label}</span>
      <span>{success ? "completed successfully" : `failed: ${String(data.error ?? "")}`}</span>
    </div>
  );
}

function SchemaResult({ data }: { data: Record<string, unknown> }) {
  const tables = data.tables as Array<{
    name: string;
    columns: Array<{ name: string; type: string; description?: string }>;
  }> | undefined;

  if (!tables?.length) return null;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      <p className="text-xs font-medium text-cm-text-secondary flex items-center gap-1.5">
        <Table2 className="h-3.5 w-3.5" /> Proposed Schema
      </p>
      {tables.map((table) => (
        <div key={table.name} className="rounded-md border border-cm-border-subtle p-2">
          <p className="text-xs font-semibold text-cm-text-primary mb-1">{table.name}</p>
          <div className="space-y-0.5">
            {table.columns.map((col) => (
              <div key={col.name} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-cm-text-primary">{col.name}</span>
                <span className="text-cm-text-tertiary">{col.type}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ScriptResult({ data }: { data: Record<string, unknown> }) {
  const generatedCode = data.generatedCode as string | undefined;
  const output = data.output ?? data.result;

  return (
    <div className="space-y-2 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      {generatedCode && (
        <div className="rounded-md overflow-hidden">
          <CodeBlock code={generatedCode} language="python" />
        </div>
      )}
      {output != null && (
        <div className="text-xs text-cm-text-primary bg-cm-bg-elevated rounded-md p-2 font-mono whitespace-pre-wrap">
          {typeof output === "string" ? output : JSON.stringify(output as object, null, 2)}
        </div>
      )}
    </div>
  );
}

function ProfileResult({ data }: { data: Record<string, unknown> }) {
  const profiles = data.profiles as Array<{
    columnName: string;
    inferredType: string;
    semanticLabel: string;
    confidence: number;
  }> | undefined;

  if (!profiles?.length) return <GenericResult data={data} />;

  return (
    <div className="space-y-1 rounded-lg border border-cm-border-primary bg-cm-bg-surface p-3">
      <p className="text-xs font-medium text-cm-text-secondary mb-2 flex items-center gap-1.5">
        <BarChart3 className="h-3.5 w-3.5" /> Column Profiles
      </p>
      {profiles.slice(0, 10).map((p) => (
        <div key={p.columnName} className="flex items-center gap-2 text-xs">
          <span className="font-mono text-cm-text-primary min-w-[100px]">{p.columnName}</span>
          <span className="rounded bg-cm-bg-elevated px-1.5 py-0.5 text-cm-text-tertiary">{p.inferredType}</span>
          <span className="text-cm-text-secondary flex-1 truncate">{p.semanticLabel}</span>
          <span className="tabular-nums text-cm-text-tertiary">{Math.round(p.confidence * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

function GenericResult({ data }: { data: Record<string, unknown> }) {
  const success = data.success as boolean | undefined;

  if (success !== undefined) {
    return (
      <div className={cn(
        "flex items-center gap-2 rounded-lg border p-2.5 text-xs",
        success
          ? "border-green-200 bg-green-50 text-green-700"
          : "border-red-200 bg-red-50 text-red-700"
      )}>
        {success ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
        {success ? "Completed" : String(data.error ?? "Failed")}
      </div>
    );
  }

  return (
    <div className="rounded-md bg-cm-bg-elevated p-2 text-xs font-mono whitespace-pre-wrap max-h-40 overflow-auto">
      {JSON.stringify(data, null, 2)}
    </div>
  );
}
