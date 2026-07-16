"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormHeader } from "@/components/common/forms/form-header";
import { SubmitButton } from "@/components/common/forms/submit-button";
import { TextField } from "@/components/common/forms/text-field";
import { getAuthErrorMessage, resetPassword } from "@/features/auth/api/auth-api";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/auth-schemas";
import {
  handleSubmitIntent,
  type SubmitIntentEvent,
} from "@/features/auth/utils/submit-intent";

export function ResetPasswordForm() {
  const router = useRouter();
  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
  });
  const form = useForm<ResetPasswordFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const isPending = resetPasswordMutation.isPending;
  useEffect(() => {
    const resetToken = new URLSearchParams(window.location.search).get("token");

    if (!resetToken) {
      return;
    }

    form.setValue("token", resetToken, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  }, [form]);
  async function handleResetPasswordAction() {
    const values = form.getValues();

    try {
      await resetPasswordMutation.mutateAsync({
        token: values.token.trim(),
        newPassword: values.newPassword,
      });
      router.replace("/login?passwordChanged=1");
    } catch (error) {
      toast.error("Không thể đặt lại mật khẩu", {
        description: getAuthErrorMessage(
          error,
          "Chưa thể đặt lại mật khẩu. Vui lòng thử lại sau ít phút.",
        ),
      });
    }
  }
  const handleResetPasswordSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleResetPasswordAction);

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleResetPasswordSubmit}
    >
      <FormHeader title="Đặt lại mật khẩu" />

      <div className="grid gap-4">
        <TextField
          id="reset-token"
          label="Mã khôi phục"
          placeholder="Nhập mã trong email"
          autoComplete="off"
          error={form.formState.errors.token}
          disabled={isPending}
          helperText="Mã này chỉ dùng một lần trong thời gian giới hạn."
          {...form.register("token")}
        />
        <TextField
          id="new-password"
          label="Mật khẩu mới"
          type="password"
          autoComplete="off"
          error={form.formState.errors.newPassword}
          disabled={isPending}
          {...form.register("newPassword")}
        />
        <TextField
          id="confirm-password"
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="off"
          error={form.formState.errors.confirmPassword}
          disabled={isPending}
          {...form.register("confirmPassword")}
        />
      </div>

      <SubmitButton isPending={isPending} onClick={handleResetPasswordSubmit}>
        Đặt lại mật khẩu
      </SubmitButton>
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--theme-primary)] hover:text-[var(--theme-primary-hover)]"
        href="/login"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Đăng nhập
      </Link>
    </form>
  );
}
