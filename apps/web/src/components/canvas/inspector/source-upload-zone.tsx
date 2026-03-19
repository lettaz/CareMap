import { useCallback, useRef, useState } from "react";
import { Upload, FileSpreadsheet, FileText, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceUploadZoneProps {
  onFileSelected: (file: File) => void;
}

const ACCEPTED_TYPES: Record<string, boolean> = {
  "text/csv": true,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": true,
  "application/vnd.ms-excel": true,
  "application/pdf": true,
  "text/plain": true,
};

const ACCEPTED_EXTENSIONS = ".csv,.xlsx,.xls,.pdf,.txt";

const FORMAT_CARDS = [
  { ext: "CSV", icon: FileSpreadsheet, color: "text-emerald-600" },
  { ext: "XLSX", icon: FileSpreadsheet, color: "text-blue-600" },
  { ext: "PDF", icon: FileText, color: "text-red-500" },
  { ext: "TXT", icon: File, color: "text-slate-500" },
];

export function SourceUploadZone({ onFileSelected }: SourceUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const validByType = ACCEPTED_TYPES[file.type];
      const validByExt = ["csv", "xlsx", "xls", "pdf", "txt"].includes(ext);
      if (validByType || validByExt) {
        onFileSelected(file);
      }
    },
    [onFileSelected],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFile(e.dataTransfer.files[0]);
    },
    [handleFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragOver(false), []);

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      handleFile(e.target.files?.[0]);
      if (inputRef.current) inputRef.current.value = "";
    },
    [handleFile],
  );

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-all cursor-pointer",
          isDragOver
            ? "border-cm-accent bg-cm-accent-subtle/30 scale-[1.01]"
            : "border-cm-border-primary bg-cm-bg-elevated/40 hover:border-cm-accent hover:bg-cm-accent-subtle/20",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={onInputChange}
          className="hidden"
        />

        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full transition-colors",
            isDragOver ? "bg-cm-accent/10" : "bg-cm-accent-subtle",
          )}
        >
          <Upload
            className={cn(
              "h-5 w-5 transition-colors",
              isDragOver ? "text-cm-accent" : "text-cm-accent",
            )}
          />
        </div>

        <p className="mt-3 text-sm font-medium text-cm-text-primary">
          {isDragOver ? "Drop to upload" : "Drop your data file here"}
        </p>
        <p className="mt-1 text-xs text-cm-text-tertiary">
          or click to browse — up to 50 MB
        </p>

        <span className="mt-4 rounded-md bg-cm-accent px-4 py-2 text-xs font-medium text-white hover:bg-cm-accent-hover transition-colors">
          Browse Files
        </span>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-cm-text-secondary">Supported formats</p>
        <div className="grid grid-cols-2 gap-2">
          {FORMAT_CARDS.map(({ ext, icon: Icon, color }) => (
            <div
              key={ext}
              className="flex items-center gap-2 rounded-md border border-cm-border-primary bg-cm-bg-surface px-3 py-2"
            >
              <Icon className={`h-4 w-4 ${color}`} />
              <span className="text-xs text-cm-text-secondary">{ext}</span>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-cm-text-tertiary leading-relaxed">
        Once uploaded, CareMap will automatically profile your data — detecting column types,
        identifying quality issues, and suggesting semantic mappings.
      </p>
    </div>
  );
}
