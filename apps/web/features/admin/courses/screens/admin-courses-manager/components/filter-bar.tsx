import { Search, SlidersHorizontal, X } from "lucide-react";
import { OptionField } from "@/components/common/forms/option-field";
import { TextField } from "@/components/common/forms/text-field";
import {
  adminStatuses,
  statusLabels,
  type AdminPublishStatus,
} from "@/features/admin/courses/admin-courses-data";
import type {
  AdminDomain,
  AdminTargetAudience,
} from "@/features/admin/domains/api/admin-domains-api";

export function FilterBar({
  domains,
  domainFilter,
  query,
  statusFilter,
  targetAudiences,
  targetAudienceFilter,
  onDomainChange,
  onQueryChange,
  onStatusChange,
  onTargetAudienceChange,
}: {
  isDarkTheme?: boolean;
  domains: AdminDomain[];
  domainFilter: string | "ALL";
  query: string;
  statusFilter: AdminPublishStatus | "ALL";
  targetAudiences: AdminTargetAudience[];
  targetAudienceFilter: string | "ALL";
  onDomainChange: (value: string | "ALL") => void;
  onQueryChange: (value: string) => void;
  onStatusChange: (value: AdminPublishStatus | "ALL") => void;
  onTargetAudienceChange: (value: string | "ALL") => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface)] p-3">
      <div className="flex items-center gap-2 text-sm font-extrabold text-[var(--theme-text-strong)]">
        <SlidersHorizontal
          className="h-4 w-4 text-[var(--theme-primary)]"
          aria-hidden="true"
        />
        Bộ lọc
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.2fr)_0.6fr_0.7fr_0.7fr]">
        <TextField
          id="admin-course-filter-query"
          label="Tìm khóa học"
          hideLabel
          value={query}
          icon={<Search className="h-5 w-5" aria-hidden="true" />}
          placeholder="Tìm khóa học, lĩnh vực, đối tượng"
          onChange={(event) => onQueryChange(event.target.value)}
          trailingAction={
            query ? (
              <button
                type="button"
                aria-label="Xóa từ khóa tìm kiếm"
                onClick={() => onQueryChange("")}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[var(--theme-text-muted)] transition hover:bg-[var(--theme-surface-soft)] hover:text-[var(--theme-text-strong)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-focus-ring)] dark:focus:ring-1 dark:focus:ring-sky-500/15"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null
          }
        />
        <OptionField
          id="admin-course-filter-grade"
          label="Đối tượng"
          hideLabel
          value={targetAudienceFilter}
          icon={null}
          onChange={onTargetAudienceChange}
          options={[
            { value: "ALL", label: "Tất cả đối tượng" },
            ...targetAudiences.map((audience) => ({
              value: audience.id,
              label: audience.name,
            })),
          ]}
        />
        <OptionField
          id="admin-course-filter-subject"
          label="Lĩnh vực"
          hideLabel
          value={domainFilter}
          icon={null}
          onChange={onDomainChange}
          options={[
            { value: "ALL", label: "Tất cả lĩnh vực" },
            ...domains.map((domain) => ({
              value: domain.id,
              label: domain.name,
            })),
          ]}
        />
        <OptionField
          id="admin-course-filter-status"
          label="Trạng thái"
          hideLabel
          value={statusFilter}
          icon={null}
          onChange={(value) => onStatusChange(value as AdminPublishStatus | "ALL")}
          options={[
            { value: "ALL", label: "Tất cả trạng thái" },
            ...adminStatuses.map((status) => ({
              value: status,
              label: statusLabels[status],
            })),
          ]}
        />
      </div>
    </div>
  );
}
