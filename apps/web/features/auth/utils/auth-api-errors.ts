import { ApiRequestError } from "@/lib/api-client";

export function getAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof ApiRequestError)) {
    return fallback;
  }

  switch (error.code) {
    case "INVALID_CREDENTIALS":
      return "Tên đăng nhập/SĐT hoặc mật khẩu chưa đúng.";
    case "DUPLICATE_EMAIL":
      return "Email này đã được sử dụng.";
    case "DUPLICATE_PHONE":
      return "Số điện thoại này đã được sử dụng.";
    case "DUPLICATE_USERNAME":
      return "Tên đăng nhập này đã được sử dụng.";
    case "INVALID_RESET_TOKEN":
      return "Mã đặt lại mật khẩu chưa hợp lệ hoặc đã được sử dụng.";
    case "RESET_TOKEN_EXPIRED":
      return "Mã đặt lại mật khẩu đã hết hạn.";
    case "INVALID_RECOVERY_INFO":
      return "Thông tin khôi phục chưa khớp. Vui lòng kiểm tra lại.";
    case "VALIDATION_ERROR":
      return "Thông tin chưa hợp lệ. Vui lòng kiểm tra lại các ô nhập.";
    default:
      return error.message || fallback;
  }
}
