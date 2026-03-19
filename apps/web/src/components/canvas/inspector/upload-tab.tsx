import { Upload } from "lucide-react";

export function UploadTab() {
  return (
    <div className="mt-3 space-y-3">
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-cm-border-primary bg-cm-bg-elevated/50 px-4 py-8 text-center transition-colors hover:border-cm-accent hover:bg-cm-accent-subtle/30">
        <Upload className="mb-2 h-8 w-8 text-cm-text-tertiary" />
        <p className="text-sm font-medium text-cm-text-primary">Drop files here</p>
        <p className="mt-1 text-xs text-cm-text-tertiary">
          CSV, XLSX, PDF, or TXT up to 50MB
        </p>
        <button className="mt-3 rounded-md bg-cm-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-cm-accent-hover transition-colors">
          Browse Files
        </button>
      </div>
      <div className="text-xs text-cm-text-tertiary">
        Uploaded files will be automatically profiled by the Builder Agent.
      </div>
    </div>
  );
}
