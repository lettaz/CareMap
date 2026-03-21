import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import {
  Database,
  GitMerge,
  ShieldCheck,
  HardDriveDownload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeCategory } from "@/lib/types";

const CATEGORY_ICONS: Record<string, typeof Database> = {
  source: Database,
  transform: GitMerge,
  harmonize: Database,
  quality: ShieldCheck,
  sink: HardDriveDownload,
};

const CATEGORY_COLORS: Record<string, string> = {
  source: "text-blue-600",
  transform: "text-violet-600",
  harmonize: "text-cyan-600",
  quality: "text-amber-600",
  sink: "text-emerald-600",
};

export interface MentionSuggestionItem {
  id: string;
  data: {
    label: string;
    category: NodeCategory;
    sourceFileId?: unknown;
  };
}

export interface MentionListProps {
  items: MentionSuggestionItem[];
  command: (attrs: Record<string, string>) => void;
}

export interface MentionListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const MentionList = forwardRef<MentionListRef, MentionListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => setSelectedIndex(0), [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (!item) return;
        command({
          id: item.id,
          label: item.data.label,
          category: item.data.category,
          sourceFileId: (item.data.sourceFileId as string) ?? "",
        });
      },
      [items, command],
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="w-64 rounded-lg border border-cm-border-primary bg-cm-bg-surface py-1 shadow-lg overflow-hidden">
        <p className="px-3 py-1 text-[10px] font-medium text-cm-text-tertiary uppercase tracking-wide">
          Pipeline nodes
        </p>
        {items.map((item, index) => {
          const Icon = CATEGORY_ICONS[item.data.category] ?? Database;
          const iconColor = CATEGORY_COLORS[item.data.category] ?? "text-slate-500";
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => selectItem(index)}
              className={cn(
                "flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors",
                index === selectedIndex
                  ? "bg-cm-accent-subtle text-cm-accent"
                  : "text-cm-text-secondary hover:bg-cm-bg-hover",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
              <div className="flex-1 min-w-0">
                <span className="block truncate font-medium">{item.data.label}</span>
              </div>
              <span className="text-[10px] text-cm-text-tertiary capitalize shrink-0">
                {item.data.category}
              </span>
            </button>
          );
        })}
      </div>
    );
  },
);

MentionList.displayName = "MentionList";
