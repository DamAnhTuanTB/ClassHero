"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  GraduationCap,
  UsersRound,
  VenusAndMars,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type MouseEvent } from "react";
import { useForm, type FieldValues, type UseFormReturn } from "react-hook-form";
import { toast } from "sonner";
import {
  forgotPasswordSchema,
  loginSchema,
  parentRegisterSchema,
  resetPasswordSchema,
  studentRegisterSchema,
  verifiedResetPasswordSchema,
  type ForgotPasswordFormValues,
  type LoginFormValues,
  type ParentRegisterFormValues,
  type ResetPasswordFormValues,
  type StudentRegisterFormValues,
  type VerifiedResetPasswordFormValues,
} from "./auth-schemas";
import {
  FormHeader,
  FormStatus,
  OptionField,
  SubmitButton,
  TextField,
} from "./auth-form-primitives";
import { runMockAuthAction, type MockAuthAction, type MockAuthResult } from "./mock-auth";

type SubmitState =
  | { status: "idle" }
  | { status: "success"; result: MockAuthResult }
  | { status: "error"; message: string };

type SubmitIntentEvent = FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>;

const gradeOptions = Array.from({ length: 10 }, (_, index) => {
  const grade = String(index + 3);

  return { value: grade, label: `Lớp ${grade}` };
});

const genderOptions = [
  { value: "MALE", label: "Nam" },
  { value: "FEMALE", label: "Nữ" },
  { value: "OTHER", label: "Khác" },
];

const currentYear = new Date().getFullYear();
const birthYearOptions = Array.from({ length: 11 }, (_, index) => {
  const year = String(currentYear - 8 - index);

  return { value: year, label: year };
});

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

async function submitWhenValid<TFormValues extends FieldValues>(
  form: UseFormReturn<TFormValues>,
  onValid: () => Promise<void> | void,
  setSubmitState: (state: SubmitState) => void,
) {
  const isValid = await form.trigger(undefined, { shouldFocus: true });

  if (!isValid) {
    setSubmitState({ status: "idle" });
    return;
  }

  await onValid();
}

function handleSubmitIntent<TFormValues extends FieldValues>(
  event: SubmitIntentEvent,
  form: UseFormReturn<TFormValues>,
  onValid: () => Promise<void> | void,
  setSubmitState: (state: SubmitState) => void,
) {
  event.preventDefault();
  void submitWhenValid(form, onValid, setSubmitState);
}

export function LoginForm() {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const [rememberLogin, setRememberLogin] = useState(true);
  const form = useForm<LoginFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(loginSchema),
    defaultValues: {
      identifier: "",
      password: "",
    },
  });
  const isPending = form.formState.isSubmitting;
  const handleLoginSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(
      event,
      form,
      () => submitMock("login", setSubmitState),
      setSubmitState,
    );

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

