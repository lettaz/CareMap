import { Outlet } from "react-router-dom";
import { TopBar } from "@/components/layout/top-bar";

export default function App() {
  return (
    <div className="flex h-screen flex-col bg-cm-bg-app overflow-hidden">
      <TopBar />
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
