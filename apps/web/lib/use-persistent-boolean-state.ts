"use client";

import { useCallback, useLayoutEffect, useState } from "react";

type PersistentBooleanUpdater = boolean | ((currentValue: boolean) => boolean);
const persistentBooleanCookieMaxAgeSeconds = 60 * 60 * 24 * 365;

function readCookieValue(cookieKey: string) {
  const encodedCookieKey = encodeURIComponent(cookieKey);

  return (
    document.cookie
      .split("; ")
      .find((cookie) => cookie.startsWith(`${encodedCookieKey}=`))
      ?.slice(encodedCookieKey.length + 1) ?? null
  );
}

function writeCookieValue(cookieKey: string, value: boolean) {
  const secureAttribute = window.location.protocol === "https:" ? "; Secure" : "";

  document.cookie = `${encodeURIComponent(cookieKey)}=${String(value)}; path=/; max-age=${persistentBooleanCookieMaxAgeSeconds}; SameSite=Lax${secureAttribute}`;
}

export function usePersistentBooleanState(
  storageKey: string,
  defaultValue = false,
  datasetKey?: string,
) {
  const [value, setValue] = useState(defaultValue);

  const syncDocumentDataset = useCallback(
    (nextValue: boolean) => {
      if (datasetKey) {
        document.documentElement.dataset[datasetKey] = String(nextValue);
      }
    },
    [datasetKey],
  );

  useLayoutEffect(() => {
    try {
      const storedValue =
        readCookieValue(storageKey) ?? window.localStorage.getItem(storageKey);
      if (storedValue === "true") {
        setValue(true);
        syncDocumentDataset(true);
        window.localStorage.setItem(storageKey, "true");
        writeCookieValue(storageKey, true);
      } else if (storedValue === "false") {
        setValue(false);
        syncDocumentDataset(false);
        window.localStorage.setItem(storageKey, "false");
        writeCookieValue(storageKey, false);
      } else {
        syncDocumentDataset(defaultValue);
        writeCookieValue(storageKey, defaultValue);
      }
    } catch {
      syncDocumentDataset(defaultValue);
      document.documentElement.dataset.storage = "unavailable";
    }
  }, [defaultValue, storageKey, syncDocumentDataset]);

  const setPersistentValue = useCallback(
    (nextValue: PersistentBooleanUpdater) => {
      setValue((currentValue) => {
        const resolvedValue =
          typeof nextValue === "function" ? nextValue(currentValue) : nextValue;

        syncDocumentDataset(resolvedValue);

        try {
          window.localStorage.setItem(storageKey, String(resolvedValue));
          writeCookieValue(storageKey, resolvedValue);
        } catch {
          document.documentElement.dataset.storage = "unavailable";
        }

        return resolvedValue;
      });
    },
    [storageKey, syncDocumentDataset],
  );

  return [value, setPersistentValue] as const;
}
