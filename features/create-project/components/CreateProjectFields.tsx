import { FileText, LayoutGrid, MessageCircle } from "lucide-react-native";
import { Controller, type UseFormReturn } from "react-hook-form";
import { Text, TextInput, View } from "react-native";

import { colors } from "../../../theme/colors";
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH } from "../constants/limits";
import type { CreateProjectFormValues } from "../types/createProject";
import { FormField } from "./FormField";
import { PlatformSelector } from "./PlatformSelector";

interface CreateProjectFieldsProps {
  form: UseFormReturn<CreateProjectFormValues>;
}

const inputBase = "rounded-lg border bg-n800 px-4 text-body-lg text-white";

export function CreateProjectFields({ form }: CreateProjectFieldsProps) {
  const { control, formState: { errors } } = form;

  return (
    <View className="gap-6">
      <Controller
        control={control}
        name="title"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Project title"
            Icon={FileText}
            hint="e.g. Food Delivery App, E-commerce Platform, AI Chat Application"
            error={errors.title?.message}
          >
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="e.g. Food Delivery App"
              placeholderTextColor={colors.neutral.n300}
              maxLength={TITLE_MAX_LENGTH}
              returnKeyType="next"
              accessibilityLabel="Project title"
              className={`h-14 ${inputBase} ${errors.title ? "border-error" : "border-n600"}`}
            />
          </FormField>
        )}
      />

      <Controller
        control={control}
        name="description"
        render={({ field: { value, onChange, onBlur } }) => (
          <FormField
            label="Project description"
            Icon={MessageCircle}
            hint="Describe what you want to build, who it's for, and the main features you have in mind..."
            error={errors.description?.message}
          >
            <View
              className={`rounded-lg border bg-n800 ${
                errors.description ? "border-error" : "border-n600"
              }`}
            >
              <TextInput
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                placeholder="Describe what you want to build, who it's for, and the main features you have in mind..."
                placeholderTextColor={colors.neutral.n300}
                multiline
                textAlignVertical="top"
                maxLength={DESCRIPTION_MAX_LENGTH}
                accessibilityLabel="Project description"
                className="min-h-36 px-4 pt-3 text-body-lg text-white"
              />
              <Text className="px-4 pb-3 text-right text-body-sm text-n300">
                {value.length}/{DESCRIPTION_MAX_LENGTH}
              </Text>
            </View>
          </FormField>
        )}
      />

      <Controller
        control={control}
        name="platforms"
        render={({ field: { value, onChange } }) => (
          <FormField
            label="Target platform"
            Icon={LayoutGrid}
            hint="Where do you want your project to run?"
            error={errors.platforms?.message}
          >
            <PlatformSelector
              value={value}
              onChange={onChange}
              hasError={Boolean(errors.platforms)}
            />
          </FormField>
        )}
      />
    </View>
  );
}
