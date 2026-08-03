"use client";

import { BookOpen, RotateCcw } from "lucide-react";
import Link from "next/link";
import { SkeletonBlock } from "@/components/common/ui/skeleton-block";
import { CourseSearchFilterPanel } from "@/features/student/explore/screens/explore-courses-screen/components/course-search-filter-panel";
import { ExploreCourseSection } from "@/features/student/explore/screens/explore-courses-screen/components/explore-course-section";
import { EmptyCourseState } from "@/components/student/courses/empty-course-state";
import { StudentCoursesHeader } from "@/components/student/courses/student-courses-header";
import { StudentFullScreenState } from "@/components/student/student-full-screen-state";
import { useStudentCoursesFilter } from "@/features/student/explore/hooks/use-student-courses-filter";
import { getExploreAllCourseSections } from "@/features/student/shared/utils/student-courses-utils";
import { useStudentCourseDetailPrefetch } from "@/features/student/shared/hooks/use-student-courses-query";
import type { StudentCoursesListResult } from "@/features/student/shared/types/student-course-api-results";
import type { AppThemeMode } from "@/lib/theme-store";

export function ExploreCoursesScreen({
  initialData,
  initialThemeMode = "light",
}: {
  initialData?: StudentCoursesListResult | null;
  initialThemeMode?: AppThemeMode;
}) {
  const {
    catalog,
    coursesQuery,
    domainId,
    filteredCourses,
    isError,
    isLoading,
    query,
    refetch,
    setDomainId,
    setQuery,
    setTargetAudienceId,
    studentGrade,
    targetAudienceId,
  } = useStudentCoursesFilter(initialData);
  const prefetchCourseDetail = useStudentCourseDetailPrefetch();
  const isAllCoursesView = targetAudienceId === "ALL";
  const selectedTargetAudience =
    targetAudienceId === "ALL"
      ? null
      : (catalog.targetAudiences.find(
          (audience) => audience.id === targetAudienceId,
        ) ?? null);
  const {
    audienceGroups,
    purchasedCourses,
    recommendedCourseContexts,
    recommendedCourses,
  } = getExploreAllCourseSections(
      filteredCourses,
      studentGrade,
      catalog.targetAudiences,
    );
  const allCourseCardCount =
    purchasedCourses.length +
    recommendedCourses.length +
    audienceGroups.reduce((total, group) => total + group.courses.length, 0);
  const screenBackground = "var(--student-screen-bg)";

  if (isLoading) {
    return (
      <main
        aria-busy="true"
        className="min-h-screen w-full min-w-0 overflow-x-hidden"
        style={{ background: screenBackground }}
      >
        <div
          className="mx-auto grid w-full min-w-0 max-w-[560px] gap-4 overflow-x-hidden md:max-w-[960px] lg:max-w-[1320px]"
          style={{ background: screenBackground }}
        >
          <StudentCoursesHeader
            title="Danh sách khóa học"
            initialThemeMode={initialThemeMode}
          />
          <ExploreCoursesSkeleton />
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <StudentFullScreenState
        initialThemeMode={initialThemeMode}
        title="Chưa tải được danh sách khóa học"
        description="Bạn thử tải lại danh sách hoặc quay lại sau ít phút nhé."
        action={
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void refetch()}
              disabled={coursesQuery.isFetching}
              className="student-learn-cta-3d inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-sky-500 px-5 text-sm font-black text-white transition hover:bg-sky-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-sky-100 disabled:cursor-wait disabled:opacity-70"
            >
              <RotateCcw
                className={coursesQuery.isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                aria-hidden="true"
              />
              {coursesQuery.isFetching ? "Đang tải lại" : "Tải lại"}
            </button>
            <Link
              href="/student/courses"
              className="student-learn-cta-3d-emerald inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-5 text-sm font-black text-white transition hover:bg-emerald-400"
            >
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              Về khóa học của tôi
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <main
      className="min-h-screen w-full min-w-0 overflow-x-hidden"
      style={{ background: screenBackground }}
    >
      <div
        className="mx-auto grid w-full min-w-0 max-w-[560px] gap-4 overflow-x-hidden md:max-w-[960px] lg:max-w-[1320px]"
        style={{ background: screenBackground }}
      >
        <StudentCoursesHeader
          title="Danh sách khóa học"
          initialThemeMode={initialThemeMode}
        />

        <div className="grid min-w-0 gap-4 px-4 sm:px-6 lg:px-6">
          <CourseSearchFilterPanel
            catalog={catalog}
            domainId={domainId}
            query={query}
            targetAudienceId={targetAudienceId}
            onDomainChange={setDomainId}
            onQueryChange={setQuery}
            onTargetAudienceChange={setTargetAudienceId}
          />
        </div>

        {filteredCourses.length > 0 ? (
          <section
            className="grid min-w-0 gap-5 px-4 pb-2 sm:px-6 lg:px-6"
            aria-label="Danh sách tất cả khóa học"
          >
            {isAllCoursesView ? (
              <>
                {purchasedCourses.length > 0 ? (
                  <ExploreCourseSection
                    accentCount={allCourseCardCount}
                    accentOffset={0}
                    courses={purchasedCourses}
                    onPrefetch={prefetchCourseDetail}
                    title="Khóa học đã mua"
                    tone="purchased"
                  />
                ) : null}

                {recommendedCourses.length > 0 ? (
                  <ExploreCourseSection
                    accentCount={allCourseCardCount}
                    accentOffset={purchasedCourses.length}
                    courses={recommendedCourses}
                    onPrefetch={prefetchCourseDetail}
                    targetAudienceByCourseId={recommendedCourseContexts}
                    title="Khóa học phù hợp với bạn"
                  />
                ) : null}

                {audienceGroups.map((audienceGroup, index) => (
                  <ExploreCourseSection
                    accentCount={allCourseCardCount}
                    accentOffset={
                      purchasedCourses.length +
                      recommendedCourses.length +
                      audienceGroups
                        .slice(0, index)
                        .reduce((total, group) => total + group.courses.length, 0)
                    }
                    key={audienceGroup.id}
                    courses={audienceGroup.courses}
                    onPrefetch={prefetchCourseDetail}
                    targetAudienceGrade={audienceGroup.grade}
                    targetAudienceCode={audienceGroup.targetAudienceCode}
                    targetAudienceName={audienceGroup.targetAudienceName}
                    title={audienceGroup.title}
                    tone={audienceGroup.tone}
                  />
                ))}
              </>
            ) : (
              <ExploreCourseSection
                accentCount={filteredCourses.length}
                courses={filteredCourses}
                onPrefetch={prefetchCourseDetail}
                targetAudienceCode={selectedTargetAudience?.code}
                targetAudienceGrade={selectedTargetAudience?.grade}
                targetAudienceName={selectedTargetAudience?.name}
                title={`Dành cho ${selectedTargetAudience?.name ?? "đối tượng đã chọn"}`}
              />
            )}
          </section>
        ) : (
          <div className="px-4 sm:px-6 lg:px-6">
            <EmptyCourseState
              title="Chưa có khóa học phù hợp"
              description={
                coursesQuery.data?.meta.total === 0
                  ? "Hiện chưa có khóa học đã xuất bản nào để hiển thị."
                  : "Bạn thử đổi khối lớp, môn học hoặc từ khóa tìm kiếm để xem thêm khóa học khác nhé."
              }
            />
          </div>
        )}
      </div>
    </main>
  );
}

function ExploreCoursesSkeleton() {
  return (
    <div className="grid gap-4 px-4 sm:px-6 lg:px-6">
      <div className="grid animate-pulse gap-3 rounded-2xl bg-white p-4 dark:bg-[var(--theme-surface)] sm:grid-cols-[minmax(0,1fr)_9rem_9rem]">
        <SkeletonBlock className="h-11 rounded-xl" />
        <SkeletonBlock className="h-11 rounded-xl" />
        <SkeletonBlock className="h-11 rounded-xl" />
      </div>
      <SkeletonBlock className="h-5 w-40 rounded-full" />
      <EmptyCourseState
        isLoading
        title="Đang tải danh sách khóa học"
        description="ClassHero đang lấy các khóa học đã xuất bản phù hợp với bạn."
      />
    </div>
  );
}
