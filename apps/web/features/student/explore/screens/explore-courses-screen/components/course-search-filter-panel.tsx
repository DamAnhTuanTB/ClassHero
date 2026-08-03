"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { CourseFilterSelect } from "@/features/student/explore/screens/explore-courses-screen/components/course-filter-select";
import type { StudentCourseCatalogOptionsApi } from "@/features/student/shared/types/student-course-api-types";
import { useDebouncedValue } from "@/lib/use-debounced-value";
import { cn } from "@/lib/utils";

export function CourseSearchFilterPanel({
  catalog,
  domainId,
  query,
  targetAudienceId,
  onDomainChange,
  onQueryChange,
  onTargetAudienceChange,
}: {
  catalog: StudentCourseCatalogOptionsApi;
  domainId: string;
  query: string;
  targetAudienceId: string;
  onDomainChange: (domainId: string) => void;
  onQueryChange: (query: string) => void;
  onTargetAudienceChange: (targetAudienceId: string) => void;
}) {
  const targetAudienceOptions = [
    { label: "Tất cả", value: "ALL" },
    ...catalog.targetAudiences.map((option) => ({
      label: option.name,
      value: option.id,
    })),
  ];
  const domainOptions = [
    { label: "Tất cả", value: "ALL" },
    ...catalog.domains.map((option) => ({
      label: option.name,
      value: option.id,
    })),
  ];
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [queryInput, setQueryInput] = useState(query);
  const debouncedQuery = useDebouncedValue(queryInput);
  const isClearVisible = isSearchFocused || Boolean(queryInput);

  useEffect(() => {
    setQueryInput(query);
  }, [query]);

  useEffect(() => {
    if (debouncedQuery !== query) {
      onQueryChange(debouncedQuery);
    }
  }, [debouncedQuery, onQueryChange, query]);

  return (
    <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(20rem,0.95fr)_minmax(24rem,1fr)] lg:items-end">
      <div
        className="grid min-w-0 gap-2"
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setIsSearchFocused(false);
          }
        }}
        onFocusCapture={() => setIsSearchFocused(true)}
      >
        <p className="hidden text-[15px] font-extrabold leading-none text-slate-700 dark:text-[var(--theme-text)] lg:block">
          Tìm kiếm
        </p>
        <div
          className={cn(
            "grid min-w-0 items-center overflow-visible transition-[grid-template-columns,gap] duration-200 ease-out",
            isClearVisible
              ? "grid-cols-[minmax(0,1fr)_2rem] gap-2"
              : "grid-cols-[minmax(0,1fr)_0rem] gap-0",
          )}
        >
          <label className="group relative block min-w-0">
            <span className="sr-only">Tìm khóa học</span>
            <Search
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 transition group-focus-within:text-sky-400 dark:group-focus-within:text-sky-400"
              aria-hidden="true"
            />
            <input
              type="text"
              role="searchbox"
              value={queryInput}
              inputMode="search"
              autoComplete="off"
              placeholder="Nhập tên khóa học, khối lớp, môn học,..."
              className="student-filter-select-3d h-12 w-full rounded-2xl border border-sky-100 bg-white pl-12 pr-3 text-[15px] font-semibold text-slate-700 shadow-none outline-none transition placeholder:font-semibold placeholder:text-slate-400 focus:border-sky-400 focus:ring-2 focus:ring-sky-100 dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-strong)] dark:focus:border-sky-500/60 dark:focus:ring-1 dark:focus:ring-sky-500/25"
              onChange={(event) => setQueryInput(event.target.value)}
            />
          </label>
          <button
            type="button"
            aria-label="Xóa từ khóa tìm kiếm"
            disabled={!queryInput}
            className={cn(
              "flex h-8 w-8 translate-x-3 items-center justify-center justify-self-end rounded-full border border-sky-100 bg-white text-slate-500 opacity-0 shadow-none transition duration-200 ease-out hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-100 dark:focus-visible:ring-1 dark:focus-visible:ring-sky-500/15 disabled:cursor-default dark:border-[var(--theme-border)] dark:bg-[var(--theme-surface)] dark:text-[var(--theme-text-muted)] dark:hover:bg-[var(--theme-surface-soft)] dark:hover:text-[var(--theme-text-strong)]",
              isClearVisible && "translate-x-0 opacity-100",
            )}
            onClick={(event) => {
              setQueryInput("");
              onQueryChange("");
              setIsSearchFocused(false);
              event.currentTarget.blur();
            }}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="grid min-w-0 grid-cols-2 gap-3">
        <div className="grid min-w-0 gap-2">
          <p className="text-[15px] font-extrabold leading-none text-slate-700 dark:text-[var(--theme-text)]">
            Khối lớp
          </p>
          <CourseFilterSelect
            ariaLabel="Chọn khối lớp"
            className="student-filter-select-3d"
            value={targetAudienceId}
            options={targetAudienceOptions}
            onChange={onTargetAudienceChange}
          />
        </div>

        <div className="grid min-w-0 gap-2">
          <p className="text-[15px] font-extrabold leading-none text-slate-700 dark:text-[var(--theme-text)]">
            Môn học
          </p>
          <CourseFilterSelect
            ariaLabel="Chọn môn học"
            className="student-filter-select-3d"
            value={domainId}
            options={domainOptions}
            onChange={onDomainChange}
          />
        </div>
      </div>
    </section>
  );
}
