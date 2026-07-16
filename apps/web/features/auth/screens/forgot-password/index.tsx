"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormHeader } from "@/components/common/forms/form-header";
import { OptionField } from "@/components/common/forms/option-field";
import { SubmitButton } from "@/components/common/forms/submit-button";
import { TextField } from "@/components/common/forms/text-field";
import { forgotPassword, getAuthErrorMessage } from "@/features/auth/api/auth-api";
import { gradeOptions } from "@/features/auth/auth-form-options";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/features/auth/auth-schemas";
import { VerifiedResetPasswordForm } from "@/features/auth/screens/verified-reset-password";
import {
  handleSubmitIntent,
  type SubmitIntentEvent,
} from "@/features/auth/utils/submit-intent";

export function ForgotPasswordForm() {
  const [resetToken, setResetToken] = useState<string | null>(null);
  const forgotPasswordMutation = useMutation({
    mutationFn: forgotPassword,
  });
  const form = useForm<ForgotPasswordFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      fullName: "",
      identifier: "",
    },
  });
  const isPending = forgotPasswordMutation.isPending;

  async function handleForgotPasswordSubmit() {
    try {
      const values = form.getValues();

      if (values.grade === undefined) {
        toast.error("Thông tin chưa đầy đủ", {
          description: "Vui lòng chọn khối lớp.",
        });
        return;
      }

      const response = await forgotPasswordMutation.mutateAsync({
        identifier: values.identifier.trim(),
        fullName: values.fullName.trim(),
        grade: values.grade,
      });

      setResetToken(response.resetToken);
      toast.success("Xác minh thành công", {
        description: "Vui lòng đặt mật khẩu mới.",
      });
    } catch (error) {
      toast.error("Không thể khôi phục", {
        description: getAuthErrorMessage(
          error,
          "Thông tin khôi phục chưa khớp. Vui lòng kiểm tra lại.",
        ),
      });
    }
  }
  const handleForgotPasswordIntent = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleForgotPasswordSubmit);

  if (resetToken) {
    return <VerifiedResetPasswordForm resetToken={resetToken} />;
  }

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleForgotPasswordIntent}
    >
      <FormHeader title="Quên mật khẩu" />

      <div className="grid gap-4">
        <TextField
          id="forgot-identifier"
          label="Tên đăng nhập/Số điện thoại"
          placeholder="Vui lòng nhập"
          autoComplete="off"
          error={form.formState.errors.identifier}
          disabled={isPending}
          {...form.register("identifier")}
        />
        <TextField
          id="forgot-full-name"
          label="Họ tên"
          placeholder="Nhập họ tên"
          autoComplete="off"
          error={form.formState.errors.fullName}
          disabled={isPending}
          {...form.register("fullName")}
        />
        <OptionField
          id="forgot-grade"
          label="Khối lớp"
          value={form.watch("grade") ? String(form.watch("grade")) : ""}
          placeholder="Chọn khối lớp"
          options={gradeOptions}
          error={form.formState.errors.grade}
          disabled={isPending}
          icon={<GraduationCap className="h-5 w-5" aria-hidden="true" />}
          onChange={(value) =>
            form.setValue("grade", Number(value), {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
        />
      </div>

      <SubmitButton isPending={isPending} onClick={handleForgotPasswordIntent}>
        Tiếp tục
      </SubmitButton>

      <div className="text-sm text-[var(--theme-text)]">
        <Link
          className="inline-flex items-center gap-1.5 font-medium text-[var(--auth-primary)] hover:brightness-90"
          href="/login"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Đăng nhập
        </Link>
      </div>
    </form>
  );
}
