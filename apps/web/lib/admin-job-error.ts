export type AdminJobErrorDetails = {
  code: string;
  provider: "OPENAI" | "MATHPIX" | "GEMINI" | null;
  message: string;
  action: string;
  httpStatus: number | null;
  retryable: boolean;
};
