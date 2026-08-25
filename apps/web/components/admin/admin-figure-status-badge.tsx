import { CircleAlert, CircleCheckBig, CircleX, Clock3, LoaderCircle } from "lucide-react";

import {
  getAdminFigureStatusPresentation,
  type AdminFigureStatus,
} from "@/lib/admin-figure-status";

const STATUS_ICONS = {
  clock: Clock3,
  loader: LoaderCircle,
  succeeded: CircleCheckBig,
  review: CircleAlert,
  failed: CircleX,
};

export function AdminFigureStatusBadge({ status }: { status: AdminFigureStatus }) {
  const presentation = getAdminFigureStatusPresentation(status);
  const StatusIcon = STATUS_ICONS[presentation.icon];

  return (
    <span
      className={`inline-flex min-h-7 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-extrabold ${presentation.className}`}
    >
      <StatusIcon
        aria-hidden="true"
        className={`h-3.5 w-3.5 ${
          presentation.spins ? "animate-spin motion-reduce:animate-none" : ""
        }`}
      />
      {presentation.label}
    </span>
  );
}
