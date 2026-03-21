import { useState, useCallback, useEffect } from "react";
import {
  Webhook,
  Plus,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Clock,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { apiUrl } from "@/lib/api/client";
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  type WebhookDTO,
} from "@/lib/api/webhooks";

interface WebhookConfigPanelProps {
  projectId: string;
  nodeId: string;
}

export function WebhookConfigPanel({ projectId, nodeId }: WebhookConfigPanelProps) {
  const [webhooks, setWebhooks] = useState<WebhookDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  const load = useCallback(async () => {
    try {
      const all = await fetchWebhooks(projectId);
      setWebhooks(all.filter((w) => w.node_id === nodeId));
    } catch {
      toast.error("Failed to load webhooks");
    } finally {
      setLoading(false);
    }
  }, [projectId, nodeId]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = useCallback(async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const created = await createWebhook(projectId, {
        name: newName.trim(),
        nodeId,
        payloadType: "both",
        enableHmac: true,
      });
      setWebhooks((prev) => [created, ...prev]);
      setNewName("");
      toast.success("Webhook created");
    } catch (err) {
      toast.error("Failed to create webhook", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setCreating(false);
    }
  }, [projectId, nodeId, newName]);

  const handleToggle = useCallback(async (wh: WebhookDTO) => {
    try {
      const updated = await updateWebhook(projectId, wh.id, { isActive: !wh.is_active });
      setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? updated : w)));
    } catch {
      toast.error("Failed to update webhook");
    }
  }, [projectId]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await deleteWebhook(projectId, id);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast.success("Webhook deleted");
    } catch {
      toast.error("Failed to delete webhook");
    }
  }, [projectId]);

  const handleRotateKey = useCallback(async (wh: WebhookDTO) => {
    try {
      const updated = await updateWebhook(projectId, wh.id, { rotateApiKey: true });
      setWebhooks((prev) => prev.map((w) => (w.id === wh.id ? updated : w)));
      toast.success("API key rotated — copy the new key now");
    } catch {
      toast.error("Failed to rotate key");
    }
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-cm-text-tertiary text-xs">
        Loading webhooks...
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2">
        <Webhook className="h-4 w-4 text-cm-accent" />
        <span className="text-xs font-medium text-cm-text-primary">Webhook Ingestion</span>
      </div>

      <p className="text-[11px] text-cm-text-tertiary leading-relaxed">
        External systems can push data into this source node via HTTP.
        Supports JSON row payloads and file uploads with API key or HMAC authentication.
      </p>

      <div className="flex items-center gap-2">
        <Input
          placeholder="Webhook name (e.g., EHR Sync)"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="h-8 text-xs flex-1"
        />
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={!newName.trim() || creating}
          className="h-8 gap-1.5"
        >
          <Plus className="h-3 w-3" />
          Create
        </Button>
      </div>

      {webhooks.length === 0 && (
        <div className="rounded-lg border border-dashed border-cm-border-primary py-8 text-center">
          <Webhook className="mx-auto h-8 w-8 text-cm-text-tertiary/40 mb-2" />
          <p className="text-xs text-cm-text-tertiary">No webhooks configured</p>
          <p className="text-[10px] text-cm-text-tertiary/60 mt-1">
            Create one to receive data from external systems
          </p>
        </div>
      )}

      {webhooks.map((wh) => (
        <WebhookCard
          key={wh.id}
          webhook={wh}
          onToggle={() => handleToggle(wh)}
          onDelete={() => handleDelete(wh.id)}
          onRotateKey={() => handleRotateKey(wh)}
        />
      ))}
    </div>
  );
}

