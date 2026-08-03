"use client";

import {
  ArrowLeft,
  BadgeCheck,
  Ban,
  CircleAlert,
  Clock,
  ExternalLink,
  Home,
  RotateCcw,
  TimerOff,
} from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { ClassHeroLogo } from "@/components/common/brand/classhero-logo";
import { StudentFullScreenState } from "@/components/student/student-full-screen-state";
import {
  useInvalidateCoursesAfterPayment,
  usePaymentStatusQuery,
} from "@/features/student/payments/hooks/use-student-payment";
import { usePaymentCheckoutBackGuard } from "@/features/student/payments/hooks/use-payment-checkout-back-guard";
import type { PaymentStatusApi } from "@/features/student/payments/types/student-payment-types";
import { rememberPaymentCheckoutHistory } from "@/features/student/payments/utils/payment-checkout-history";
import { AssessmentResultConfetti } from "@/features/student/lessons/screens/student-lesson-screen/components/assessment-result-confetti";
import { cn } from "@/lib/utils";

function formatVnd(amount: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    maximumFractionDigits: 0,
  }).format(amount)} VNĐ`;
}

function formatDateTime(dateString: string) {
  const date = new Date(dateString);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export function StudentPaymentResultScreen({ paymentId }: { paymentId: string }) {
  const { data: payment, isLoading, isError } = usePaymentStatusQuery(paymentId);
  const invalidateCourses = useInvalidateCoursesAfterPayment();
  const fallbackHref = payment?.learningPath?.slug
    ? `/student/courses/${payment.learningPath.slug}`
    : "/student/courses";

  usePaymentCheckoutBackGuard({
    enabled: payment?.status === "PAID",
    fallbackHref,
    paymentId,
  });

  // Invalidate course cache when payment becomes PAID
  useEffect(() => {
    if (payment?.status === "PAID" && payment.learningPath?.slug) {
      void invalidateCourses(payment.learningPath.slug);
    }
  }, [payment?.status, payment?.learningPath?.slug, invalidateCourses]);

  if (isError) {
    return (
      <StudentFullScreenState
        title="Không tìm thấy thanh toán"
        description="Bạn quay lại danh sách khóa học để thử lại nhé."
        action={
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Link
              href="/student/courses"
              className="student-learn-cta-3d inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 text-sm font-bold text-white transition hover:bg-sky-600"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Về danh sách khóa học
            </Link>
            <Link
              href="/student/explore"
              className="student-learn-cta-3d-emerald inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 text-sm font-bold text-white transition hover:bg-emerald-400"
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Về Trang chủ
            </Link>
          </div>
        }
      />
    );
  }

  if (isLoading || !payment) {
    return (
      <main
        className="fixed inset-0 z-[9999] grid place-items-center px-4 py-8"
        style={{ background: "var(--student-screen-bg)" }}
      >
        <div className="mx-auto w-full max-w-md animate-pulse overflow-hidden rounded-[1.5rem] bg-white p-5 shadow-lg dark:bg-[var(--theme-surface)]">
          <div className="mx-auto mb-6 h-14 w-52 rounded-xl bg-[var(--theme-skeleton)]" />
          <div className="mx-auto mb-5 h-20 w-20 rounded-3xl bg-[var(--theme-skeleton)]" />
          <div className="mx-auto mb-3 h-6 w-52 rounded-lg bg-[var(--theme-skeleton)]" />
          <div className="mx-auto mb-8 h-4 w-64 rounded bg-[var(--theme-skeleton)]" />
          <div className="student-preserve-mobile-top-border space-y-4 border-t border-slate-200 pt-5 dark:border-[var(--theme-border)]">
            <div className="h-4 rounded bg-[var(--theme-skeleton)]" />
            <div className="h-4 rounded bg-[var(--theme-skeleton)]" />
            <div className="h-12 rounded-xl bg-[var(--theme-skeleton)]" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main
      className="fixed inset-0 z-[9999] grid place-items-center px-4 py-8"
      style={{ background: "var(--student-screen-bg)" }}
    >
      {payment.status === "PAID" && <AssessmentResultConfetti />}
      <div className="mx-auto w-full max-w-md z-10">
        <PaymentStatusCard
          paymentId={paymentId}
          status={payment.status}
          amountVnd={payment.amountVnd}
          referenceCode={payment.referenceCode}
          learningPathTitle={payment.learningPath?.title ?? "Khóa học"}
          learningPathSlug={payment.learningPath?.slug ?? ""}
          paidAt={payment.paidAt}
          checkoutUrl={payment.checkoutUrl}
          enrollmentExpiresAt={payment.enrollment?.expiresAt ?? null}
        />
      </div>
    </main>
  );
}

function PaymentStatusCard({
  paymentId,
  status,
  amountVnd,
  referenceCode,
  learningPathTitle,
  learningPathSlug,
  paidAt,
  checkoutUrl,
  enrollmentExpiresAt,
}: {
  paymentId: string;
  status: PaymentStatusApi;
  amountVnd: number;
  referenceCode: string | null;
  learningPathTitle: string;
  learningPathSlug: string;
  paidAt: string | null;
  checkoutUrl: string | null;
  enrollmentExpiresAt: string | null;
}) {
  const isPending = status === "PENDING";
  const isPaid = status === "PAID";
  const isTerminal = status === "FAILED" || status === "CANCELLED" || status === "EXPIRED";
  const terminalContent = getTerminalStatusContent(status);

  return (
    <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-lg dark:bg-[var(--theme-surface)]">
      {/* Status header */}
      <div
        className={cn(
          "flex flex-col items-center gap-3 p-5",
          isPaid &&
            "bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-500/10 dark:to-transparent",
          isPending &&
            "bg-gradient-to-b from-amber-50 to-white dark:from-amber-500/10 dark:to-transparent",
          isTerminal &&
            "bg-gradient-to-b from-red-50 to-white dark:from-red-500/10 dark:to-transparent",
        )}
      >
        <ClassHeroLogo className="mb-1 h-14 max-w-[14rem] sm:h-16" priority />
        <div
          className={cn(
            "grid h-20 w-20 place-items-center rounded-3xl",
            isPaid && "bg-emerald-100 dark:bg-emerald-500/20",
            isPending && "bg-amber-100 dark:bg-amber-500/20",
            isTerminal && "bg-red-100 dark:bg-red-500/20",
          )}
        >
          {isPaid ? (
            <BadgeCheck className="h-10 w-10 text-emerald-500" />
          ) : isPending ? (
            <Clock className="h-10 w-10 animate-pulse text-amber-500" />
          ) : status === "CANCELLED" ? (
            <Ban className="h-10 w-10 text-red-500" />
          ) : status === "EXPIRED" ? (
            <TimerOff className="h-10 w-10 text-red-500" />
          ) : (
            <CircleAlert className="h-10 w-10 text-red-500" />
          )}
        </div>

        <h1 className="text-center text-xl font-black text-slate-800 dark:text-[var(--theme-text-strong)]">
          {isPaid
            ? "Thanh toán thành công!"
            : isPending
              ? "Đang chờ thanh toán"
              : terminalContent.title}
        </h1>

        {isPending && (
          <p className="text-center text-sm font-medium text-amber-600 dark:text-amber-400">
            Hệ thống đang đợi xác nhận từ ngân hàng...
          </p>
        )}

        {isPaid && (
          <p className="-mt-1 text-center text-sm font-medium text-emerald-600 dark:text-emerald-400">
            Khóa học đã được mở cho bạn. <br /> Hãy cùng nhau học tập thật tốt nhé.
          </p>
        )}

        {isTerminal && (
          <p className="text-center text-sm font-medium text-red-600 dark:text-red-400">
            {terminalContent.description}
          </p>
        )}
      </div>

      {/* Payment details */}
      <div
        className={cn(
          "student-preserve-mobile-top-border space-y-3 border-t border-slate-200 p-5 dark:border-[var(--theme-border)]",
        )}
      >
        <DetailRow label="Khóa học" value={learningPathTitle} />
        {isPaid && referenceCode && (
          <DetailRow label="Mã đơn hàng" value={referenceCode} />
        )}
        <DetailRow label="Số tiền" value={formatVnd(amountVnd)} highlight />
        {isPaid && paidAt && (
          <DetailRow label="Thanh toán lúc" value={formatDateTime(paidAt)} />
        )}
        {isPaid && enrollmentExpiresAt && (
          <DetailRow label="Học đến" value={formatDateTime(enrollmentExpiresAt)} />
        )}
        <DetailRow
          label="Trạng thái"
          value={
            <span
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1 text-sm font-bold",
                isPaid &&
                  "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
                isPending &&
                  "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
                isTerminal && "bg-red-50 text-red-600 dark:bg-red-500/15 dark:text-red-300",
              )}
            >
              {isPaid ? "Đã thanh toán" : isPending ? "Đang chờ" : terminalContent.label}
            </span>
          }
        />
      </div>

      {/* Actions */}
      <div className="student-preserve-mobile-top-border border-t border-slate-200 p-5 dark:border-[var(--theme-border)]">
        {isPaid && learningPathSlug && (
          <Link
            href={`/student/courses/${learningPathSlug}`}
            replace
            className="student-learn-cta-3d flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600"
          >
            <BadgeCheck className="h-5 w-5" />
            Bắt đầu học ngay
          </Link>
        )}

        {isPending && checkoutUrl && (
          <a
            href={checkoutUrl}
            onClick={() => rememberPaymentCheckoutHistory(paymentId)}
            className="student-learn-cta-3d flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600"
          >
            <ExternalLink className="h-5 w-5" />
            Mở trang thanh toán
          </a>
        )}

        {isTerminal && learningPathSlug && (
          <Link
            href={`/student/courses/${learningPathSlug}`}
            replace
            className="student-learn-cta-3d flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-sky-500 px-4 text-sm font-black text-white transition hover:bg-sky-600"
          >
            <RotateCcw className="h-5 w-5" />
            Thử lại
          </Link>
        )}

        <Link
          href="/student/explore"
          replace
          className="student-learn-cta-3d-emerald mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 text-sm font-black text-white transition hover:bg-emerald-400"
        >
          <Home className="h-5 w-5" />
          Quay về Trang chủ
        </Link>
      </div>
    </div>
  );
}

function getTerminalStatusContent(status: PaymentStatusApi) {
  switch (status) {
    case "CANCELLED":
      return {
        title: "Đã hủy thanh toán",
        description: "Giao dịch đã được hủy. Bạn có thể tạo lại thanh toán khi sẵn sàng.",
        label: "Đã hủy",
      };
    case "EXPIRED":
      return {
        title: "Liên kết thanh toán đã hết hạn",
        description: "Vui lòng tạo một liên kết thanh toán mới để tiếp tục.",
        label: "Hết hạn",
      };
    default:
      return {
        title: "Thanh toán không thành công",
        description: "Bạn có thể thử lại hoặc liên hệ hỗ trợ.",
        label: "Thất bại",
      };
  }
}

function DetailRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="shrink-0 text-sm font-medium text-slate-500 dark:text-[var(--theme-text-muted)]">
        {label}
      </span>
      <span
        className={cn(
          "min-w-0 text-right text-sm font-bold",
          highlight
            ? "text-sky-600 dark:text-sky-300"
            : "text-slate-700 dark:text-[var(--theme-text)]",
        )}
      >
        {value}
      </span>
    </div>
  );
}
