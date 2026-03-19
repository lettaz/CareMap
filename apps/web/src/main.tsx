import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import App from "./app";
import ProjectsPage from "@/routes/projects";
import ProjectShell from "@/routes/project-shell";
import CanvasPage from "@/routes/canvas";
import DashboardPage from "@/routes/dashboard";
import SettingsPage from "@/routes/settings";
import "./index.css";

const router = createBrowserRouter([
  {
    element: <App />,
    children: [
      { index: true, element: <ProjectsPage /> },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "projects/:projectId",
    element: <ProjectShell />,
    children: [
      { index: true, element: <Navigate to="canvas" replace /> },
      { path: "canvas", element: <CanvasPage /> },
      { path: "dashboard", element: <DashboardPage /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TooltipProvider>
      <RouterProvider router={router} />
    </TooltipProvider>
  </StrictMode>
);
