import type { InputHTMLAttributes, MouseEventHandler, ReactNode } from "react";
import type { FieldError } from "react-hook-form";

export type TextFieldProps = {
  id: string;
  label: string;
  type?: string;
  placeholder?: string;
  autoComplete?: string;
  error?: FieldError;
  helperText?: string;
  wrapperClassName?: string;
  labelAction?: ReactNode;
  hideLabel?: boolean;
  isOptional?: boolean;
  optionalLabel?: string;
  icon?: ReactNode | null;
  isDarkTheme?: boolean;
  suppressBrowserSuggestions?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export type OptionItem = {
  value: string;
  label: string;
};

export type OptionFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  options: OptionItem[];
  error?: FieldError;
  disabled?: boolean;
  hideLabel?: boolean;
  isOptional?: boolean;
  optionalLabel?: string;
  icon?: ReactNode | null;
  isDarkTheme?: boolean;
  wrapperClassName?: string;
  onChange: (value: string) => void;
};

export type SubmitButtonProps = {
  isPending: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
};

export type CheckboxFieldProps = {
  id: string;
  label: string;
  error?: FieldError;
  wrapperClassName?: string;
  labelClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export type FormStatusProps = {
  tone: "success" | "error" | "info";
  title: string;
  message: string;
  detail?: string;
};
