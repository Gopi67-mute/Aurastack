import { fireEvent, render, screen } from "@testing-library/react-native";

import { colors } from "../../../theme/colors";
import { SECTION_ACCENTS, WORKSPACE_SECTIONS } from "../constants/sections";
import type { WorkspaceSectionKey } from "../types/workspace";
import { WorkspaceTabs } from "./WorkspaceTabs";

// lucide's ESM build is not transformed by Jest; icons are irrelevant here.
jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

describe("section accents", () => {
  it("gives every section its own accent from the theme tokens", () => {
    const accents = WORKSPACE_SECTIONS.map((section) => section.accent);

    expect(new Set(accents.map((accent) => accent.color)).size).toBe(WORKSPACE_SECTIONS.length);
    expect(SECTION_ACCENTS).toEqual({
      techStack: expect.objectContaining({ color: colors.section.techStack, text: "text-section-tech" }),
      roadmap: expect.objectContaining({ color: colors.section.roadmap, text: "text-section-roadmap" }),
      architecture: expect.objectContaining({
        color: colors.section.architecture,
        text: "text-section-architecture",
      }),
      learning: expect.objectContaining({ color: colors.section.learning, text: "text-section-learning" }),
    });
  });

  it("never reuses a semantic feedback color as a section accent", () => {
    const semantic = new Set(Object.values(colors.semantic).map((value) => value.toLowerCase()));

    for (const color of Object.values(colors.section)) {
      expect(semantic.has(color.toLowerCase())).toBe(false);
    }
  });
});

describe("WorkspaceTabs", () => {
  it.each(WORKSPACE_SECTIONS.map((section) => [section.key, section.label] as const))(
    "styles the selected %s tab with its own accent only",
    (key: WorkspaceSectionKey, label: string) => {
      render(<WorkspaceTabs active={key} onChange={jest.fn()} />);

      for (const section of WORKSPACE_SECTIONS) {
        const tab = screen.getByRole("tab", { name: section.label });
        const selected = section.key === key;
        expect(tab.props.accessibilityState).toEqual({ selected });
        expect(tab.props.className.includes(section.accent.softBg)).toBe(selected);
        expect(screen.getByText(section.label).props.className).toContain(
          selected ? section.accent.text : "text-n300",
        );
      }
      expect(screen.getByRole("tab", { name: label })).toBeTruthy();
    },
  );

  it("reports the tab the user picks", () => {
    const onChange = jest.fn();
    render(<WorkspaceTabs active="techStack" onChange={onChange} />);

    fireEvent.press(screen.getByRole("tab", { name: "Roadmap" }));

    expect(onChange).toHaveBeenCalledWith("roadmap");
  });
});
