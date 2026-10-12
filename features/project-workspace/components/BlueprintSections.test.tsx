import { fireEvent, render, screen } from "@testing-library/react-native";

import { architecture, roadmapPhase, techChoice } from "../__fixtures__/blueprint";
import type { BlueprintArchitecture as Architecture } from "../types/blueprint";
import { BlueprintArchitecture } from "./BlueprintArchitecture";
import { BlueprintRoadmap } from "./BlueprintRoadmap";
import { BlueprintTechStack } from "./BlueprintTechStack";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

const markup = () => JSON.stringify(screen.toJSON());

describe("BlueprintTechStack", () => {
  const STACK = [
    techChoice({
      category: "frontend",
      name: "React Native",
      purpose: "Cross-platform mobile UI",
      rationale: "One TypeScript codebase for Android and iOS.",
      alternatives: [{ name: "Flutter", tradeoff: "Choose it for a Dart team." }],
      integrationNotes: "Calls the API only.",
    }),
    techChoice({
      category: "ai",
      name: "Gemini",
      purpose: "Product recommendations",
      rationale: "Structured JSON output for recommendations.",
      alternatives: [],
      integrationNotes: null,
    }),
  ];

  function renderStack(assumptions: string[] = []) {
    return render(
      <BlueprintTechStack summary="An AI shop for Android and iOS." assumptions={assumptions} technologies={STACK} />,
    );
  }

  it("renders each recommendation's category, name, role and rationale", () => {
    renderStack();

    for (const text of [
      "An AI shop for Android and iOS.",
      "Frontend",
      "React Native",
      "Cross-platform mobile UI",
      "One TypeScript codebase for Android and iOS.",
      "AI",
      "Gemini",
      "Structured JSON output for recommendations.",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    expect(screen.getAllByText("Recommended")).toHaveLength(2);
    expect(screen.getAllByText("Why it fits")).toHaveLength(2);
  });

  it("shows alternatives and integration notes only on request", () => {
    renderStack();
    expect(screen.queryByText("Flutter")).toBeNull();
    expect(screen.queryByText("Calls the API only.")).toBeNull();

    const toggle = screen.getByRole("button", { name: "Show alternatives & trade-offs (1) for React Native" });
    expect(toggle.props.accessibilityState).toEqual({ expanded: false });
    fireEvent.press(toggle);

    expect(screen.getByText("Flutter")).toBeTruthy();
    expect(screen.getByText("Choose it for a Dart team.")).toBeTruthy();
    expect(screen.getByText("Calls the API only.")).toBeTruthy();
    fireEvent.press(screen.getByRole("button", { name: "Hide alternatives & trade-offs (1) for React Native" }));
    expect(screen.queryByText("Flutter")).toBeNull();
  });

  it("offers no details toggle for a choice with nothing more to show", () => {
    renderStack();

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("states the assumptions the recommendations rest on", () => {
    renderStack(["Assumes a single store."]);

    expect(screen.getByText("Assumptions")).toBeTruthy();
    expect(screen.getByText("Assumes a single store.")).toBeTruthy();
  });

  it("omits the assumptions note when there are none", () => {
    renderStack();

    expect(screen.queryByText("Assumptions")).toBeNull();
  });

  it("uses the Tech Stack accent", () => {
    renderStack();

    expect(markup()).toContain("border-section-tech/30");
    expect(markup()).toContain("text-section-tech");
  });

  it("explains an empty stack instead of rendering nothing", () => {
    render(<BlueprintTechStack summary="" assumptions={[]} technologies={[]} />);

    expect(screen.getByText("No technologies were recommended for this project.")).toBeTruthy();
  });
});

const ARCHITECTURE: Architecture = architecture({
  style: "Modular monolith",
  overview: "A mobile client talks to one API backed by a document store.",
  components: [
    {
      key: "app",
      name: "Mobile App",
      kind: "client",
      responsibility: "Renders the UI",
      connections: [{ target: "api", interaction: "HTTPS JSON with the session token" }],
    },
    {
      key: "api",
      name: "Order API",
      kind: "service",
      responsibility: "Business logic",
      connections: [
        { target: "db", interaction: "Reads and writes orders" },
        { target: "ai", interaction: "Requests recommendations server-side" },
      ],
    },
    { key: "db", name: "Order database", kind: "datastore", responsibility: "Stores orders", connections: [] },
    { key: "ai", name: "Gemini", kind: "external", responsibility: "Generates suggestions", connections: [] },
  ],
  flows: [
    {
      name: "Place an order",
      steps: [
        { actor: "app", target: "api", action: "Sends the cart" },
        { actor: "api", target: "api", action: "Validates stock" },
        { actor: "api", target: "db", action: "Stores the order" },
      ],
    },
  ],
  failureModes: [{ scenario: "Gemini times out", handling: "The API returns a retryable error" }],
  tradeoffs: ["One API keeps deployment simple"],
});

describe("BlueprintArchitecture", () => {
  it("renders the style and overview", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(screen.getByText("Modular monolith")).toBeTruthy();
    expect(screen.getByText(ARCHITECTURE.overview)).toBeTruthy();
  });

  it("renders each component with its kind and responsibility", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(screen.getByText("Mobile App")).toBeTruthy();
    expect(screen.getByText("Client")).toBeTruthy();
    expect(screen.getByText("Renders the UI")).toBeTruthy();
    expect(screen.getByText("Data store")).toBeTruthy();
    expect(screen.getByText("External service")).toBeTruthy();
  });

  it("names each connection's target and says what passes between them", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(screen.getByLabelText("Calls Order API: HTTPS JSON with the session token")).toBeTruthy();
    expect(screen.getByLabelText("Calls Order database: Reads and writes orders")).toBeTruthy();
    expect(screen.getByLabelText("Calls Gemini: Requests recommendations server-side")).toBeTruthy();
  });

  it("falls back to the key of an unknown connection target", () => {
    render(
      <BlueprintArchitecture
        architecture={architecture({
          components: [
            { key: "app", name: "App", kind: "client", responsibility: "r", connections: [{ target: "cdn", interaction: "i" }] },
          ],
        })}
      />,
    );

    expect(screen.getByLabelText("Calls cdn: i")).toBeTruthy();
  });

  it("renders each flow's steps in order between named components", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(screen.getByText("Place an order")).toBeTruthy();
    expect(screen.getByText("Mobile App → Order API")).toBeTruthy();
    // A component acting on its own is named once.
    expect(screen.getAllByText("Order API").length).toBeGreaterThan(0);
    const steps = screen.getAllByLabelText(/^Step \d/).map((node) => node.props.accessibilityLabel);
    expect(steps).toEqual([
      "Step 1: Mobile App to Order API. Sends the cart",
      "Step 2: Order API. Validates stock",
      "Step 3: Order API to Order database. Stores the order",
    ]);
  });

  it("renders failure handling and trade-offs", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(screen.getByText("Gemini times out")).toBeTruthy();
    expect(screen.getByText("The API returns a retryable error")).toBeTruthy();
    expect(screen.getByText("One API keeps deployment simple")).toBeTruthy();
  });

  it("uses the Architecture accent", () => {
    render(<BlueprintArchitecture architecture={ARCHITECTURE} />);

    expect(markup()).toContain("bg-section-architecture/10");
    expect(markup()).toContain("bg-section-architecture");
  });

  it("handles no components, flows, failures or trade-offs", () => {
    render(<BlueprintArchitecture architecture={architecture()} />);

    expect(screen.getByText("No components were described.")).toBeTruthy();
    expect(screen.getByText("No data flow was described.")).toBeTruthy();
    expect(screen.queryByText("Failure Handling")).toBeNull();
    expect(screen.queryByText("Trade-offs")).toBeNull();
  });
});

