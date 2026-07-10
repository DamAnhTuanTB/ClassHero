"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Check, GraduationCap, UsersRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { FormHeader, SubmitButton, TextField } from "@/components/forms/form-primitives";
import { getAuthErrorMessage, login } from "@/features/auth/api";
import { loginSchema, type LoginFormValues } from "@/features/auth/schemas";
import { saveAuthSession } from "@/features/auth/session";
import { handleSubmitIntent, type SubmitIntentEvent } from "@/features/auth/utils";

export function LoginForm() {
  const router = useRouter();
  const [rememberLogin, setRememberLogin] = useState(true);
  const loginMutation = useMutation({
    mutationFn: login,
  });
  const form = useForm<LoginFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });
  const isPending = loginMutation.isPending;
  async function handleLogin() {
    const values = form.getValues();

    try {
      const response = await loginMutation.mutateAsync({
        identifier: values.identifier.trim(),
        password: values.password,
      });

      saveAuthSession(response, rememberLogin);
      toast.success("Đăng nhập thành công", {
        description: "Chào mừng bạn đến với lớp học ClassHero.",
      });
    } catch (error) {
      toast.error("Không thể đăng nhập", {
        description: getAuthErrorMessage(
          error,
          "Chưa thể đăng nhập. Vui lòng thử lại sau ít phút.",
        ),
      });
    }
  }
  const handleLoginSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleLogin);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    if (searchParams.get("passwordChanged") !== "1") {
      return;
    }

    toast.success("Đã đổi mật khẩu thành công", {
      description: "Vui lòng đăng nhập lại.",
      duration: 4200,
    });
    router.replace("/login", { scroll: false });
  }, [router]);

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleLoginSubmit}
    >
      <FormHeader title="Đăng nhập" />

      <div className="grid gap-4">
        <TextField
          id="identifier"
          label="Tên đăng nhập/Số điện thoại"
          placeholder="Vui lòng nhập"
          autoComplete="off"
          error={form.formState.errors.identifier}
          disabled={isPending}
          {...form.register("identifier")}
        />
        <TextField
          id="password"
          label="Mật khẩu"
          type="password"
          placeholder="Nhập mật khẩu"
          autoComplete="off"
          error={form.formState.errors.password}
          disabled={isPending}
          {...form.register("password")}
        />
      </div>

      <SubmitButton isPending={isPending} onClick={handleLoginSubmit}>
        Đăng nhập
      </SubmitButton>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 font-semibold text-slate-700 transition hover:text-slate-950">
          <input
            type="checkbox"
            autoComplete="off"
            checked={rememberLogin}
            disabled={isPending}
            onChange={(event) => setRememberLogin(event.target.checked)}
            className="peer sr-only"
          />
          <span
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
              rememberLogin
                ? "border-[var(--auth-primary)] bg-[var(--auth-primary)] text-white shadow-sm shadow-indigo-950/10"
                : "border-slate-300 bg-white text-transparent"
            }`}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          Ghi nhớ đăng nhập
        </label>
        <Link
          className="shrink-0 font-bold text-[var(--auth-primary)] hover:brightness-90"
          href="/forgot-password"
        >
          Quên mật khẩu?
        </Link>
      </div>

      <div className="rounded-xl bg-slate-50 p-3 text-center text-sm text-slate-600 sm:p-4">
        <p>Chưa có tài khoản? Chọn vai trò</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <Link
            aria-label="Đăng ký tài khoản học sinh"
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-sky-100 bg-white px-2 text-[13px] font-extrabold leading-none text-sky-700 shadow-sm shadow-sky-950/5 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 sm:text-sm"
            href="/register/student"
          >
            <GraduationCap className="h-4 w-4 shrink-0" aria-hidden="true" />
            Học sinh
          </Link>
          <Link
            aria-label="Đăng ký tài khoản phụ huynh"
            className="inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-100 bg-white px-2 text-[13px] font-extrabold leading-none text-emerald-700 shadow-sm shadow-emerald-950/5 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100 sm:text-sm"
            href="/register/parent"
          >
            <UsersRound className="h-4 w-4 shrink-0" aria-hidden="true" />
            Phụ huynh
          </Link>
        </div>
      </div>
    </form>
  );
}
