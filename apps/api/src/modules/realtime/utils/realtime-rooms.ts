export function realtimeUserRoom(userId: string) {
  return `user:${userId}`;
}

export function realtimeLessonRoom(lessonId: string) {
  return `lesson:${lessonId}`;
}
