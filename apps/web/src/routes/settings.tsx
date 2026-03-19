import { useState } from "react";
import { ModelConfig } from "@/components/settings/model-config";
import { MappingThresholds } from "@/components/settings/mapping-thresholds";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";

export default function SettingsPage() {
  const [clearOpen, setClearOpen] = useState(false);

  const handleClearData = () => {
    setClearOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto bg-cm-bg-app p-6">
      <div className="mx-auto max-w-2xl space-y-8">
        <h1 className="text-xl font-semibold text-cm-text-primary">Settings</h1>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Model Configuration
          </h2>
          <ModelConfig />
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Mapping Thresholds
          </h2>
          <MappingThresholds />
        </section>

        <Separator />

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-cm-text-secondary uppercase tracking-wider">
            Danger Zone
          </h2>
          <div className="rounded-lg border border-cm-error/20 bg-cm-error-subtle p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-cm-text-primary">Clear All Data</p>
                <p className="text-xs text-cm-text-secondary mt-0.5">
                  Remove all uploaded sources, mappings, and conversations.
                </p>
              </div>
              <Dialog open={clearOpen} onOpenChange={setClearOpen}>
                <DialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                    Clear Data
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Clear all data?</DialogTitle>
                    <DialogDescription>
                      This will permanently delete all uploaded sources, column profiles, field
                      mappings, agent conversations, and pinned dashboard widgets. This action
                      cannot be undone.
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setClearOpen(false)}>
                      Cancel
                    </Button>
                    <Button variant="destructive" onClick={handleClearData}>
                      Delete Everything
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