export function StudentRegisterForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
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
  const isPending = form.formState.isSubmitting;
  const hasNoPhone = form.watch("hasNoPhone");
  const acceptedTerms = form.watch("acceptedTerms");
  const handleStudentRegisterSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(
      event,
      form,
      () => submitMock("register-student", setSubmitState),
      setSubmitState,
    );

  return (
    <form
      className="grid gap-5"
      autoComplete="off"
      noValidate
      onSubmit={handleStudentRegisterSubmit}
    >
      <FormHeader title="Đăng ký" />

      <div className="grid gap-4 sm:grid-cols-2">
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
          wrapperClassName="sm:col-span-2"
          {...form.register("address")}
        />
        <TextField
          id="student-phone"
          label="Số điện thoại"
          type="tel"
          placeholder="Nhập số điện thoại"
          autoComplete="off"
          error={form.formState.errors.phone}
          disabled={isPending || hasNoPhone}
          suppressBrowserSuggestions
          wrapperClassName="sm:col-span-2"
          labelAction={
            <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 text-xs font-bold text-slate-600 transition hover:text-slate-950">
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
                className={`flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center rounded border transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
                  hasNoPhone
                    ? "border-[var(--auth-primary)] bg-[var(--auth-primary)] text-white"
                    : "border-slate-300 bg-white text-transparent"
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
          wrapperClassName="sm:col-span-2"
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

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <div className="text-sm font-semibold leading-6 text-slate-700">
        <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1">
          <label className="inline-flex cursor-pointer items-start gap-3 transition hover:text-slate-950">
            <input
              type="checkbox"
              autoComplete="off"
              disabled={isPending}
              className="peer sr-only"
              {...form.register("acceptedTerms")}
            />
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
                acceptedTerms
                  ? "border-[var(--auth-primary)] bg-[var(--auth-primary)] text-white shadow-sm shadow-indigo-950/10"
                  : "border-slate-300 bg-white text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span>Tôi đã đọc và đồng ý với</span>
          </label>
          <Link
            className="font-extrabold text-blue-600 underline-offset-4 hover:text-blue-700 hover:none"
            href="/terms"
          >
            Điều khoản sử dụng
          </Link>
        </div>
        {form.formState.errors.acceptedTerms ? (
          <span className="mt-1 block text-sm font-semibold leading-5 text-red-600">
            {form.formState.errors.acceptedTerms.message}
          </span>
        ) : null}
      </div>

      <SubmitButton isPending={isPending} onClick={handleStudentRegisterSubmit}>
        Tạo tài khoản học sinh
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

export function ParentRegisterForm() {
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
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
  const isPending = form.formState.isSubmitting;
  const acceptedTerms = form.watch("acceptedTerms");
  const handleParentRegisterSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(
      event,
      form,
      () => submitMock("register-parent", setSubmitState),
      setSubmitState,
    );

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

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <div className="text-sm font-semibold leading-6 text-slate-700">
        <div className="flex flex-wrap items-start gap-x-1.5 gap-y-1">
          <label className="inline-flex cursor-pointer items-start gap-3 transition hover:text-slate-950">
            <input
              type="checkbox"
              autoComplete="off"
              disabled={isPending}
              className="peer sr-only"
              {...form.register("acceptedTerms")}
            />
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition peer-focus-visible:ring-4 peer-focus-visible:ring-indigo-100 peer-disabled:cursor-not-allowed peer-disabled:opacity-60 ${
                acceptedTerms
                  ? "border-[var(--auth-primary)] bg-[var(--auth-primary)] text-white shadow-sm shadow-indigo-950/10"
                  : "border-slate-300 bg-white text-transparent"
              }`}
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span>Tôi đã đọc và đồng ý với</span>
          </label>
          <Link
            className="font-extrabold text-blue-600 underline-offset-4 hover:text-blue-700 hover:underline"
            href="/terms"
          >
            Điều khoản sử dụng
          </Link>
        </div>
        {form.formState.errors.acceptedTerms ? (
          <span className="mt-1 block text-sm font-semibold leading-5 text-red-600">
            {form.formState.errors.acceptedTerms.message}
          </span>
        ) : null}
      </div>

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

export function ForgotPasswordForm() {
  const [isVerified, setIsVerified] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<ForgotPasswordFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      fullName: "",
      identifier: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  async function handleForgotPasswordSubmit() {
    try {
      await runMockAuthAction("forgot-password");
      setSubmitState({ status: "idle" });
      setIsVerified(true);
    } catch {
      setSubmitState({
        status: "error",
        message: "Chưa thể xác minh thông tin. Vui lòng thử lại sau ít phút.",
      });
    }
  }
  const handleForgotPasswordIntent = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleForgotPasswordSubmit, setSubmitState);

  if (isVerified) {
    return <VerifiedResetPasswordForm />;
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
          id="forgot-full-name"
          label="Họ tên"
          placeholder="Nhập họ tên"
          autoComplete="off"
          error={form.formState.errors.fullName}
          disabled={isPending}
          {...form.register("fullName")}
        />
        <TextField
          id="forgot-identifier"
          label="Tên đăng nhập/Số điện thoại"
          placeholder="Vui lòng nhập"
          autoComplete="off"
          error={form.formState.errors.identifier}
          disabled={isPending}
          {...form.register("identifier")}
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

      {submitState.status === "error" ? (
        <FormStatus
          tone="error"
          title="Không thể xác minh"
          message={submitState.message}
        />
      ) : null}

      <SubmitButton isPending={isPending} onClick={handleForgotPasswordIntent}>
        Tiếp tục
      </SubmitButton>

      <div className="text-sm text-slate-600">
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

function VerifiedResetPasswordForm() {
  const router = useRouter();
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });
  const form = useForm<VerifiedResetPasswordFormValues>({
    mode: "onChange",
    reValidateMode: "onChange",
    resolver: zodResolver(verifiedResetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });
  const isPending = form.formState.isSubmitting;

  async function handleResetPasswordSubmit() {
    try {
      await runMockAuthAction("reset-password");
      router.replace("/login?passwordChanged=1");
    } catch {
      setSubmitState({
        status: "error",
        message: "Chưa thể đổi mật khẩu. Vui lòng thử lại sau ít phút.",
      });
    }
  }
  const handleVerifiedResetPasswordIntent = (event: SubmitIntentEvent) =>
    handleSubmitIntent(event, form, handleResetPasswordSubmit, setSubmitState);

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

      {submitState.status === "error" ? (
        <FormStatus
          tone="error"
          title="Không thể đổi mật khẩu"
          message={submitState.message}
        />
      ) : null}

      <SubmitButton isPending={isPending} onClick={handleVerifiedResetPasswordIntent}>
        Đổi mật khẩu
      </SubmitButton>
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
  const handleResetPasswordSubmit = (event: SubmitIntentEvent) =>
    handleSubmitIntent(
      event,
      form,
      () => submitMock("reset-password", setSubmitState),
      setSubmitState,
    );

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

      {submitState.status === "success" ? (
        <FormStatus
          tone="success"
          title={submitState.result.title}
          message={submitState.result.message}
          detail={submitState.result.detail}
        />
      ) : null}

      <SubmitButton isPending={isPending} onClick={handleResetPasswordSubmit}>
        Đặt lại mật khẩu
      </SubmitButton>
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
