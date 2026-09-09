import { useRef } from "react";

export function useStableImageUrl(url: string | null | undefined) {
  const ref = useRef(url);

  if (url !== ref.current) {
    if (!url || !ref.current) {
      ref.current = url;
    } else {
      const getBaseUrl = (u: string) => {
        try {
          const urlObj = new URL(u);
          urlObj.search = "";
          return urlObj.toString();
        } catch {
          return u.split("?")[0];
        }
      };

      if (getBaseUrl(url) !== getBaseUrl(ref.current)) {
        ref.current = url;
      }
    }
      }

  return ref.current;
}
