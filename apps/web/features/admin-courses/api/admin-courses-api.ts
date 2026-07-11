import {
  adminLearningPaths,
  type AdminLearningPath,
} from "@/features/admin-courses/data";

const mockLatencyMs = Number(process.env.NEXT_PUBLIC_ADMIN_COURSES_MOCK_LATENCY_MS ?? 0);

export async function listAdminLearningPaths() {
  await delayMockLatency();

  return getAdminLearningPathsSnapshot();
}

export async function getAdminLearningPath(pathId: string) {
  await delayMockLatency();

  return getAdminLearningPathSnapshot(pathId);
}

export function getAdminLearningPathsSnapshot() {
  return cloneLearningPaths(adminLearningPaths);
}

export function getAdminLearningPathSnapshot(pathId: string) {
  return getAdminLearningPathsSnapshot().find((path) => path.id === pathId) ?? null;
}

function cloneLearningPaths(paths: AdminLearningPath[]) {
  return structuredClone(paths);
}

async function delayMockLatency() {
  if (mockLatencyMs <= 0) {
    return;
  }

  await delay(mockLatencyMs);
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
