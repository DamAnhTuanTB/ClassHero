import {
  IdCard,
  LockKeyhole,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  UserRound,
} from "lucide-react";

export function FieldIcon({
  id,
  type,
  label,
}: {
  id: string;
  type: string;
  label: string;
}) {
  const normalized = `${id} ${label}`.toLowerCase();
  const isAccountIdentifier =
    normalized.includes("identifier") ||
    normalized.includes("tài khoản") ||
    normalized.includes("username") ||
    normalized.includes("tên đăng nhập");

  if (type === "password" || normalized.includes("mật khẩu")) {
    return <LockKeyhole className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "email" || normalized.includes("email")) {
    return <Mail className="h-5 w-5" aria-hidden="true" />;
  }

  if (isAccountIdentifier) {
    return <UserRound className="h-5 w-5" aria-hidden="true" />;
  }

  if (type === "tel" || normalized.includes("điện thoại")) {
    return <Phone className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("họ tên")) {
    return <IdCard className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("địa chỉ")) {
    return <MapPin className="h-5 w-5" aria-hidden="true" />;
  }

  if (normalized.includes("mã")) {
    return <ShieldCheck className="h-5 w-5" aria-hidden="true" />;
  }

  return <UserRound className="h-5 w-5" aria-hidden="true" />;
}
