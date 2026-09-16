import { zodResolver } from "@hookform/resolvers/zod";
import { Mail } from "lucide-react-native";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, TextInput, View } from "react-native";
import { z } from "zod";

const emailSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Enter your email address")
    .email("Enter a valid email address"),
});

type EmailFormValues = z.infer<typeof emailSchema>;

type EmailContinueFormProps = {
  onSubmitEmail: (email: string) => void;
};

export function EmailContinueForm({ onSubmitEmail }: EmailContinueFormProps) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: "" },
  });

  function onSubmit(values: EmailFormValues) {
    onSubmitEmail(values.email);
  }

  return (
    <View className="w-full">
      <Controller
        control={control}
        name="email"
        render={({ field: { value, onChange, onBlur } }) => (
          <View
            className={`w-full flex-row items-center gap-3 rounded-xl border bg-n800 px-4 py-4 ${
              errors.email ? "border-error" : "border-n700"
            }`}
          >
            <Mail size={20} color="#9CA3AF" />
            <TextInput
              value={value}
              onChangeText={onChange}
              onBlur={onBlur}
              placeholder="Enter your email address"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              className="flex-1 text-body-lg text-white"
              accessibilityLabel="Email address"
            />
          </View>
        )}
      />

      {errors.email ? (
        <Text className="mt-1 text-body-sm text-error">
          {errors.email.message}
        </Text>
      ) : null}

      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        accessibilityRole="button"
        accessibilityLabel="Continue with email"
        className={`mt-4 w-full items-center justify-center rounded-xl bg-aura-purple py-4 ${
          isSubmitting ? "opacity-60" : ""
        }`}
      >
        <Text className="text-h4 text-white">Continue with email</Text>
      </Pressable>
    </View>
  );
}
