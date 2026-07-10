"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormHeader, SubmitButton, TextField } from "@/components/forms/form-primitives";
import { getAuthErrorMessage, registerParent } from "@/features/auth/api";
import { TermsConsentField } from "@/features/auth/components";
import {
  parentRegisterSchema,
  type ParentRegisterFormValues,
} from "@/features/auth/schemas";
import { handleSubmitIntent, type SubmitIntentEvent } from "@/features/auth/utils";

export function ParentRegisterForm() {
  const router = useRouter();
  const registerParentMutation = useMutation({
    mutationFn: registerParent,
  });
  const form = useForm<ParentRegisterFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(parentRegisterSchema),
    defaultValues: {
      fullName: "",
      phone: "",
      address: "",
      password: "",
      confirmPassword: "",
      acceptedTerms: false,
    },
  });
  const isPending = registerParentMutation.isPending;
  const acceptedTerms = form.watch("acceptedTerms");
  async function handleParentRegister() {
    const values = form.getValues();

    try {
      await registerParentMutation.mutateAsync({
        fullName: values.fullName.trim(),
        phone: values.phone.trim(),
        password: values.password,
      });

      toast.success("Tạo tài khoản phụ huynh thành công", {
        description: "Vui lòng đăng nhập để tiếp tục.",
      });
      form.reset({
        fullName: "",
        phone: "",
        address: "",
        password: "",
        confirmPassword: "",
        acceptedTerms: false,
      });
      router.replace("/login");
    } catch (error) {
      toast.error("Không thể tạo tài khoản", {
        description: getAuthErrorMessage(
          error,
          "Chưa thể tạo tài khoản phụ huynh. Vui lòng thử lại sau ít phút.",
        ),
      });
    }
  }
  const handleParentRegisterSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleParentRegister);

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleParentRegisterSubmit}
    >
      <FormHeader title="Đăng ký" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="parent-full-name"
          label="Họ tên phụ huynh"
          placeholder="Nhập họ tên"
          autoComplete="off"
          error={form.formState.errors.fullName}
          disabled={isPending}
          {...form.register("fullName")}
        />
        <TextField
          id="parent-phone"
          label="Số điện thoại"
          type="tel"
          placeholder="Nhập số điện thoại"
          autoComplete="off"
          error={form.formState.errors.phone}
          disabled={isPending}
          {...form.register("phone")}
        />
        <TextField
          id="parent-address"
          label="Địa chỉ"
          placeholder="Nhập địa chỉ"
          autoComplete="off"
          error={form.formState.errors.address}
          disabled={isPending}
          wrapperClassName="sm:col-span-2"
          {...form.register("address")}
        />
        <TextField
          id="parent-password"
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 6 ký tự"
          autoComplete="off"
          error={form.formState.errors.password}
          disabled={isPending}
          {...form.register("password")}
        />
        <TextField
          id="parent-confirm-password"
          label="Nhập lại mật khẩu"
          type="password"
          placeholder="Nhập lại mật khẩu"
          autoComplete="off"
          error={form.formState.errors.confirmPassword}
          disabled={isPending}
          {...form.register("confirmPassword")}
        />
      </div>

      <TermsConsentField
        checked={acceptedTerms}
        disabled={isPending}
        errorMessage={form.formState.errors.acceptedTerms?.message}
        {...form.register("acceptedTerms")}
      />

      <SubmitButton isPending={isPending} onClick={handleParentRegisterSubmit}>
        Tiếp tục
      </SubmitButton>
      <p className="text-center text-sm text-slate-600">
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
