import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Mật khẩu cần ít nhất 8 ký tự.")
  .regex(/[A-Z]/, "Mật khẩu cần có ít nhất 1 chữ hoa.")
  .regex(/[a-z]/, "Mật khẩu cần có ít nhất 1 chữ thường.")
  .regex(/[0-9]/, "Mật khẩu cần có ít nhất 1 số.");

const vietnamPhoneSchema = z
  .string()
  .min(9, "Số điện thoại chưa hợp lệ.")
  .max(12, "Số điện thoại quá dài.")
  .regex(/^[0-9+]+$/, "Số điện thoại chỉ gồm số hoặc dấu +.");

export const loginSchema = z.object({
  identifier: z.string().min(3, "Nhập email, số điện thoại hoặc tên đăng nhập."),
  password: z.string().min(1, "Nhập mật khẩu."),
});

export const studentRegisterSchema = z.object({
  email: z.string().email("Email chưa đúng định dạng."),
  phone: vietnamPhoneSchema,
  username: z
    .string()
    .min(4, "Tên đăng nhập cần ít nhất 4 ký tự.")
    .regex(/^[a-zA-Z0-9_]+$/, "Tên đăng nhập chỉ gồm chữ, số hoặc dấu _."),
  password: passwordSchema,
  fullName: z.string().min(2, "Nhập họ tên học sinh."),
  grade: z
    .number()
    .int()
    .min(6, "Khối lớp từ 6 trở lên.")
    .max(12, "Khối lớp tối đa là 12."),
  gender: z.enum(["MALE", "FEMALE", "OTHER"], {
    error: "Chọn giới tính.",
  }),
  dateOfBirth: z.string().min(1, "Chọn ngày sinh."),
});

export const parentRegisterSchema = z.object({
  email: z.string().email("Email chưa đúng định dạng."),
  phone: vietnamPhoneSchema,
  password: passwordSchema,
  fullName: z.string().min(2, "Nhập họ tên phụ huynh."),
});

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(3, "Nhập email, số điện thoại hoặc tên đăng nhập."),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(12, "Mã đặt lại mật khẩu chưa hợp lệ."),
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Nhập lại mật khẩu mới."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type StudentRegisterFormValues = z.infer<typeof studentRegisterSchema>;
export type ParentRegisterFormValues = z.infer<typeof parentRegisterSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
