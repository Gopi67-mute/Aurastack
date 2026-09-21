import { PLATFORM_LABELS } from "../../create-project/constants/platforms";
import type { Project } from "../types/projects";

/** Generated tech stack when it exists, otherwise the chosen platforms. */
export function getProjectSubtitle(project: Project): string {
  if (project.techStack?.length) return project.techStack.join(" · ");
  return (project.platforms ?? []).map((platform) => PLATFORM_LABELS[platform]).join(" · ");
}

export function getProjectCaption(project: Project, createdLabel: string): string {
  const created = `Created ${createdLabel}`;
  return project.status === "preparing" ? `${created} · Preparing your project` : created;
}
