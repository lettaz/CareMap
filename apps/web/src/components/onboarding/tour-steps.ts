export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

export interface TourStep {
  id: string;
  target: string | null;
  title: string;
  description: string;
  placement: TourPlacement;
  navigateTo?: string;
}

export function buildTourSteps(projectId: string): TourStep[] {
  const base = `/projects/${projectId}`;

  return [
    {
      id: "welcome",
      target: null,
      title: "Welcome to CareMap",
      description:
        "Your AI-powered data harmonization platform. We'll walk you through the key features in under a minute.",
      placement: "center",
      navigateTo: `${base}/canvas`,
    },
    {
      id: "sidebar",
      target: "sidebar-nav",
      title: "Navigation",
      description:
        "Switch between Canvas, Dashboard, and Settings for your project. The canvas is where the magic happens.",
      placement: "right",
    },
    {
      id: "canvas",
      target: "canvas-area",
      title: "Pipeline Canvas",
      description:
        "Design your data pipeline here. Drag and connect nodes to build a flow from raw sources to clean, validated output.",
      placement: "center",
    },
    {
      id: "add-node",
      target: "node-palette-btn",
      title: "Add Nodes",
      description:
        "Click here to add pipeline nodes — sources, transforms, quality checks, and more.",
      placement: "right",
    },
    {
      id: "pipeline-flow",
      target: null,
      title: "The Pipeline Flow",
      description:
        "Source \u2192 Transform \u2192 Harmonize \u2192 Quality \u2192 Store. Each node handles a stage of your data journey, from raw ingestion to validated canonical tables.",
      placement: "center",
    },
    {
      id: "agent-toggle",
      target: "agent-toggle",
      title: "AI Assistant",
      description:
        "Toggle the AI agent panel. It helps with profiling data, suggesting schemas, mapping fields, cleaning, and running quality checks.",
      placement: "bottom",
    },
    {
      id: "right-panel",
      target: "right-panel",
      title: "Agent & Inspector",
      description:
        "This panel shows the AI chat or node details when you click a node on the canvas. Use @mentions to reference specific nodes.",
      placement: "left",
    },
    {
      id: "search-bar",
      target: "search-bar",
      title: "Search & Ask",
      description:
        "Quickly search across your project or ask the AI agent questions with \u2318K.",
      placement: "bottom",
    },
    {
      id: "nav-dashboard",
      target: "nav-dashboard",
      title: "Dashboard",
      description:
        "Head to the Dashboard for data quality monitoring, KPIs, and pinned insights.",
      placement: "right",
      navigateTo: `${base}/dashboard`,
    },
    {
      id: "dashboard-overview",
      target: "dashboard-kpis",
      title: "Quality at a Glance",
      description:
        "Track key metrics — total sources, mapping coverage, quality scores, and active alerts — all in one place.",
      placement: "bottom",
    },
    {
      id: "dashboard-tabs",
      target: "dashboard-tabs",
      title: "Overview & Insights",
      description:
        "Switch between the quality overview and AI-generated insights pinned from your chat conversations.",
      placement: "bottom",
    },
    {
      id: "complete",
      target: null,
      title: "You're all set!",
      description:
        "Start by adding source nodes, connecting them to a Transform, and let the AI guide you through mapping and harmonization. You can replay this tour from Settings anytime.",
      placement: "center",
      navigateTo: `${base}/canvas`,
    },
  ];
}
