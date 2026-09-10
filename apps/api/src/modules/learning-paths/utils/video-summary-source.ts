import { hashAiValue } from "#api/modules/ai/utils/ai-hash";

type RecordValue = Record<string, unknown>;
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
  const start = numberOr(settings.startTimeInSeconds, 0);
  const transcript = Array.isArray(settings.transcript)
    ? settings.transcript.flatMap((item) => {
        const value = record(item);
        const time = numberOr(value?.time, -1);
        const text = typeof value?.text === "string" ? value.text.trim() : "";
        return time >= start && text
          ? [
              {
                time: round(time - start),
                ...(typeof value?.endTime === "number"
                  ? { endTime: round(Math.max(0, value.endTime - start)) }
                  : {}),
                text,
              },
            ]
          : [];
      })
    : [];
  if (!transcript.length) return null;
  const chapters = Array.isArray(settings.chapters)
    ? settings.chapters.flatMap((item) => {
        const value = record(item);
        const time = numberOr(value?.time, -1);
        const title = typeof value?.title === "string" ? value.title.trim() : "";
        return time >= start && title ? [{ time: round(time - start), title }] : [];
      })
    : [];
  const language =
    typeof settings.transcriptLanguage === "string"
      ? settings.transcriptLanguage.trim() || null
      : null;
  const hashes = {
    videoUrl: hashAiValue(videoUrl),
    transcript: hashAiValue(transcript),
    chapters: hashAiValue(chapters),
    playerSettings: hashAiValue({
      startTimeInSeconds: settings.startTimeInSeconds ?? null,
      endTimeCutInSeconds: settings.endTimeCutInSeconds ?? null,
    }),
    source: "",
  };
  hashes.source = hashAiValue(hashes);
  return { videoUrl, transcript, chapters, language, hashes };
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
