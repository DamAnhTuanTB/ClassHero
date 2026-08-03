import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "#api/common/prisma/prisma.service";
import { throwConflict, throwNotFound } from "#api/common/errors/api-exception";
import { CreateDomainDto } from "#api/modules/domains/dto/create-domain.dto";
import { ReorderDomainsDto } from "#api/modules/domains/dto/reorder-domains.dto";
import { UpdateDomainDto } from "#api/modules/domains/dto/update-domain.dto";

const domainSelect = {
  id: true,
  name: true,
  slug: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class DomainsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.domain.findMany({
      select: domainSelect,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  async catalogOptions() {
    const [domains, targetAudiences] = await Promise.all([
      this.prisma.domain.findMany({
        select: { id: true, name: true, slug: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
      this.prisma.targetAudience.findMany({
        select: { id: true, code: true, name: true, grade: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      }),
    ]);
    return { domains, targetAudiences };
  }

  async create(dto: CreateDomainDto) {
    const name = normalizeName(dto.name);
    const slug = toSlug(name);
    const [existing, lastDomain] = await Promise.all([
      this.prisma.domain.findUnique({ where: { slug }, select: { id: true } }),
      this.prisma.domain.findFirst({
        select: { sortOrder: true },
        orderBy: { sortOrder: "desc" },
      }),
    ]);

    if (existing) {
      throwConflict("DOMAIN_NAME_DUPLICATE", "Lĩnh vực này đã tồn tại.");
    }

    return this.prisma.domain.create({
      data: {
        name,
        slug,
        sortOrder: dto.sortOrder ?? (lastDomain?.sortOrder ?? 0) + 1,
      },
      select: domainSelect,
    });
  }

  async reorder(dto: ReorderDomainsDto) {
    const domains = await this.prisma.domain.findMany({ select: { id: true } });
    const knownDomainIds = new Set(domains.map((domain) => domain.id));

    if (
      domains.length !== dto.domainIds.length ||
      dto.domainIds.some((domainId) => !knownDomainIds.has(domainId))
    ) {
      throwConflict(
        "DOMAIN_CATALOG_CHANGED",
        "Danh sách lĩnh vực đã thay đổi. Vui lòng tải lại trước khi sắp xếp.",
      );
    }

    await this.prisma.$transaction(
      dto.domainIds.map((domainId, index) =>
        this.prisma.domain.update({
          where: { id: domainId },
          data: { sortOrder: index + 1 },
        }),
      ),
    );

    return this.list();
  }

  async update(id: string, dto: UpdateDomainDto) {
    const existing = await this.prisma.domain.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      throwNotFound("DOMAIN_NOT_FOUND", "Không tìm thấy lĩnh vực.");
    }
    const name = dto.name === undefined ? undefined : normalizeName(dto.name);
    const slug = name ? toSlug(name) : undefined;
    if (slug) {
      const duplicate = await this.prisma.domain.findFirst({
        where: { slug, NOT: { id } },
        select: { id: true },
      });
      if (duplicate) {
        throwConflict("DOMAIN_NAME_DUPLICATE", "Lĩnh vực này đã tồn tại.");
      }
    }
    return this.prisma.domain.update({
      where: { id },
      data: {
        ...(name ? { name, slug } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
      },
      select: domainSelect,
    });
  }

  async remove(id: string) {
    const inUse = await this.prisma.learningPath.count({ where: { domainId: id } });
    if (inUse > 0) {
      throwConflict(
        "DOMAIN_IN_USE",
        "Không thể xóa lĩnh vực đang được dùng bởi khóa học.",
        { inUse },
      );
    }
    const deleted = await this.prisma.domain
      .delete({ where: { id }, select: { id: true } })
      .catch(() => null);
    if (!deleted) {
      throwNotFound("DOMAIN_NOT_FOUND", "Không tìm thấy lĩnh vực.");
    }
    return { success: true };
  }
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function toSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
