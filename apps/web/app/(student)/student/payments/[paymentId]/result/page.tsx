import { StudentPaymentResultScreen } from "@/features/student/payments/screens/student-payment-result-screen";

export default async function StudentPaymentResultPage({
  params,
}: {
  params: Promise<{ paymentId: string }>;
}) {
  const { paymentId } = await params;

  return <StudentPaymentResultScreen paymentId={paymentId} />;
}
