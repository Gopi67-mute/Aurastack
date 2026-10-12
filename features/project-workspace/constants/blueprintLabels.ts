import type { BlueprintComponentKind, BlueprintTechCategory } from "../types/blueprint";

export const TECH_CATEGORY_LABELS: Record<BlueprintTechCategory, string> = {
  frontend: "Frontend",
  backend: "Backend",
  database: "Database",
  authentication: "Authentication",
  ai: "AI",
  storage: "File Storage",
  realtime: "Realtime",
  infrastructure: "Infrastructure",
  testing: "Testing",
  other: "Other",
};

export const COMPONENT_KIND_LABELS: Record<BlueprintComponentKind, string> = {
  client: "Client",
  service: "Service",
  datastore: "Data store",
  external: "External service",
};
