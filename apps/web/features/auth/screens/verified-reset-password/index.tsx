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
import { resetPassword } from "@/features/auth/api/auth-api";
import { getAuthErrorMessage } from "@/features/auth/utils/auth-api-errors";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/features/auth/auth-schemas";
import {
  handleSubmitIntent,
  type SubmitIntentEvent,
} from "@/features/auth/utils/submit-intent";

export function VerifiedResetPasswordForm({ resetToken }: { resetToken: string }) {
  const router = useRouter();
  const resetPasswordMutation = useMutation({
    mutationFn: resetPassword,
  });
  const form = useForm<ResetPasswordFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: resetToken,
      newPassword: "",
      confirmPassword: "",
    },
  });
  const isPending = resetPasswordMutation.isPending;

  useEffect(() => {
    form.setValue("token", resetToken, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [form, resetToken]);

  async function handleVerifiedResetPassword() {
    const values = form.getValues();

    try {
      await resetPasswordMutation.mutateAsync({
        token: resetToken,
        newPassword: values.newPassword,
      });
      toast.success("Đã đổi mật khẩu thành công", {
        description: "Vui lòng đăng nhập lại.",
      });
      router.replace("/login");
    } catch (error) {
      toast.error("Không thể đổi mật khẩu", {
        description: getAuthErrorMessage(
          error,
          "Chưa thể đổi mật khẩu. Vui lòng thử lại sau ít phút.",
        ),
      });
    }
  }

  const handleVerifiedResetPasswordIntent = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleVerifiedResetPassword);

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleVerifiedResetPasswordIntent}
    >
      <FormHeader title="Đổi mật khẩu" />

      <div className="grid gap-4">
        <TextField
          id="verified-new-password"
          label="Mật khẩu mới"
          type="password"
          autoComplete="off"
          error={form.formState.errors.newPassword}
          disabled={isPending}
          {...form.register("newPassword")}
        />
        <TextField
          id="verified-confirm-password"
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="off"
          error={form.formState.errors.confirmPassword}
          disabled={isPending}
          {...form.register("confirmPassword")}
        />
      </div>

      <SubmitButton isPending={isPending} onClick={handleVerifiedResetPasswordIntent}>
        Đổi mật khẩu
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
