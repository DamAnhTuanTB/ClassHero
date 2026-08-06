import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from "class-validator";
import { tiptapContentSchema } from "../zod-schemas/tiptap.schema";

@ValidatorConstraint({ name: "isTiptapJson", async: false })
export class IsTiptapJsonConstraint implements ValidatorConstraintInterface {
  private errorMessage = "JSON không đúng định dạng Tiptap/Block (thiếu type: 'doc' hoặc 'lesson_summary_blocks').";

  validate(value: any, args: ValidationArguments) {
    if (typeof value !== "object" || value === null) {
      return false;
    }

    const result = tiptapContentSchema.safeParse(value);
    
    if (!result.success) {
      // Optional: Lấy lỗi chi tiết từ Zod nếu muốn log hoặc debug
      // console.debug(result.error.issues);
      return false;
    }
    
    return true;
  }

  defaultMessage(args: ValidationArguments) {
    return this.errorMessage;
  }
}

/**
 * Decorator kiểm tra dữ liệu đầu vào có phải là chuẩn Tiptap JSON hoặc lesson_summary_blocks không.
 * Kết hợp Zod để check đệ quy cho toàn bộ object tree.
 */
export function IsTiptapJson(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsTiptapJsonConstraint,
    });
  };
}
