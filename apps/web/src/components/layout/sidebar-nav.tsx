import { NavLink, useLocation, useParams } from "react-router-dom";
import { Workflow, LayoutDashboard, FolderOpen, Settings, User } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  matchEnd?: boolean;
  dataTour?: string;
}

function SidebarItem({ to, icon: Icon, label, matchEnd, dataTour }: SidebarItemProps) {
  return (
    <Tooltip>
      <TooltipTrigger>
        <NavLink
          to={to}
          end={matchEnd}
          data-tour={dataTour}
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

function BottomNavItem({ to, icon: Icon, label, matchEnd }: SidebarItemProps) {
  return (
    <NavLink
      to={to}
      end={matchEnd}
      className={({ isActive }) =>
        cn(
          "flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
          isActive
            ? "text-cm-accent"
            : "text-cm-text-tertiary",
        )
      }
    >
      <Icon className="size-5" />
      <span>{label}</span>
    </NavLink>
  );
}

export function SidebarNav() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();

  const isInsideProject =
    projectId != null || location.pathname.startsWith("/projects/");

  return (
    <>
      {/* Desktop sidebar */}
      <nav data-tour="sidebar-nav" className="hidden md:flex w-14 shrink-0 flex-col items-center border-r border-cm-border-primary bg-cm-bg-surface py-3">
        <SidebarItem to="/" icon={FolderOpen} label="All Projects" matchEnd />

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
                dataTour="nav-dashboard"
              />
              <SidebarItem
                to={`/projects/${projectId}/settings`}
                icon={Settings}
                label="Settings"
              />
            </div>
          </>
        )}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger>
            <div className="flex size-8 items-center justify-center rounded-full bg-cm-accent-subtle text-cm-accent cursor-default">
              <User className="size-4" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">Profile</TooltipContent>
        </Tooltip>
      </nav>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-40 flex md:hidden border-t border-cm-border-primary bg-cm-bg-surface pb-[env(safe-area-inset-bottom)]">
        <BottomNavItem to="/" icon={FolderOpen} label="Projects" matchEnd />
        {isInsideProject && projectId && (
          <>
            <BottomNavItem
              to={`/projects/${projectId}/canvas`}
              icon={Workflow}
              label="Canvas"
            />
            <BottomNavItem
              to={`/projects/${projectId}/dashboard`}
              icon={LayoutDashboard}
              label="Dashboard"
            />
            <BottomNavItem
              to={`/projects/${projectId}/settings`}
              icon={Settings}
              label="Settings"
            />
          </>
        )}
      </nav>
    </>
  );
}
