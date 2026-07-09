"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  forgotPasswordSchema,
  loginSchema,
  parentRegisterSchema,
  resetPasswordSchema,
  studentRegisterSchema,
  type ForgotPasswordFormValues,
  type LoginFormValues,
  type ParentRegisterFormValues,
  type ResetPasswordFormValues,
  type StudentRegisterFormValues,
} from "./auth-schemas";
import {
  FormHeader,
  FormStatus,
  SelectField,
  SubmitButton,
  TextField,
} from "./auth-form-primitives";
import { runMockAuthAction, type MockAuthAction, type MockAuthResult } from "./mock-auth";

type SubmitState =
  | { status: "idle" }
  | { status: "success"; result: MockAuthResult }
  | { status: "error"; message: string };

async function submitMock(
  action: MockAuthAction,
  setSubmitState: (state: SubmitState) => void,
) {
  try {
    const result = await runMockAuthAction(action);
    setSubmitState({ status: "success", result });
  } catch {
    setSubmitState({
      status: "error",
      message: "Chưa thể hoàn tất yêu cầu. Vui lòng thử lại sau ít phút.",
    });
  }
}

export function LoginForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [rememberLogin, setRememberLogin] = useState(true);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(() => submitMock("login", setSubmitState))}
    >
      <FormHeader title="Đăng nhập" />

      <div className="grid gap-4">
        <TextField
          id="identifier"
          label="Tài khoản"
          placeholder="Email, số điện thoại hoặc tên đăng nhập"
          autoComplete="username"
          error={form.formState.errors.identifier}
          disabled={isPending}
          {...form.register("identifier")}
        />
        <TextField
          id="password"
          label="Mật khẩu"
          type="password"
          placeholder="Nhập mật khẩu"
          autoComplete="current-password"
          error={form.formState.errors.password}
          disabled={isPending}
          {...form.register("password")}
        />
      </div>

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}
      {submitState.status === "error" ? (
        <FormStatus
          tone="error"
          title="Không thể đăng nhập"
          message={submitState.message}
        />
      ) : null}

      <SubmitButton isPending={isPending}>Đăng nhập</SubmitButton>

      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <label className="inline-flex min-h-10 shrink-0 cursor-pointer items-center gap-2 font-semibold text-slate-700 transition hover:text-slate-950">
          <input
            type="checkbox"
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

      <div className="rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-600">
        <p>Chưa có tài khoản?</p>
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3 font-bold">
          <Link className="text-sky-700 hover:text-sky-800" href="/register/student">
            Đăng ký học sinh
          </Link>
          <span className="text-slate-300">•</span>
          <Link
            className="text-emerald-700 hover:text-emerald-800"
            href="/register/parent"
          >
            Đăng ký phụ huynh
          </Link>
        </div>
      </div>
    </form>
  );
}

