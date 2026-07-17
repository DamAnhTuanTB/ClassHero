"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CalendarDays, Check, GraduationCap, VenusAndMars } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormHeader } from "@/components/common/forms/form-header";
import { OptionField } from "@/components/common/forms/option-field";
import { SubmitButton } from "@/components/common/forms/submit-button";
import { TextField } from "@/components/common/forms/text-field";
import { registerStudent } from "@/features/auth/api/auth-api";
import type { AuthGender } from "@/features/auth/types/auth-api-types";
import { getAuthErrorMessage } from "@/features/auth/utils/auth-api-errors";
import { TermsConsentField } from "@/components/common/auth/terms-consent-field";
import {
  birthYearOptions,
  genderOptions,
  gradeOptions,
} from "@/features/auth/auth-form-options";
import {
  studentRegisterSchema,
  type StudentRegisterFormValues,
} from "@/features/auth/auth-schemas";
import {
  handleSubmitIntent,
  type SubmitIntentEvent,
} from "@/features/auth/utils/submit-intent";

export function StudentRegisterForm() {
  const router = useRouter();
  const registerStudentMutation = useMutation({
    mutationFn: registerStudent,
  });
  const form = useForm<StudentRegisterFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(studentRegisterSchema),
    defaultValues: {
      fullName: "",
      address: "",
      phone: "",
      hasNoPhone: false,
      username: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });
  const isPending = registerStudentMutation.isPending;
  const hasNoPhone = form.watch("hasNoPhone");
  const acceptedTerms = form.watch("acceptedTerms");
  async function handleStudentRegister() {
    const values = form.getValues();

    if (
      values.grade === undefined ||
      values.birthYear === undefined ||
      values.gender === undefined
    ) {
      toast.error("Thông tin chưa đầy đủ", {
        description: "Vui lòng kiểm tra lại khối lớp, năm sinh và giới tính.",
      });
      return;
    }

    try {
      const response = await registerStudentMutation.mutateAsync({
        fullName: values.fullName.trim(),
        address: values.address.trim(),
        phone: values.hasNoPhone ? undefined : values.phone?.trim(),
        username: values.username.trim(),
        password: values.password,
        grade: values.grade,
        birthYear: values.birthYear,
        gender: values.gender as AuthGender,
      });

      toast.success("Tạo tài khoản học sinh thành công", {
        description: `Mã liên kết phụ huynh: ${response.studentProfile.childCode}. Vui lòng đăng nhập để bắt đầu học.`,
      });
      form.reset({
        fullName: "",
        address: "",
        phone: "",
        hasNoPhone: false,
        username: "",
        password: "",
        confirmPassword: "",
        acceptedTerms: false,
      });
      router.replace("/login");
    } catch (error) {
      toast.error("Không thể tạo tài khoản", {
        description: getAuthErrorMessage(
          error,
          "Chưa thể tạo tài khoản học sinh. Vui lòng thử lại sau ít phút.",
        ),
      });
    }
  }
  const handleStudentRegisterSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleStudentRegister);

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleStudentRegisterSubmit}
    >
      <FormHeader title="Đăng ký" />

      <div className="grid gap-4 md:grid-cols-2">
        <TextField
          id="student-full-name"
          label="Họ tên học sinh"
          placeholder="Nhập họ tên"
          autoComplete="off"
          error={form.formState.errors.fullName}
          disabled={isPending}
          suppressBrowserSuggestions
          {...form.register("fullName")}
        />
        <OptionField
          id="student-grade"
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
        <OptionField
          id="student-birth-year"
          label="Năm sinh"
          value={form.watch("birthYear") ? String(form.watch("birthYear")) : ""}
          placeholder="Chọn năm sinh"
          options={birthYearOptions}
          error={form.formState.errors.birthYear}
          disabled={isPending}
          icon={<CalendarDays className="h-5 w-5" aria-hidden="true" />}
          onChange={(value) =>
            form.setValue("birthYear", Number(value), {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
        />
        <OptionField
          id="student-gender"
          label="Giới tính"
          value={form.watch("gender") ?? ""}
          placeholder="Chọn giới tính"
          options={genderOptions}
          error={form.formState.errors.gender}
          disabled={isPending}
          icon={<VenusAndMars className="h-5 w-5" aria-hidden="true" />}
          onChange={(value) =>
            form.setValue("gender", value as StudentRegisterFormValues["gender"], {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true,
            })
          }
        />
        <TextField
          id="student-address"
          label="Địa chỉ"
          placeholder="Nhập địa chỉ"
          autoComplete="off"
          error={form.formState.errors.address}
          disabled={isPending}
          suppressBrowserSuggestions
          wrapperClassName="md:col-span-2"
          {...form.register("address")}
        />
        <TextField
          id="student-phone"
          label="Số điện thoại"
          isOptional={hasNoPhone}
          type="tel"
          placeholder="Nhập số điện thoại"
          autoComplete="off"
          error={form.formState.errors.phone}
          disabled={isPending || hasNoPhone}
          suppressBrowserSuggestions
          wrapperClassName="md:col-span-2"
          labelAction={
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs font-bold text-[var(--theme-text)] transition hover:text-[var(--theme-text-strong)]">
              <input
                type="checkbox"
                autoComplete="off"
                checked={hasNoPhone}
                disabled={isPending}
                onChange={(event) => {
                  const checked = event.target.checked;
                  form.setValue("hasNoPhone", checked, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });

                  if (checked) {
                    form.setValue("phone", "", {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    });
                    form.clearErrors("phone");
                  } else {
                    void form.trigger("phone");
                  }
                }}
                className="peer sr-only"
              />
              <span
                className={`flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded border transition peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--theme-focus-ring)] dark:peer-focus-visible:ring-1 dark:peer-focus-visible:ring-sky-500/15 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
                  hasNoPhone
                    ? "border-[var(--auth-primary,var(--theme-primary))] bg-[var(--auth-primary,var(--theme-primary))] text-[var(--theme-primary-foreground)]"
                    : "border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] text-transparent"
                }`}
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </span>
              Không có SĐT
            </label>
          }
          {...form.register("phone")}
        />
        <TextField
          id="student-username"
          label="Tên đăng nhập"
          placeholder="Ví dụ: tuananh07"
          autoComplete="off"
          error={form.formState.errors.username}
          disabled={isPending}
          suppressBrowserSuggestions
          wrapperClassName="md:col-span-2"
          {...form.register("username")}
        />
        <TextField
          id="student-password"
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 6 ký tự"
          autoComplete="off"
          error={form.formState.errors.password}
          disabled={isPending}
          suppressBrowserSuggestions
          {...form.register("password")}
        />
        <TextField
          id="student-confirm-password"
          label="Nhập lại mật khẩu"
          type="password"
          placeholder="Nhập lại mật khẩu"
          autoComplete="off"
          error={form.formState.errors.confirmPassword}
          disabled={isPending}
          suppressBrowserSuggestions
          {...form.register("confirmPassword")}
        />
      </div>

      <TermsConsentField
        checked={acceptedTerms}
        disabled={isPending}
        errorMessage={form.formState.errors.acceptedTerms?.message}
        {...form.register("acceptedTerms")}
      />

      <SubmitButton isPending={isPending} onClick={handleStudentRegisterSubmit}>
        Tạo tài khoản học sinh
      </SubmitButton>
      <p className="text-center text-sm text-[var(--theme-text)]">
        Đã có tài khoản?{" "}
        <Link
          className="font-bold text-[var(--auth-primary)] hover:brightness-90"
          href="/login"
        >
          Đăng nhập ngay
        </Link>
      </p>
    </form>
  );
}
