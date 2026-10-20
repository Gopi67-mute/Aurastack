import { useAuth } from "@clerk/expo";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

import { ApiError } from "../../../lib/api";
import { useProjectStore } from "../../../store/useProjectStore";
import { submitProjectDraft } from "../services/submitProjectDraft";
import {
  createProjectSchema,
  type CreateProjectFormValues,
  type ProjectDraft,
} from "../types/createProject";

const EMPTY_VALUES: CreateProjectFormValues = {
  title: "",
  description: "",
  platforms: [],
};

/**
 * Owns Create Project form state, validation, reset and submission.
 * A successful submit creates the project on the backend, adds it to the
 * shared project store, and sets `savedDraft` for the confirmation view.
 *
 * The project arrives still "generating": the store follows it and refreshes
 * learning once its curriculum is ready, so nothing is reloaded here.
 */
export function useCreateProjectForm() {
  const addProject = useProjectStore((state) => state.addProject);
  const { getToken } = useAuth();
  const form = useForm<CreateProjectFormValues>({
    resolver: zodResolver(createProjectSchema),
    defaultValues: EMPTY_VALUES,
  });
  const [savedDraft, setSavedDraft] = useState<ProjectDraft | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const { handleSubmit, reset, getValues, formState } = form;

  const submit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      addProject(await submitProjectDraft(values, getToken), getToken);
      setSavedDraft(values);
    } catch (err) {
      // ApiError messages are safe, user-facing text set by lib/api.ts or the
      // backend's response envelope — never a token, secret or stack trace —
      // so surfacing them directly helps diagnose real failures (wrong API
      // URL, unreachable server, validation errors) instead of hiding them
      // behind one generic message.
      setSubmitError(
        err instanceof ApiError ? err.message : "Couldn't save your project details. Please try again.",
      );
    }
  });

  // No-op when nothing has been entered and nothing is showing an error.
  const resetForm = useCallback(() => {
    const { title, description, platforms } = getValues();
    const isEmpty = !title && !description && platforms.length === 0;
    if (isEmpty && Object.keys(formState.errors).length === 0 && !submitError) return;
    reset(EMPTY_VALUES);
    setSubmitError(null);
  }, [getValues, formState.errors, reset, submitError]);

  // The saved project already exists in the store, so re-submitting the old
  // values would duplicate it: start a fresh, empty form instead.
  const startNewProject = useCallback(() => {
    reset(EMPTY_VALUES);
    setSavedDraft(null);
  }, [reset]);

  return { form, submit, resetForm, startNewProject, savedDraft, submitError };
}
