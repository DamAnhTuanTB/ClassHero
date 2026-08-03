"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type FilterSearchParamValue = number | string | null | undefined;
type FilterSearchParamUpdates = Record<string, FilterSearchParamValue>;

export const resetFilterSearchParamsEvent = "learning-path:reset-filter-search-params";

export function useFilterSearchParams() {
  const pathname = usePathname();
  const routeSearchParams = useSearchParams();
  const routeSearchParamsString = routeSearchParams.toString();
  const [searchParamsString, setSearchParamsString] = useState(routeSearchParamsString);
  const searchParamsStringRef = useRef(searchParamsString);
  const searchParams = useMemo(
    () => new URLSearchParams(searchParamsString),
    [searchParamsString],
  );

  useEffect(() => {
    searchParamsStringRef.current = routeSearchParamsString;
    setSearchParamsString(routeSearchParamsString);
  }, [routeSearchParamsString]);

  useEffect(() => {
    function syncSearchParamsFromBrowserHistory() {
      const nextSearchParamsString = window.location.search.slice(1);

      searchParamsStringRef.current = nextSearchParamsString;
      setSearchParamsString(nextSearchParamsString);
    }

    window.addEventListener("popstate", syncSearchParamsFromBrowserHistory);
    window.addEventListener(resetFilterSearchParamsEvent, syncSearchParamsFromBrowserHistory);

    return () => {
      window.removeEventListener("popstate", syncSearchParamsFromBrowserHistory);
      window.removeEventListener(
        resetFilterSearchParamsEvent,
        syncSearchParamsFromBrowserHistory,
      );
    };
  }, []);

  const replaceFilterSearchParams = useCallback(
    (updates: FilterSearchParamUpdates) => {
      const nextSearchParams = new URLSearchParams(searchParamsStringRef.current);

      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          nextSearchParams.delete(key);
        } else {
          nextSearchParams.set(key, String(value));
        }
      }

      const nextSearch = nextSearchParams.toString();
      const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${window.location.hash}`;

      searchParamsStringRef.current = nextSearch;
      setSearchParamsString(nextSearch);
      window.history.replaceState(window.history.state, "", nextUrl);
    },
    [pathname],
  );

  return {
    replaceFilterSearchParams,
    searchParams,
  };
}
