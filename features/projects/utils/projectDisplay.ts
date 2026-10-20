import { PLATFORM_LABELS } from "../../create-project/constants/platforms";
import type { Project, ProjectStatus } from "../types/projects";

/** User-facing text for each lifecycle state that needs calling out. */
const STATUS_LABELS: Partial<Record<ProjectStatus, string>> = {
  generating: "Generating your project…",
  failed: "Generation failed",
};

/** Short, always-present status for screen readers. */
const ACCESSIBILITY_STATUS_LABELS: Record<ProjectStatus, string> = {
  generating: "Generating",
  ready: "Ready",
  failed: "Generation failed",
};

/** "Generating" / "Ready" / "Generation failed", for accessibility labels. */
export function getProjectAccessibilityStatus(project: Project): string {
  return ACCESSIBILITY_STATUS_LABELS[project.status];
}

/** Generated tech stack when it exists, otherwise the chosen platforms. */
export function getProjectSubtitle(project: Project): string {
  if (project.techStack?.length) return project.techStack.join(" · ");
  return (project.platforms ?? []).map((platform) => PLATFORM_LABELS[platform]).join(" · ");
}

/** "Generating your project…" / "Generation failed"; null once ready. */
export function getProjectStatusLabel(project: Project): string | null {
  return STATUS_LABELS[project.status] ?? null;
}

export function getProjectCaption(project: Project, createdLabel: string): string {
  const created = `Created ${createdLabel}`;
  const statusLabel = getProjectStatusLabel(project);
  return statusLabel ? `${created} · ${statusLabel}` : created;
}
