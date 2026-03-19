import { NavLink, useLocation } from "react-router-dom";
import { Workflow, LayoutDashboard, FolderOpen, Settings } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveProject } from "@/hooks/use-active-project";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matchEnd?: boolean;
}

function SidebarItem({ to, icon: Icon, label, matchEnd }: SidebarItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <NavLink
          to={to}
          end={matchEnd}
          className={({ isActive }) =>
            cn(
              "flex size-10 items-center justify-center rounded-md transition-colors",
              isActive
                ? "bg-cm-accent-subtle text-cm-accent"
                : "text-cm-text-tertiary hover:bg-cm-bg-elevated hover:text-cm-text-secondary",
            )
          }
        >
          <Icon className="size-5" />
        </NavLink>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

export function SidebarNav() {
  const { projectId } = useActiveProject();
  const location = useLocation();

  const isInsideProject =
    projectId != null || location.pathname.startsWith("/projects/");

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center border-r border-cm-border-primary bg-cm-bg-surface py-3">
      {/* ── Global: Home ── */}
      <SidebarItem to="/" icon={FolderOpen} label="All Projects" matchEnd />

      {/* ── Project-contextual items ── */}
      {isInsideProject && projectId && (
        <>
          <div className="mx-auto my-2 h-px w-6 bg-cm-border-primary" />
          <div className="flex flex-col items-center gap-1">
            <SidebarItem
              to={`/projects/${projectId}/canvas`}
              icon={Workflow}
              label="Canvas"
            />
            <SidebarItem
              to={`/projects/${projectId}/dashboard`}
              icon={LayoutDashboard}
              label="Dashboard"
            />
          </div>
        </>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Global: Settings (pinned to bottom) ── */}
      <SidebarItem to="/settings" icon={Settings} label="Settings" />
    </nav>
  );
}
