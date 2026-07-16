"use client";

import { useCallback, useLayoutEffect, useState } from "react";

type PersistentBooleanUpdater = boolean | ((currentValue: boolean) => boolean);

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
      const storedValue = window.localStorage.getItem(storageKey);
      if (storedValue === "true") {
        setValue(true);
        syncDocumentDataset(true);
      } else if (storedValue === "false") {
        setValue(false);
        syncDocumentDataset(false);
      } else {
        syncDocumentDataset(defaultValue);
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
