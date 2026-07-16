import type { SVGProps } from "react";

export function MessengerIcon({ strokeWidth = 1.75, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={strokeWidth}
        d="M12 3.15c-5.13 0-9.25 3.68-9.25 8.22 0 2.55 1.3 4.82 3.34 6.33v3.15l3.02-1.67c.9.25 1.87.38 2.89.38 5.13 0 9.25-3.68 9.25-8.19 0-4.54-4.12-8.22-9.25-8.22Z"
      />
      <path
        fill="currentColor"
        d="m6.85 13.9 4.82-5.14 2.26 2.4 3.22-1.78-4.82 5.14-2.26-2.4-3.22 1.78Z"
      />
    </svg>
  );
}
