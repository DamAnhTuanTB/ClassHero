"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useStudentLearningTransition } from "@/components/student/learning-transition/student-learning-transition-provider";

type StudentLessonTransitionLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onClick"
> & {
  lessonId: string;
};

export function StudentLessonTransitionLink({
  lessonId,
  target,
  ...props
}: StudentLessonTransitionLinkProps) {
  const { isTransitioning, openLesson } = useStudentLearningTransition();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      target === "_blank"
    ) {
      return;
    }

    event.preventDefault();
    void openLesson(lessonId);
  }

  return (
    <Link
      {...props}
      href={`/student/lessons/${lessonId}`}
      target={target}
      aria-busy={isTransitioning || undefined}
      onClick={handleClick}
    />
  );
}
