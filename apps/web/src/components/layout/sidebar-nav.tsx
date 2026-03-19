import { NavLink } from "react-router-dom";
import { Workflow, LayoutDashboard, FolderOpen } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActiveProject } from "@/hooks/use-active-project";
import { cn } from "@/lib/utils";

export function SidebarNav() {
  const { projectId } = useActiveProject();

  if (!projectId) return null;

  const navItems = [
    { to: `/projects/${projectId}/canvas`, icon: Workflow, label: "Canvas" },
    { to: `/projects/${projectId}/dashboard`, icon: LayoutDashboard, label: "Dashboard" },
  ];

  return (
    <nav className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-cm-border-primary bg-cm-bg-surface pt-3">
      <Tooltip>
        <TooltipTrigger>
          <NavLink
            to="/"
            className="flex size-10 items-center justify-center rounded-md text-cm-text-tertiary transition-colors hover:bg-cm-bg-elevated hover:text-cm-text-secondary"
          >
            <FolderOpen className="size-5" />
          </NavLink>
        </TooltipTrigger>
        <TooltipContent side="right">All Projects</TooltipContent>
      </Tooltip>

      <div className="mx-auto my-1 h-px w-6 bg-cm-border-primary" />

      {navItems.map(({ to, icon: Icon, label }) => (
        <Tooltip key={to}>
          <TooltipTrigger>
            <NavLink
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex size-10 items-center justify-center rounded-md transition-colors",
                  isActive
                    ? "bg-cm-accent-subtle text-cm-accent"
                    : "text-cm-text-tertiary hover:bg-cm-bg-elevated hover:text-cm-text-secondary"
                )
              }
            >
              <Icon className="size-5" />
            </NavLink>
          </TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      ))}
    </nav>
  );
}