export function StudentRegisterForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<StudentRegisterFormValues>({
    resolver: zodResolver(studentRegisterSchema),
    defaultValues: {
      email: "",
      phone: "",
      username: "",
      password: "",
      fullName: "",
      grade: 7,
      gender: "MALE",
      dateOfBirth: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(() => submitMock("register-student", setSubmitState))}
    >
      <FormHeader title="Đăng ký" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="student-email"
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={form.formState.errors.email}
          disabled={isPending}
          {...form.register("email")}
        />
        <TextField
          id="student-phone"
          label="Số điện thoại"
          type="tel"
          placeholder="0900000000"
          autoComplete="tel"
          error={form.formState.errors.phone}
          disabled={isPending}
          {...form.register("phone")}
        />
        <TextField
          id="student-username"
          label="Tên đăng nhập"
          placeholder="Ví dụ: tuananh07"
          autoComplete="username"
          error={form.formState.errors.username}
          disabled={isPending}
          {...form.register("username")}
        />
        <TextField
          id="student-password"
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          error={form.formState.errors.password}
          disabled={isPending}
          {...form.register("password")}
        />
        <TextField
          id="student-full-name"
          label="Họ tên học sinh"
          placeholder="Nhập họ tên"
          autoComplete="name"
          error={form.formState.errors.fullName}
          disabled={isPending}
          {...form.register("fullName")}
        />
        <TextField
          id="student-grade"
          label="Khối lớp"
          type="number"
          min={6}
          max={12}
          error={form.formState.errors.grade}
          disabled={isPending}
          {...form.register("grade", { valueAsNumber: true })}
        />
        <SelectField
          id="student-gender"
          label="Giới tính"
          error={form.formState.errors.gender}
          disabled={isPending}
          {...form.register("gender")}
        >
          <option value="MALE">Nam</option>
          <option value="FEMALE">Nữ</option>
          <option value="OTHER">Khác</option>
        </SelectField>
        <TextField
          id="student-date-of-birth"
          label="Ngày sinh"
          type="date"
          error={form.formState.errors.dateOfBirth}
          disabled={isPending}
          {...form.register("dateOfBirth")}
        />
      </div>

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <SubmitButton isPending={isPending}>Tạo tài khoản học sinh</SubmitButton>
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

export function ParentRegisterForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<ParentRegisterFormValues>({
    resolver: zodResolver(parentRegisterSchema),
    defaultValues: {
      email: "",
      phone: "",
      password: "",
      fullName: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(() => submitMock("register-parent", setSubmitState))}
    >
      <FormHeader title="Đăng ký" />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          id="parent-email"
          label="Email"
          type="email"
          placeholder="name@example.com"
          autoComplete="email"
          error={form.formState.errors.email}
          disabled={isPending}
          {...form.register("email")}
        />
        <TextField
          id="parent-phone"
          label="Số điện thoại"
          type="tel"
          placeholder="0900000000"
          autoComplete="tel"
          error={form.formState.errors.phone}
          disabled={isPending}
          {...form.register("phone")}
        />
        <TextField
          id="parent-full-name"
          label="Họ tên phụ huynh"
          placeholder="Nhập họ tên"
          autoComplete="name"
          error={form.formState.errors.fullName}
          disabled={isPending}
          {...form.register("fullName")}
        />
        <TextField
          id="parent-password"
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 8 ký tự"
          autoComplete="new-password"
          error={form.formState.errors.password}
          disabled={isPending}
          {...form.register("password")}
        />
      </div>

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <SubmitButton isPending={isPending}>Tiếp tục</SubmitButton>
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

export function ForgotPasswordForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      identifier: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(() => submitMock("forgot-password", setSubmitState))}
    >
      <FormHeader title="Quên mật khẩu" />

      <TextField
        id="forgot-identifier"
        label="Tài khoản"
        placeholder="Email, số điện thoại hoặc tên đăng nhập"
        autoComplete="username"
        error={form.formState.errors.identifier}
        disabled={isPending}
        {...form.register("identifier")}
      />

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <SubmitButton isPending={isPending}>Gửi hướng dẫn</SubmitButton>

      <div className="text-sm text-slate-600">
        <Link
          className="inline-flex items-center gap-1.5 font-medium text-sky-700 hover:text-sky-800"
          href="/login"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Đăng nhập
        </Link>
      </div>
    </form>
  );
}

export function ResetPasswordForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  return (
    <form
      className="grid gap-5"
      onSubmit={form.handleSubmit(() => submitMock("reset-password", setSubmitState))}
    >
      <FormHeader title="Đặt lại mật khẩu" />

      <div className="grid gap-4">
        <TextField
          id="reset-token"
          label="Mã khôi phục"
          placeholder="Nhập mã trong email"
          autoComplete="one-time-code"
          error={form.formState.errors.token}
          disabled={isPending}
          helperText="Mã này chỉ dùng một lần trong thời gian giới hạn."
          {...form.register("token")}
        />
        <TextField
          id="new-password"
          label="Mật khẩu mới"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.newPassword}
          disabled={isPending}
          {...form.register("newPassword")}
        />
        <TextField
          id="confirm-password"
          label="Nhập lại mật khẩu mới"
          type="password"
          autoComplete="new-password"
          error={form.formState.errors.confirmPassword}
          disabled={isPending}
          {...form.register("confirmPassword")}
        />
      </div>

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <SubmitButton isPending={isPending}>Đặt lại mật khẩu</SubmitButton>
      <Link
        className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
        href="/login"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Đăng nhập
      </Link>
    </form>
  );
}
