import { api } from "../../../lib/api";
import { generateProjectBlueprint } from "./generateProjectBlueprint";
import { getProjectBlueprint } from "./getProjectBlueprint";

jest.mock("../../../lib/api", () => ({ api: { get: jest.fn(), post: jest.fn() } }));

const mockGet = jest.mocked(api.get);
const mockPost = jest.mocked(api.post);
const getToken = () => Promise.resolve("test-token");

beforeEach(() => {
  mockGet.mockReset().mockResolvedValue({});
  mockPost.mockReset().mockResolvedValue({});
});

describe("blueprint services", () => {
  it("read the blueprint route, encoding the project id", async () => {
    await getProjectBlueprint("team/alpha?x#1", getToken);

    expect(mockGet).toHaveBeenCalledWith("/api/v1/projects/team%2Falpha%3Fx%231/blueprint", getToken);
  });

  it("request generation with no body", async () => {
    await generateProjectBlueprint("p1", getToken);

    expect(mockPost).toHaveBeenCalledWith("/api/v1/projects/p1/blueprint/generation", getToken);
    expect(mockPost.mock.calls[0]).toHaveLength(2);
  });

  it("pass API errors through unchanged", async () => {
    const conflict = Object.assign(new Error("Blueprint generation is already in progress"), { status: 409 });
    mockPost.mockRejectedValue(conflict);

    await expect(generateProjectBlueprint("p1", getToken)).rejects.toBe(conflict);
  });
});
