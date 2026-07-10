import { Prisma } from "@prisma/client";

export const authUserSelect = {
  id: true,
  role: true,
  status: true,
  email: true,
  phone: true,
  username: true,
  passwordHash: true,
  fullName: true,
  deletedAt: true,
  studentProfile: {
    select: {
      grade: true,
    },
  },
} satisfies Prisma.UserSelect;

export const currentUserSelect = {
  id: true,
  role: true,
  status: true,
  email: true,
  phone: true,
  username: true,
  fullName: true,
  gender: true,
  dateOfBirth: true,
  avatarFileId: true,
  lastLoginAt: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  createdAt: true,
  deletedAt: true,
  studentProfile: {
    select: {
      id: true,
      grade: true,
      childCode: true,
      address: true,
      displayName: true,
      totalXp: true,
      level: true,
    },
  },
  parentProfile: {
    select: {
      id: true,
    },
  },
} satisfies Prisma.UserSelect;
