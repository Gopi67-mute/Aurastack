import { completeLearningTopic } from "../../learning/services/completeLearningTopic";
import { api } from "../../../lib/api";
import { retryProjectGeneration } from "./retryProjectGeneration";

jest.mock("../../../lib/api", () => ({ api: { post: jest.fn() } }));

const mockPost = jest.mocked(api.post);
const getToken = () => Promise.resolve("test-token");

beforeEach(() => mockPost.mockReset().mockResolvedValue({}));

describe("ids interpolated into route paths", () => {
  it("are encoded for the generation retry route", async () => {
    await retryProjectGeneration("team/alpha?x#1", getToken);

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/projects/team%2Falpha%3Fx%231/generation/retry",
      getToken,
    );
  });

  it("are encoded for the topic completion route", async () => {
    await completeLearningTopic("team/alpha", "topic/1", getToken);

    expect(mockPost).toHaveBeenCalledWith(
      "/api/v1/projects/team%2Falpha/learning/topic%2F1/complete",
      getToken,
    );
  });

  it("leave UUIDs unchanged", async () => {
    const id = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";

    await retryProjectGeneration(id, getToken);

    expect(mockPost).toHaveBeenCalledWith(`/api/v1/projects/${id}/generation/retry`, getToken);
  });
});
