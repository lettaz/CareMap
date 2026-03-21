import { Link } from "react-router-dom";
import { Search, PanelRight, MessageSquare, ChevronRight } from "lucide-react";
import { useAgentStore } from "@/lib/stores/agent-store";
import { useActiveProject } from "@/hooks/use-active-project";
import { Button } from "@/components/ui/button";
import { CareMapLogo } from "@/components/shared/caremap-logo";

export function TopBar() {
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const { project } = useActiveProject();

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 sm:gap-4 border-b border-cm-border-primary bg-cm-bg-surface px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <Link
          to="/"
          className="shrink-0 transition-opacity hover:opacity-80"
        >
          <CareMapLogo size={22} textClassName="text-cm-text-primary" />
        </Link>
        <span className="hidden sm:inline shrink-0 rounded bg-cm-accent-subtle px-1.5 py-0.5 text-xs font-medium text-cm-accent">
          alpha
        </span>
        {project && (
          <>
            <ChevronRight className="h-4 w-4 shrink-0 text-cm-text-tertiary" />
            <Link
              to={`/projects/${project.id}/canvas`}
              className="truncate text-sm text-cm-text-secondary transition-colors hover:text-cm-text-primary max-w-[120px] sm:max-w-none"
            >
              {project.name}
            </Link>
          </>
        )}
      </div>

      {/* Desktop search bar */}
      <button
        type="button"
        data-tour="search-bar"
        className="hidden md:flex w-[240px] lg:w-[320px] shrink-0 items-center gap-2 rounded-md border border-cm-border-primary bg-cm-bg-elevated px-3 py-2 text-left text-sm text-cm-text-tertiary transition-colors hover:bg-cm-bg-hover"
        aria-label="Search or ask"
      >
        <Search className="size-4 shrink-0" />
        <span className="flex-1">Search or ask...</span>
        <kbd className="rounded border border-cm-border-subtle bg-cm-bg-surface px-1.5 py-0.5 text-xs text-cm-text-tertiary">
          ⌘K
        </kbd>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        {/* Mobile search icon */}
        <Button
          variant="ghost"
          size="icon"
          className="flex md:hidden"
          aria-label="Search"
        >
          <Search className="size-4" />
        </Button>

        {project && (
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePanel}
            aria-label="Toggle agent panel"
            data-tour="agent-toggle"
          >
            <MessageSquare className="size-4 md:hidden" />
            <PanelRight className="hidden md:block size-4" />
          </Button>
        )}
      </div>
    </header>
  );
}
