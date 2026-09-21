import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useState } from "react";
import { useForm } from "react-hook-form";

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
 * A successful (currently mock) submit adds the project to the shared
 * project store and sets `savedDraft` for the confirmation view.
 */
export function useCreateProjectForm() {
  const addProject = useProjectStore((state) => state.addProject);
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
      addProject(await submitProjectDraft(values));
      setSavedDraft(values);
    } catch {
      setSubmitError("Couldn't save your project details. Please try again.");
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
