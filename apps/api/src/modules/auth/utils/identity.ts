import { Prisma } from "@prisma/client";
import { randomInt } from "node:crypto";
import { throwInternalServerError } from "#api/common/errors/api-exception";
import { throwDuplicate } from "#api/modules/auth/utils/errors";

export async function assertUniqueIdentity(
  tx: Prisma.TransactionClient,
  identity: {
    email?: string;
    phone?: string;
    username?: string;
  },
) {
  const filters: Prisma.UserWhereInput[] = [];

  if (identity.email) {
    filters.push({ email: identity.email });
  }

  if (identity.phone) {
    filters.push({ phone: identity.phone });
  }

  if (identity.username) {
    filters.push({ username: identity.username });
  }

  const existingUsers = await tx.user.findMany({
    where: { OR: filters },
    select: {
      email: true,
      phone: true,
      username: true,
    },
  });

  for (const existingUser of existingUsers) {
    if (identity.email && existingUser.email === identity.email) {
      throwDuplicate("DUPLICATE_EMAIL", "Email đã được sử dụng");
    }

    if (identity.phone && existingUser.phone === identity.phone) {
      throwDuplicate("DUPLICATE_PHONE", "Số điện thoại đã được sử dụng");
    }

    if (identity.username && existingUser.username === identity.username) {
      throwDuplicate("DUPLICATE_USERNAME", "Username đã được sử dụng");
    }
  }
}

export async function createUniqueChildCode(tx: Prisma.TransactionClient) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = `LP${randomInt(100000, 999999)}`;
    const existingProfile = await tx.studentProfile.findUnique({
      where: { childCode: code },
      select: { id: true },
    });

    if (!existingProfile) {
      return code;
    }
  }

  throwInternalServerError("INTERNAL_SERVER_ERROR", "Không thể tạo mã liên kết học sinh");
}
