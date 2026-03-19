import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/top-bar";
import { SidebarNav } from "@/components/layout/sidebar-nav";

export default function App() {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-cm-bg-app">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <SidebarNav />
        <main className="flex flex-1 flex-col overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
