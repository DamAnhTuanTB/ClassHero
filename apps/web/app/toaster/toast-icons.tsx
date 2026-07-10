import { AlertTriangle, CheckCircle2, CircleAlert, Info, Loader2, X } from "lucide-react";
import { toastIconClass } from "@/app/toaster/constants";

export const toastIcons = {
  close: <X className="h-4 w-4" aria-hidden="true" />,
  error: (
    <span className="app-toast-status-icon">
      <CircleAlert className={toastIconClass} aria-hidden="true" />
    </span>
  ),
  info: (
    <span className="app-toast-status-icon">
      <Info className={toastIconClass} aria-hidden="true" />
    </span>
  ),
  loading: (
    <span className="app-toast-status-icon">
      <Loader2 className={`${toastIconClass} animate-spin`} aria-hidden="true" />
    </span>
  ),
  success: (
    <span className="app-toast-status-icon">
      <CheckCircle2 className={toastIconClass} aria-hidden="true" />
    </span>
  ),
  warning: (
    <span className="app-toast-status-icon">
      <AlertTriangle className={toastIconClass} aria-hidden="true" />
    </span>
  ),
};
