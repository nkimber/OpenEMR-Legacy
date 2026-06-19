import type {
  ArchitectureDecision,
  ArchitectureDiagram,
  ArchitectureLayer,
  ArchitectureModel,
  ArchitectureSystem,
  ArchitectureSystemSummary,
  ArchitectureTechnology
} from "./types";

const colors = ["#0f766e", "#2563eb", "#9333ea", "#c2410c", "#047857", "#be123c"];

export function buildArchitectureModel(summaries: ArchitectureSystemSummary[]): ArchitectureModel {
  const systems = summaries.map((summary) => enrichSystem(summary));

  return {
    systems,
    layers: buildLayers(systems),
    topology: buildTopology(systems),
    decisions: buildDecisions(systems)
  };
}

function enrichSystem(summary: ArchitectureSystemSummary): ArchitectureSystem {
  const technologies = summary.stack.map((item, index) => technologyFromStackItem(item, index));

  return {
    ...summary,
    purpose: purposeForSystem(summary),
    architecturePattern: patternForSystem(summary),
    runtime: runtimeForSystem(summary),
    dataOwnership: summary.database,
    technologies,
    diagram: {
      title: `${summary.name} Runtime`,
      subtitle: summary.status,
      nodes: [
        {
          id: `${summary.id}-runtime`,
          title: summary.name,
          subtitle: summary.businessLogic,
          technologies
        }
      ],
      edges: []
    },
    narratives: [
      {
        title: "Business Logic",
        body: summary.businessLogic
      },
      {
        title: "Verification",
        body: summary.tests.join(" ")
      }
    ],
    responsibilities: [summary.businessLogic],
    evidence: summary.tests
  };
}

function buildLayers(systems: ArchitectureSystem[]): ArchitectureLayer[] {
  return [
    {
      id: "runtime",
      label: "Runtime",
      summary: "Application runtime and delivery stack.",
      cells: systems.map((system) => ({
        systemId: system.id,
        detail: system.runtime,
        technologies: system.technologies
      }))
    },
    {
      id: "data",
      label: "Data",
      summary: "Primary persistence and ownership model.",
      cells: systems.map((system) => ({
        systemId: system.id,
        detail: system.dataOwnership,
        technologies: system.technologies.filter((technology) => technology.name.toLowerCase().includes("sql"))
      }))
    },
    {
      id: "validation",
      label: "Validation",
      summary: "Current automated evidence for each system.",
      cells: systems.map((system) => ({
        systemId: system.id,
        detail: system.tests.join(" "),
        technologies: []
      }))
    }
  ];
}

function buildTopology(systems: ArchitectureSystem[]): ArchitectureDiagram {
  return {
    title: "Modernization Topology",
    subtitle: "Legacy baseline, Workbench orchestration, and modernized target.",
    nodes: systems.map((system) => ({
      id: system.id,
      title: system.name,
      subtitle: system.status,
      technologies: system.technologies
    })),
    edges: buildTopologyEdges(systems)
  };
}

function buildTopologyEdges(systems: ArchitectureSystem[]) {
  const hasWorkbench = systems.some((system) => system.id === "modernization-workbench");
  if (!hasWorkbench) {
    return [];
  }

  return systems
    .filter((system) => system.id !== "modernization-workbench")
    .map((system) => ({
      from: "modernization-workbench",
      to: system.id,
      label: "orchestrates and reports"
    }));
}

function buildDecisions(systems: ArchitectureSystem[]): ArchitectureDecision[] {
  return [
    {
      title: "Behavioral parity first",
      detail: "Modernized slices are accepted when shared parity evidence matches the legacy baseline."
    },
    {
      title: "Side-by-side operation",
      detail: `The Workbench tracks ${systems.length} systems so legacy and modernized behavior can be compared without replacing the baseline prematurely.`
    }
  ];
}

function technologyFromStackItem(item: string, index: number): ArchitectureTechnology {
  const match = /^(.*?)(?:\s+(\d+(?:\.\d+)*))?$/.exec(item.trim());
  const name = match?.[1]?.trim() || item;
  const version = match?.[2] ?? "Current";

  return {
    id: `${slugify(name)}-${index}`,
    name,
    version,
    detail: item,
    logoText: initials(name),
    color: colors[index % colors.length]
  };
}

function purposeForSystem(summary: ArchitectureSystemSummary) {
  if (summary.id === "legacy-openemr") {
    return "Original OpenEMR baseline used as the modernization behavior reference.";
  }

  if (summary.id === "modernized-openemr") {
    return "From-scratch implementation that preserves selected OpenEMR workflows on the modern stack.";
  }

  if (summary.id === "modernization-workbench") {
    return "Oversight and orchestration surface for lifecycle, evidence, and comparison workflows.";
  }

  return summary.businessLogic;
}

function patternForSystem(summary: ArchitectureSystemSummary) {
  if (summary.id === "legacy-openemr") {
    return "Legacy monolithic PHP application.";
  }

  if (summary.id === "modernized-openemr") {
    return "React SPA plus ASP.NET Core API and PostgreSQL.";
  }

  if (summary.id === "modernization-workbench") {
    return "React and Express local orchestration application.";
  }

  return summary.stack.join(", ");
}

function runtimeForSystem(summary: ArchitectureSystemSummary) {
  return summary.stack.join(" / ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function initials(value: string) {
  const parts = value.split(/\s+/).filter(Boolean);
  if (!parts.length) {
    return "?";
  }

  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
