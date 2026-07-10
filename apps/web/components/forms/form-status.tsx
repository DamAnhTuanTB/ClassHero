import { statusToneClass } from "@/components/forms/form-styles";
import type { FormStatusProps } from "@/components/forms/form-types";

export function FormStatus({ tone, title, message, detail }: FormStatusProps) {
  return (
    <div
      className={`rounded-[1.05rem] border p-4 ${statusToneClass[tone]}`}
      role="status"
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 text-sm leading-6">{message}</p>
      {detail ? <p className="mt-2 text-xs leading-5 opacity-80">{detail}</p> : null}
    </div>
  );
}
