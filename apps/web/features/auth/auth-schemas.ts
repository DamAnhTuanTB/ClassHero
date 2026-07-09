import { z } from "zod";

const passwordSchema = z.string().min(6, "Mật khẩu cần ít nhất 6 ký tự.");
const currentYear = new Date().getFullYear();
const minStudentBirthYear = currentYear - 18;
const maxStudentBirthYear = currentYear - 8;

const vietnamPhoneSchema = z
  .string()
  .trim()
  .min(9, "Số điện thoại chưa hợp lệ.")
  .max(12, "Số điện thoại quá dài.")
  .regex(/^[0-9+]+$/, "Số điện thoại chỉ gồm số hoặc dấu +.");

const requiredText = (message: string) => z.string().trim().min(1, message);
const acceptedTermsSchema = z.boolean().refine((value) => value, {
  message: "Bạn cần đồng ý với Điều khoản sử dụng để đăng ký.",
});

export const loginSchema = z.object({
  identifier: requiredText("Nhập tên đăng nhập/SĐT"),
  password: z.string().min(1, "Nhập mật khẩu."),
});

export const studentRegisterSchema = z
  .object({
    fullName: requiredText("Nhập họ tên học sinh."),
    grade: z
      .number({ error: "Chọn khối lớp." })
      .int()
      .min(3, "Khối lớp từ 3 trở lên.")
      .max(12, "Khối lớp tối đa là 12.")
      .optional(),
    birthYear: z
      .number({ error: "Chọn năm sinh." })
      .int()
      .min(minStudentBirthYear, "Năm sinh chưa phù hợp với học sinh lớp 3-12.")
      .max(maxStudentBirthYear, "Năm sinh chưa phù hợp với học sinh lớp 3-12.")
      .optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
    address: requiredText("Nhập địa chỉ."),
    phone: z.string().optional(),
    hasNoPhone: z.boolean(),
    username: z
      .string()
      .trim()
      .min(4, "Tên đăng nhập cần ít nhất 4 ký tự.")
      .regex(/^[a-zA-Z0-9_]+$/, "Tên đăng nhập chỉ gồm chữ, số hoặc dấu _."),
    password: passwordSchema,
    confirmPassword: z.string().optional(),
    acceptedTerms: acceptedTermsSchema,
  })
  .superRefine((values, context) => {
    if (!values.grade) {
      context.addIssue({
        code: "custom",
        message: "Chọn khối lớp.",
        path: ["grade"],
      });
    }

    if (!values.birthYear) {
      context.addIssue({
        code: "custom",
        message: "Chọn năm sinh.",
        path: ["birthYear"],
      });
    }

    if (!values.gender) {
      context.addIssue({
        code: "custom",
        message: "Chọn giới tính.",
        path: ["gender"],
      });
    }

    if (!values.hasNoPhone) {
      const phone = values.phone?.trim() ?? "";

      if (!phone) {
        context.addIssue({
          code: "custom",
          message: "Nhập số điện thoại hoặc chọn Không có SĐT.",
          path: ["phone"],
        });
      } else {
        const phoneResult = vietnamPhoneSchema.safeParse(phone);

        if (!phoneResult.success) {
          context.addIssue({
            code: "custom",
            message: phoneResult.error.issues[0]?.message ?? "Nhập số điện thoại.",
            path: ["phone"],
          });
        }
      }
    }

    if (!values.confirmPassword?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Nhập lại mật khẩu.",
        path: ["confirmPassword"],
      });

      return;
    }

    if (values.password && values.password !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Mật khẩu nhập lại chưa khớp.",
        path: ["confirmPassword"],
      });
    }
  });

export const parentRegisterSchema = z
  .object({
    fullName: requiredText("Nhập họ tên phụ huynh."),
    phone: vietnamPhoneSchema,
    address: requiredText("Nhập địa chỉ."),
    password: passwordSchema,
    confirmPassword: z.string().optional(),
    acceptedTerms: acceptedTermsSchema,
  })
  .superRefine((values, context) => {
    if (!values.confirmPassword?.trim()) {
      context.addIssue({
        code: "custom",
        message: "Nhập lại mật khẩu.",
        path: ["confirmPassword"],
      });

      return;
    }

    if (values.password && values.password !== values.confirmPassword) {
      context.addIssue({
        code: "custom",
        message: "Mật khẩu nhập lại chưa khớp.",
        path: ["confirmPassword"],
      });
    }
  });

export const forgotPasswordSchema = z.object({
  fullName: requiredText("Nhập họ tên."),
  identifier: requiredText("Nhập tên đăng nhập/SĐT"),
  grade: z
    .number({ error: "Chọn khối lớp." })
    .int()
    .min(3, "Khối lớp từ 3 trở lên.")
    .max(12, "Khối lớp tối đa là 12.")
    .optional()
    .refine((value) => value !== undefined, "Chọn khối lớp."),
});

export const verifiedResetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, "Nhập lại mật khẩu mới."),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "Mật khẩu nhập lại chưa khớp.",
    path: ["confirmPassword"],
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
export type VerifiedResetPasswordFormValues = z.infer<typeof verifiedResetPasswordSchema>;
