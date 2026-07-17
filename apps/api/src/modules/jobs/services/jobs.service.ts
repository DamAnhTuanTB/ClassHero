import { Inject, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { throwForbidden, throwNotFound } from "#api/common/errors/api-exception";
import { PrismaService } from "#api/common/prisma/prisma.service";
import type { AuthenticatedUser } from "#api/common/auth/authenticated-request";
import { jobSelect } from "#api/modules/jobs/selectors/job.selects";
import { serializeJob } from "#api/modules/jobs/serializers/job.serializers";

@Injectable()
export class JobsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async getById(jobId: string, actor: AuthenticatedUser) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: {
        id: jobId,
      },
      select: jobSelect,
    });

    if (!job) {
      throwNotFound("NOT_FOUND", "Không tìm thấy job");
    }

    if (actor.role !== UserRole.ADMIN && job.ownerUserId !== actor.id) {
      throwForbidden("FORBIDDEN", "Bạn không có quyền xem job này");
    }

    return serializeJob(job);
  }
}
