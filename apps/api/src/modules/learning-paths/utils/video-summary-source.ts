import { hashAiValue } from "#api/modules/ai/utils/ai-hash";

type RecordValue = Record<string, unknown>;
const LEADING_CHAPTER_NUMBER_PATTERN = /^\s*\d+\s*(?:[.)](?!\d)|[-–—:])\s*/u;

export type VideoSummarySource = {
  videoUrl: string;
  transcript: Array<{ time: number; endTime?: number; text: string }>;
  chapters: Array<{ time: number; title: string }>;
  language: string | null;
  hashes: {
    videoUrl: string;
    transcript: string;
    chapters: string;
    playerSettings: string;
    source: string;
  };
};

export function buildVideoSummarySource(input: {
  videoUrl: string | null;
  customVideoSettings: unknown;
}): VideoSummarySource | null {
  const videoUrl = input.videoUrl?.trim();
  const settings = record(input.customVideoSettings);
  if (!videoUrl || !settings) return null;
  const transcript = Array.isArray(settings.transcript)
    ? settings.transcript
        .flatMap((item) => {
          const value = record(item);
          const time = numberOr(value?.time, -1);
          const text = typeof value?.text === "string" ? value.text.trim() : "";
          return time >= 0 && text
            ? [
                {
                  time: round(time),
                  ...(typeof value?.endTime === "number"
                    ? { endTime: round(Math.max(time, value.endTime)) }
                    : {}),
                  text,
                },
              ]
            : [];
        })
        .sort((left, right) => left.time - right.time)
    : [];
  if (!transcript.length) return null;
  const chapters = Array.isArray(settings.chapters)
    ? settings.chapters
        .flatMap((item) => {
          const value = record(item);
          const time = numberOr(value?.time, -1);
          const title = typeof value?.title === "string" ? value.title.trim() : "";
          return time >= 0 && title
            ? [{ time: round(time), title: normalizeVideoSummaryChapterTitle(title) }]
            : [];
        })
        .sort((left, right) => left.time - right.time)
    : [];
  const language =
    typeof settings.transcriptLanguage === "string"
      ? settings.transcriptLanguage.trim() || null
      : null;
  const hashes = {
    videoUrl: hashAiValue(videoUrl),
    transcript: hashAiValue(transcript),
    chapters: hashAiValue(chapters),
    // Video Summary is always generated for the original video. Lesson-player
    // cut settings must neither trim/rebase the source nor make the summary stale.
    playerSettings: hashAiValue({ timeline: "ORIGINAL_VIDEO" }),
    source: "",
  };
  hashes.source = hashAiValue(hashes);
  return { videoUrl, transcript, chapters, language, hashes };
}

export function normalizeVideoSummaryChapterTitle(value: string) {
  const trimmedTitle = value.trim();
  const titleWithoutNumber = trimmedTitle
    .replace(LEADING_CHAPTER_NUMBER_PATTERN, "")
    .trim();
  return titleWithoutNumber || trimmedTitle;
}

export function serializeVideoSummarySourceText(source: VideoSummarySource) {
  const transcript = source.transcript
    .map(
      (item) =>
        `<cue startSeconds="${item.time}">${item.text.replaceAll("</cue>", "")}</cue>`,
    )
    .join(" ");
  const chapters =
    source.chapters
      .map((item) => `[${formatTime(item.time)}] ${item.title}`)
      .join("\n") || "Không có mốc chương.";
  return `MỐC THỜI GIAN:\n${chapters}\n\nBẢN CHÉP LỜI THEO CUE (các cue nối liền mạch; startSeconds chỉ dùng để xác định thời điểm bắt đầu khối):\n${transcript}`;
}

function record(value: unknown): RecordValue | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}
function numberOr(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
function round(value: number) {
  return Math.round(value * 100) / 100;
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
