export interface YoutubeChapter {
  time: number;
  title: string;
}

const LEADING_CHAPTER_NUMBER_PATTERN = /^\s*\d+\s*(?:[.)](?!\d)|[-–—:])\s*/u;

export function normalizeYoutubeChapterTitles(
  chapters: readonly YoutubeChapter[],
): YoutubeChapter[] {
  return chapters
    .map((chapter) => {
      const trimmedTitle = chapter.title.trim();
      const titleWithoutNumber = trimmedTitle
        .replace(LEADING_CHAPTER_NUMBER_PATTERN, "")
        .trim();

      return {
        ...chapter,
        title: titleWithoutNumber || trimmedTitle,
      };
    })
    .sort((left, right) => left.time - right.time);
}
