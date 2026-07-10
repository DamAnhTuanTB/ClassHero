import type { FormEvent, MouseEvent } from "react";
import type { FieldValues, UseFormReturn } from "react-hook-form";

export type SubmitIntentEvent =
  FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>;

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

export function handleSubmitIntent<TFormValues extends FieldValues>(
  event: SubmitIntentEvent,
  form: UseFormReturn<TFormValues>,
  onValid: () => Promise<void> | void,
) {
  event.preventDefault();
  void submitWhenValid(form, onValid);
}
