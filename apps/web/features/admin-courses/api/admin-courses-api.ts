import {
  adminLearningPaths,
  type AdminLearningPath,
} from "@/features/admin-courses/data";

const mockLatencyMs = 360;

export async function listAdminLearningPaths() {
  await delay(mockLatencyMs);

  return cloneLearningPaths(adminLearningPaths);
}

export async function getAdminLearningPath(pathId: string) {
  await delay(mockLatencyMs);

  return (
    cloneLearningPaths(adminLearningPaths).find((path) => path.id === pathId) ?? null
  );
}

function cloneLearningPaths(paths: AdminLearningPath[]) {
  return structuredClone(paths);
}

function delay(ms: number) {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}
