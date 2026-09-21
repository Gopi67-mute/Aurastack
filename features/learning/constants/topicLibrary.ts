import type { TopicContent } from "../types/learning";

export interface TopicLibraryEntry {
  id: string;
  title: string;
  /** Always part of the curriculum, regardless of the project's stack. */
  always?: boolean;
  /** Lowercase terms matched against the project's stack, platforms and idea. */
  keywords: readonly string[];
  /** Lesson body, personalised with the project name. */
  content: (projectName: string) => TopicContent;
}

const MOBILE = ["react native", "expo", "android", "ios", "mobile"];
const FRONTEND = [...MOBILE, "react", "web", "next"];

/**
 * V1 placeholder for AI-generated learning content. Order here is learning
 * order. Replaced by the backend generation once `POST /projects/generate`
 * returns a curriculum.
 */
export const TOPIC_LIBRARY: readonly TopicLibraryEntry[] = [
  {
    id: "architecture-planning",
    title: "Planning your architecture",
    always: true,
    keywords: [],
    content: (name) => ({
      what: "Deciding how the parts of an app (screens, API, database) fit together before writing code.",
      why: `${name} will grow feature by feature; a clear structure keeps each change small and safe.`,
      how: "Split the app into layers with one responsibility each, and let data flow in one direction between them.",
      example: "Screens call services, services call the API, and only the API touches the database.",
      apply: `Sketch the main screens and data of ${name} and note which layer owns each piece.`,
      miniTask: `List the three core features of ${name} and the data each one needs.`,
    }),
  },
  {
    id: "react-fundamentals",
    title: "React fundamentals",
    keywords: FRONTEND,
    content: (name) => ({
      what: "Building interfaces from components, props and state.",
      why: `Every screen of ${name} is a tree of components, so this is the foundation for the whole UI.`,
      how: "Components return UI. Props flow down, state lives in hooks, and a state change re-renders what depends on it.",
      example: "A ProjectCard component receives a project prop and renders its name and progress.",
      apply: `The screens of ${name} are composed from small reusable typed components.`,
      miniTask: `Build one reusable card component for the main item in ${name}.`,
    }),
  },
  {
    id: "navigation-routing",
    title: "Navigation and routing",
    keywords: [...MOBILE, "next", "react router"],
    content: (name) => ({
      what: "Moving between screens and passing data such as ids through the URL.",
      why: `Users of ${name} move between lists, details and forms, so navigation has to be predictable.`,
      how: "Each file maps to a route, brackets declare dynamic params, and layouts group screens into tabs or stacks.",
      example: "A route like /items/[itemId] opens the detail screen for whichever id is in the URL.",
      apply: `${name} needs a list screen and a detail screen that reads its id from the route.`,
      miniTask: "Add a dynamic detail route and read its id param.",
    }),
  },
  {
    id: "state-management",
    title: "State management",
    keywords: [...MOBILE, "zustand", "redux"],
    content: (name) => ({
      what: "Sharing client state between screens without passing props through every level.",
      why: `Parts of ${name} (like the current user or selection) are needed on several screens at once.`,
      how: "Keep shared state in a small store; components subscribe only to the slices they use.",
      example: "A store exposes the selected item and an action to change it; the header reads just the name.",
      apply: `Keep shared UI state of ${name} in a store, and treat the server as the source of truth for data.`,
      miniTask: "Move one piece of state used by two screens into a store.",
    }),
  },
  {
    id: "node-express",
    title: "Building a Node and Express server",
    keywords: ["node", "express"],
    content: (name) => ({
      what: "Writing an HTTP server with routes and middleware in Node.js.",
      why: `${name} needs a backend to hold rules and data that the client should not own.`,
      how: "Routes receive requests, middleware handles cross-cutting work such as auth, and handlers return JSON.",
      example: "A GET /items route reads items from the database and returns them as JSON.",
      apply: `Expose the core resources of ${name} as small, focused routes.`,
      miniTask: "Create one GET route that returns a hardcoded list as JSON.",
    }),
  },
  {
    id: "fastapi-async",
    title: "FastAPI and async Python",
    keywords: ["fastapi", "python"],
    content: (name) => ({
      what: "Building async APIs in Python with typed request and response models.",
      why: `${name} needs a fast, validated backend, and FastAPI checks data at the edge for you.`,
      how: "Route functions declare typed parameters and models; async handlers keep the server responsive during I/O.",
      example: "An async GET /items handler awaits the database and returns a validated response model.",
      apply: `Define request and response models for the main resources of ${name}.`,
      miniTask: "Write one async endpoint with a Pydantic response model.",
    }),
  },
  {
    id: "rest-api-design",
    title: "REST API design",
    keywords: ["api", "rest", "backend", "server", "node", "express", "fastapi"],
    content: (name) => ({
      what: "Designing predictable HTTP endpoints around resources, methods and status codes.",
      why: `A consistent API makes ${name} easier to build, test and extend.`,
      how: "Use nouns for resources, HTTP methods for actions, and proper status codes for outcomes.",
      example: "GET /items lists, POST /items creates, PATCH /items/{id} updates, DELETE /items/{id} removes.",
      apply: `Map each core feature of ${name} to a resource and its endpoints.`,
      miniTask: `Write the endpoint list for the main resource of ${name}.`,
    }),
  },
  {
    id: "mongodb-data-modeling",
    title: "MongoDB data modeling",
    keywords: ["mongo", "database", "nosql"],
    content: (name) => ({
      what: "Structuring documents and collections so common reads are fast and simple.",
      why: `How ${name} stores its data decides how easily it can query and grow.`,
      how: "Embed data that is read together, reference data that grows or is shared, and index the fields you query.",
      example: "An order document embeds its line items but references the user by id.",
      apply: `Choose one collection per core resource of ${name} and decide what to embed.`,
      miniTask: "Draft one document shape and mark the field you will query most.",
    }),
  },
  {
    id: "authentication",
    title: "Authentication",
    keywords: ["auth", "clerk", "jwt", "login", "sign in", "sign up", "account", "users"],
    content: (name) => ({
      what: "Proving who a user is and limiting what they can access.",
      why: `${name} has user-specific data that must never be visible to anyone else.`,
      how: "A provider signs the user in and issues a token; the backend verifies it on every protected request.",
      example: "The app sends a bearer token; the API rejects expired or invalid tokens with 401.",
      apply: `Verify the token on every ${name} endpoint and check that the user owns the resource.`,
      miniTask: "List which endpoints must be protected and which can stay public.",
    }),
  },
  {
    id: "testing-basics",
    title: "Testing the essentials",
    always: true,
    keywords: [],
    content: (name) => ({
      what: "Automated checks that confirm important behaviour keeps working.",
      why: `Tests let you change ${name} without fear of silently breaking features.`,
      how: "Test pure logic with unit tests, and the critical user flows with a few integration tests.",
      example: "A unit test checks that a progress percentage is computed correctly for edge cases.",
      apply: `Start with the business rules of ${name} that would hurt most if they broke.`,
      miniTask: "Write one test for a pure function in your project.",
    }),
  },
  {
    id: "deployment",
    title: "Deployment",
    always: true,
    keywords: [],
    content: (name) => ({
      what: "Getting the app and its backend running for real users.",
      why: `${name} only creates value once people can use it.`,
      how: "Keep secrets in environment variables, build reproducibly, and use separate development and production setups.",
      example: "The backend runs in a Docker image on a host; the app is built with separate dev and production profiles.",
      apply: `Plan how ${name} will ship: where the backend runs and how the app is distributed.`,
      miniTask: "List every environment variable your project needs.",
    }),
  },
];
