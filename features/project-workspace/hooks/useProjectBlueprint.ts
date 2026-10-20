import { useCallback, useEffect, useRef, useState } from "react";

import { useStableGetToken } from "../../../hooks/useStableGetToken";
import { ApiError } from "../../../lib/api";
import { toErrorMessage } from "../../../lib/remoteData";
import {
  GENERATION_POLL_INTERVAL_MS,
  GENERATION_POLL_MAX_MS,
} from "../../../store/useProjectStore";
import { generateProjectBlueprint } from "../services/generateProjectBlueprint";
import { getProjectBlueprint } from "../services/getProjectBlueprint";
import type {
  BlueprintLoadStatus,
  ProjectBlueprintContent,
  ProjectBlueprintResponse,
} from "../types/blueprint";

const LOAD_ERROR = "Couldn't load your blueprint.";
const START_ERROR = "Couldn't start generating your blueprint. Please try again.";

interface BlueprintState {
  projectId: string;
  status: Exclude<BlueprintLoadStatus, "idle">;
  blueprint: ProjectBlueprintContent | null;
  error: string | null;
}

/**
 * One pass of following a project's blueprint. Every start replaces it and
 * stop drops it; anything that settles for a run that is no longer current is
 * ignored, so a late response can never update another project or a hidden
 * section.
 */
interface Run {
  /** An explicit retry: a "failed" blueprint may be regenerated. */
  retry: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  /** When polling gives up; null until a generation is being followed. */
  deadline: number | null;
}

export interface UseProjectBlueprintResult {
  status: BlueprintLoadStatus;
  /** Set while `status` is "ready". */
  blueprint: ProjectBlueprintContent | null;
  /** User-facing message while `status` is "error". */
  error: string | null;
  /** Explicit "Try again": re-reads and, if needed, generates once more. */
  retry: () => void;
  /** Re-reads the server's state without requesting a generation. */
  refresh: () => void;
}

/**
 * Follows a project's blueprint while `enabled` (a blueprint section is open
 * on a ready project). Local to the workspace: no store.
 *
 * Reads first, and only asks the backend to generate when the blueprint is
 * missing, at most once until the user explicitly retries. While generating
 * it re-reads every GENERATION_POLL_INTERVAL_MS, and stops after
 * GENERATION_POLL_MAX_MS (past the server's lease, see useProjectStore) with
 * a recoverable "timedOut". A failed blueprint is never regenerated on its
 * own. A 409 from generation means the server already moved on, so it just
 * re-reads. Ready content stays on screen when a later read fails.
 */
export function useProjectBlueprint(
  projectId: string | undefined,
  enabled: boolean,
): UseProjectBlueprintResult {
  const getToken = useStableGetToken();
  const [state, setState] = useState<BlueprintState | null>(null);
  const runRef = useRef<Run | null>(null);
  /**
   * The project this hook already asked to generate. Guards against duplicate
   * POSTs from repeated "missing" reads, re-renders and remounted effects; only
   * an explicit retry, or seeing the blueprint ready, clears it.
   */
  const requestedRef = useRef<string | null>(null);

  const stop = useCallback(() => {
    const run = runRef.current;
    if (run?.timer) clearTimeout(run.timer);
    runRef.current = null;
  }, []);

  const start = useCallback(
    (id: string, retry: boolean) => {
      stop();
      const run: Run = { retry, timer: null, deadline: null };
      runRef.current = run;
      const isCurrent = () => runRef.current === run;

      const show = (status: BlueprintState["status"], extra: Partial<BlueprintState> = {}) =>
        setState({ projectId: id, status, blueprint: null, error: null, ...extra });

      const followGeneration = () => {
        run.deadline ??= Date.now() + GENERATION_POLL_MAX_MS;
        if (Date.now() >= run.deadline) {
          show("timedOut");
          return;
        }
        setState((prev) =>
          prev?.projectId === id && prev.status === "generating"
            ? prev
            : { projectId: id, status: "generating", blueprint: null, error: null },
        );
        run.timer = setTimeout(() => {
          run.timer = null;
          void read();
        }, GENERATION_POLL_INTERVAL_MS);
      };

      const generate = async () => {
        requestedRef.current = id;
        run.deadline = Date.now() + GENERATION_POLL_MAX_MS;
        show("generating");
        let response: ProjectBlueprintResponse;
        try {
          response = await generateProjectBlueprint(id, getToken);
        } catch (err) {
          if (!isCurrent()) return;
          // Claimed elsewhere, already current, or the project changed: resync.
          if (err instanceof ApiError && err.status === 409) {
            void read();
            return;
          }
          run.deadline = null;
          show("error", { error: toErrorMessage(err, START_ERROR) });
          return;
        }
        if (isCurrent()) receive(response);
      };

      const receive = (response: ProjectBlueprintResponse) => {
        switch (response.status) {
          case "ready":
            if (!response.blueprint) {
              show("error", { error: LOAD_ERROR });
              return;
            }
            requestedRef.current = null;
            show("ready", { blueprint: response.blueprint });
            return;
          case "generating":
            followGeneration();
            return;
          case "failed":
            if (run.retry && requestedRef.current !== id) void generate();
            else show("failed");
            return;
          case "missing":
            // Already requested and still missing: wait for the user, never loop.
            if (requestedRef.current !== id) void generate();
            else show("error", { error: START_ERROR });
            return;
        }
      };

      const read = async () => {
        let response: ProjectBlueprintResponse;
        try {
          response = await getProjectBlueprint(id, getToken);
        } catch (err) {
          if (!isCurrent()) return;
          // While following a generation a failed read is not surfaced; the next poll retries.
          if (run.deadline !== null) {
            followGeneration();
            return;
          }
          setState((prev) =>
            prev?.projectId === id && prev.status === "ready"
              ? prev
              : { projectId: id, status: "error", blueprint: null, error: toErrorMessage(err, LOAD_ERROR) },
          );
          return;
        }
        if (isCurrent()) receive(response);
      };

      // Content already on screen stays there while it is re-read.
      setState((prev) =>
        prev?.projectId === id && prev.status === "ready"
          ? prev
          : { projectId: id, status: "loading", blueprint: null, error: null },
      );
      void read();
    },
    [getToken, stop],
  );

  useEffect(() => {
    if (!enabled || !projectId) return;
    start(projectId, false);
    return stop;
  }, [enabled, projectId, start, stop]);

  const retry = useCallback(() => {
    if (!enabled || !projectId) return;
    requestedRef.current = null;
    start(projectId, true);
  }, [enabled, projectId, start]);

  const refresh = useCallback(() => {
    if (!enabled || !projectId) return;
    start(projectId, false);
  }, [enabled, projectId, start]);

  const active = enabled && Boolean(projectId);
  const current = active && state?.projectId === projectId ? state : null;

  return {
    status: active ? (current?.status ?? "loading") : "idle",
    blueprint: current?.blueprint ?? null,
    error: current?.error ?? null,
    retry,
    refresh,
  };
}
