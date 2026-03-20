import { Outlet } from "react-router-dom";
import { Toaster } from "sonner";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { ErrorBoundary } from "@/components/shared/error-boundary";

export default function App() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cm-bg-app">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex flex-1 flex-col overflow-hidden pb-14 md:pb-0">
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>
      <Toaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          className: "text-sm",
        }}
      />
    </div>
  );
}
