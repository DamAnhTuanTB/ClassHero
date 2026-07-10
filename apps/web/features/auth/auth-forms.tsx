"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
  type ForgotPasswordFormValues,
  type LoginFormValues,
  type ParentRegisterFormValues,
  type ResetPasswordFormValues,
  type StudentRegisterFormValues,
} from "./auth-schemas";
import {
  forgotPassword,
  getAuthErrorMessage,
  login,
  registerParent,
  registerStudent,
  resetPassword,
  type AuthGender,
} from "./auth-api";
import { FormHeader, OptionField, SubmitButton, TextField } from "./auth-form-primitives";
import { saveAuthSession } from "./auth-session";

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

async function submitWhenValid<TFormValues extends FieldValues>(
  form: UseFormReturn<TFormValues>,
  onValid: () => Promise<void> | void,
) {
  const isValid = await form.trigger(undefined, { shouldFocus: true });

  if (!isValid) {
    return;
  }

  await onValid();
}

function handleSubmitIntent<TFormValues extends FieldValues>(
  event: SubmitIntentEvent,
  form: UseFormReturn<TFormValues>,
  onValid: () => Promise<void> | void,
) {
  event.preventDefault();
  void submitWhenValid(form, onValid);
}

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

function VerifiedResetPasswordForm({ resetToken }: { resetToken: string }) {
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
        className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:text-sky-800"
        href="/login"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Đăng nhập
      </Link>
    </form>
  );
}
