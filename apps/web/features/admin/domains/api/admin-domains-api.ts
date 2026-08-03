import { apiRequest } from "@/lib/api-client";

export type AdminDomain = {
  id: string;
  name: string;
  slug: string;
  sortOrder?: number;
};
export type AdminTargetAudience = {
  id: string;
  code: string;
  name: string;
  grade: number | null;
  sortOrder?: number;
};
export type AdminCatalogOptions = {
  domains: AdminDomain[];
  targetAudiences: AdminTargetAudience[];
};

export function getAdminCatalogOptions(token: string) {
  return apiRequest<AdminCatalogOptions>("/admin/domains/catalog-options", { token });
}

export function listAdminDomains(token: string) {
  return apiRequest<AdminDomain[]>("/admin/domains", { token });
}

export function createAdminDomain(name: string, token: string) {
  return apiRequest<AdminDomain>("/admin/domains", {
    method: "POST",
    body: { name },
    token,
  });
}

export function updateAdminDomain(id: string, name: string, token: string) {
  return apiRequest<AdminDomain>(`/admin/domains/${id}`, {
    method: "PATCH",
    body: { name },
    token,
  });
}

export function reorderAdminDomains(domainIds: string[], token: string) {
  return apiRequest<AdminDomain[]>("/admin/domains/reorder", {
    method: "PATCH",
    body: { domainIds },
    token,
  });
}

export function deleteAdminDomain(id: string, token: string) {
  return apiRequest<{ success: boolean }>(`/admin/domains/${id}`, {
    method: "DELETE",
    token,
  });
}
