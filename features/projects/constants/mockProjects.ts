import type { Project } from "../types/projects";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysAgo(days: number): string {
  return new Date(Date.now() - days * MS_PER_DAY).toISOString();
}

/**
 * V1 seed for the project store and the single source of mock projects
 * (Home reads them through the store). Placeholder for the future
 * FastAPI → MongoDB Projects API response.
 */
export function createMockProjects(): Project[] {
  return [
    {
      id: "mock-portfolio",
      name: "Portfolio Website",
      status: "ready",
      iconKey: "web",
      techStack: ["React", "Express", "MongoDB"],
      progress: 30,
      createdAt: daysAgo(21),
    },
    {
      id: "mock-ecommerce",
      name: "E-Commerce Platform",
      status: "ready",
      iconKey: "commerce",
      techStack: ["React Native", "Node.js", "MongoDB"],
      progress: 75,
      createdAt: daysAgo(3),
    },
    {
      id: "mock-ai-chat",
      name: "AI Chat Application",
      status: "ready",
      iconKey: "chat",
      techStack: ["React Native", "FastAPI", "MongoDB"],
      progress: 52,
      createdAt: daysAgo(7),
    },
  ];
}