function WebhookCard({
  webhook,
  onToggle,
  onDelete,
  onRotateKey,
}: {
  webhook: WebhookDTO;
  onToggle: () => void;
  onDelete: () => void;
  onRotateKey: () => void;
}) {
  const [showKey, setShowKey] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const webhookUrl = apiUrl(`/api/wh/${webhook.id}`);

  const copyToClipboard = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  const curlJson = `curl -X POST "${webhookUrl}" \\
  -H "Content-Type: application/json" \\
  -H "X-Webhook-Key: ${webhook.api_key}" \\
  -d '{"rows": [{"col1": "value1", "col2": "value2"}]}'`;

  const curlFile = `curl -X POST "${webhookUrl}" \\
  -H "X-Webhook-Key: ${webhook.api_key}" \\
  -F "file=@data.csv"`;

  const relativeTime = webhook.last_triggered_at
    ? formatRelative(webhook.last_triggered_at)
    : "Never";

  return (
    <div className={`rounded-lg border ${webhook.is_active ? "border-cm-border-primary" : "border-cm-border-primary/50 opacity-60"} bg-cm-bg-base overflow-hidden`}>
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-cm-border-primary/50">
        <div className="flex items-center gap-2 min-w-0">
          <Zap className={`h-3.5 w-3.5 shrink-0 ${webhook.is_active ? "text-green-500" : "text-cm-text-tertiary"}`} />
          <span className="text-xs font-medium text-cm-text-primary truncate">{webhook.name}</span>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 shrink-0">
            {webhook.payload_type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch
            checked={webhook.is_active}
            onCheckedChange={onToggle}
            size="sm"
          />
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
            <Trash2 className="h-3 w-3 text-red-400" />
          </Button>
        </div>
      </div>

      <div className="px-3 py-2.5 space-y-2.5">
        <FieldRow
          label="Endpoint"
          value={webhookUrl}
          onCopy={() => copyToClipboard(webhookUrl, "URL")}
          copied={copied === "URL"}
        />

        <FieldRow
          label="API Key"
          value={showKey ? webhook.api_key : webhook.api_key}
          masked={!showKey}
          onCopy={() => copyToClipboard(webhook.api_key, "API Key")}
          copied={copied === "API Key"}
          onToggleVisibility={() => setShowKey(!showKey)}
          showVisible={showKey}
          actions={
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={onRotateKey} title="Rotate key">
              <RotateCcw className="h-2.5 w-2.5" />
            </Button>
          }
        />

        {webhook.hmac_secret && (
          <FieldRow
            label="HMAC Secret"
            value={webhook.hmac_secret}
            masked={!showSecret}
            onCopy={() => copyToClipboard(webhook.hmac_secret!, "HMAC Secret")}
            copied={copied === "HMAC Secret"}
            onToggleVisibility={() => setShowSecret(!showSecret)}
            showVisible={showSecret}
          />
        )}

        <div className="flex items-center gap-3 pt-1 text-[10px] text-cm-text-tertiary">
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" />
            {relativeTime}
          </span>
          <span>{webhook.trigger_count} trigger{webhook.trigger_count !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="border-t border-cm-border-primary/50 px-3 py-2">
        <details className="group">
          <summary className="flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-cm-text-secondary">
            <ExternalLink className="h-2.5 w-2.5" />
            curl examples
          </summary>
          <div className="mt-2 space-y-2">
            <CodeBlock label="JSON payload" code={curlJson} onCopy={() => copyToClipboard(curlJson, "curl (JSON)")} copied={copied === "curl (JSON)"} />
            <CodeBlock label="File upload" code={curlFile} onCopy={() => copyToClipboard(curlFile, "curl (File)")} copied={copied === "curl (File)"} />
          </div>
        </details>
      </div>
    </div>
  );
}

function FieldRow({
  label,
  value,
  masked,
  onCopy,
  copied,
  onToggleVisibility,
  showVisible,
  actions,
}: {
  label: string;
  value: string;
  masked?: boolean;
  onCopy: () => void;
  copied: boolean;
  onToggleVisibility?: () => void;
  showVisible?: boolean;
  actions?: React.ReactNode;
}) {
  const displayValue = masked ? value.replace(/./g, (_, i) => (i < 4 || i > value.length - 5 ? _ : "*")) : value;

  return (
    <div className="space-y-0.5">
      <span className="text-[10px] text-cm-text-tertiary font-medium">{label}</span>
      <div className="flex items-center gap-1">
        <code className="flex-1 truncate rounded bg-cm-bg-elevated px-2 py-1 text-[10px] font-mono text-cm-text-secondary">
          {displayValue}
        </code>
        {onToggleVisibility && (
          <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onToggleVisibility}>
            {showVisible ? <EyeOff className="h-2.5 w-2.5" /> : <Eye className="h-2.5 w-2.5" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={onCopy}>
          {copied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
        </Button>
        {actions}
      </div>
    </div>
  );
}

function CodeBlock({ label, code, onCopy, copied }: { label: string; code: string; onCopy: () => void; copied: boolean }) {
  return (
    <div className="rounded border border-cm-border-primary/50 bg-cm-bg-elevated">
      <div className="flex items-center justify-between px-2 py-1 border-b border-cm-border-primary/30">
        <span className="text-[9px] text-cm-text-tertiary">{label}</span>
        <Button variant="ghost" size="icon" className="h-4 w-4" onClick={onCopy}>
          {copied ? <Check className="h-2 w-2 text-green-500" /> : <Copy className="h-2 w-2" />}
        </Button>
      </div>
      <pre className="p-2 text-[9px] font-mono text-cm-text-secondary whitespace-pre-wrap break-all leading-relaxed">
        {code}
      </pre>
    </div>
  );
}

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
