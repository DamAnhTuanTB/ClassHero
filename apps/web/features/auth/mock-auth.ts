export type MockAuthAction =
  "login" | "register-student" | "register-parent" | "forgot-password" | "reset-password";

export type MockAuthResult = {
  title: string;
  message: string;
  detail?: string;
};

const actionMessages: Record<MockAuthAction, MockAuthResult> = {
  login: {
    title: "Đăng nhập thành công",
    message: "Đang chuẩn bị không gian học tập của bạn.",
  },
  "register-student": {
    title: "Tạo tài khoản học sinh thành công",
    message: "Bạn có thể đăng nhập để bắt đầu học theo lộ trình.",
  },
  "register-parent": {
    title: "Tạo tài khoản phụ huynh thành công",
    message: "Bạn có thể đăng nhập để tiếp tục.",
  },
  "forgot-password": {
    title: "Đã ghi nhận yêu cầu khôi phục",
    message: "Nếu thông tin khớp, hướng dẫn đặt lại mật khẩu sẽ được gửi đến bạn.",
  },
  "reset-password": {
    title: "Mật khẩu đã được cập nhật",
    message: "Bạn có thể đăng nhập bằng mật khẩu mới.",
  },
};

export async function runMockAuthAction(action: MockAuthAction): Promise<MockAuthResult> {
  await new Promise((resolve) => window.setTimeout(resolve, 650));
  return actionMessages[action];
}