describe("BlueprintRoadmap", () => {
  const phases = [
    roadmapPhase({
      order: 2,
      title: "Checkout",
      goal: "Take card payments",
      tasks: ["Create the payment intent endpoint", "Build the checkout screen"],
      deliverables: ["Working checkout"],
      acceptanceCriteria: ["A declined card shows an error", "A paid order is stored once"],
      dependsOn: [1],
      techCategories: ["backend", "database"],
      risks: ["Duplicate charges on retry"],
      learning: [{ topicOrder: 3, topicTitle: "Idempotent payments", application: "Guard checkout retries" }],
    }),
    roadmapPhase({ order: 1, title: "Foundation", goal: "Set up the stack", tasks: ["Create the repo", "Add CI"] }),
  ];

  it("renders phases ordered by their order field", () => {
    render(<BlueprintRoadmap phases={phases} />);

    const titles = screen.getAllByRole("header").map((node) => node.props.children);
    expect(titles).toEqual(["Foundation", "Checkout"]);
    expect(screen.getByText("Phase 1")).toBeTruthy();
    expect(screen.getByText("Phase 2")).toBeTruthy();
    expect(screen.getByText("2 phases · 4 tasks, ordered by what each phase depends on.")).toBeTruthy();
  });

  it("shows each goal, dependency and technology category up front", () => {
    render(<BlueprintRoadmap phases={phases} />);

    expect(screen.getByText("Set up the stack")).toBeTruthy();
    expect(screen.getByText("Take card payments")).toBeTruthy();
    expect(screen.getByText("Builds on Phase 1")).toBeTruthy();
    expect(screen.getByText("Backend")).toBeTruthy();
    expect(screen.getByText("Database")).toBeTruthy();
  });

  it("opens the first phase and keeps later phases collapsed until asked", () => {
    render(<BlueprintRoadmap phases={phases} />);

    expect(screen.getByText("Create the repo")).toBeTruthy();
    expect(screen.queryByText("Create the payment intent endpoint")).toBeNull();

    fireEvent.press(screen.getByRole("button", { name: "Show details of phase 2, Checkout" }));

    for (const text of [
      "Create the payment intent endpoint",
      "Working checkout",
      "A declined card shows an error",
      "A paid order is stored once",
      "Duplicate charges on retry",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
  });

  it("links each phase to the curriculum topics it applies", () => {
    render(<BlueprintRoadmap phases={phases} />);
    fireEvent.press(screen.getByRole("button", { name: "Show details of phase 2, Checkout" }));

    expect(screen.getByText("Learn & apply")).toBeTruthy();
    expect(
      screen.getByLabelText("Learning topic 3: Idempotent payments. Guard checkout retries"),
    ).toBeTruthy();
    expect(markup()).toContain("bg-section-learning/10");
  });

  it("uses the Roadmap accent", () => {
    render(<BlueprintRoadmap phases={phases} />);

    expect(markup()).toContain("bg-section-roadmap");
    expect(markup()).toContain("border-section-roadmap/30");
  });

  it("tracks no progress: its only controls are detail toggles", () => {
    render(<BlueprintRoadmap phases={phases} />);

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    for (const button of screen.getAllByRole("button")) {
      expect(button.props.accessibilityLabel).toMatch(/^(Show|Hide) details of phase/);
    }
  });

  it("explains an empty roadmap", () => {
    render(<BlueprintRoadmap phases={[]} />);

    expect(screen.getByText("No roadmap phases were planned.")).toBeTruthy();
  });

  it("does not mutate the phases it is given", () => {
    const given = [...phases];
    render(<BlueprintRoadmap phases={given} />);

    expect(given.map((phase) => phase.order)).toEqual([2, 1]);
  });
});
