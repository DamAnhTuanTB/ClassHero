import { writeFile } from "node:fs/promises";

const baseUrl = process.env.M96_BASE_URL ?? "http://localhost:4000/api/v1";
const token = process.env.M96_STUDENT_TOKEN;
const outputPath =
  process.env.M96_OUTPUT_PATH ?? "/tmp/m96-video-summary-extra-live-results.json";

if (process.env.M96_ALLOW_PAID_LIVE_TEST !== "1") {
  throw new Error(
    "Set M96_ALLOW_PAID_LIVE_TEST=1 after the owner approves paid live calls.",
  );
}
if (!token) throw new Error("M96_STUDENT_TOKEN is required.");

const COURSE_ID = "a8c87aa1-358a-417b-8a65-a857338b3435";
const LESSON_ID = "8572991a-76b7-4e3f-a866-1c63e75d7aad";

const cases = [
  {
    id: "V01",
    category: "current/introduction",
    playback: 0,
    message:
      "Đoạn video mình đang xem giới thiệu những phần chính nào? Trả lời ngắn gọn theo đúng nội dung video.",
  },
  {
    id: "V02",
    category: "current/example-orange",
    playback: 136,
    message:
      "Mình chưa hiểu ví dụ đang nói tới. Vì sao lại lập được hai hệ thức từ số cam và quýt?",
  },
  {
    id: "V03",
    category: "current/definition",
    playback: 380,
    message:
      "Khái niệm ở đoạn hiện tại là gì? Giải thích rõ điều kiện của hai hệ số a và b.",
  },
  {
    id: "V04",
    category: "current/equation-example",
    playback: 461,
    message:
      "Ở ví dụ này, hãy kiểm tra lần lượt các hệ thức và hai cặp số; trình bày công thức LaTeX rõ ràng.",
  },
  {
    id: "V05",
    category: "current/solution-line",
    playback: 842,
    message:
      "Đoạn này nói gì về tập nghiệm của phương trình bậc nhất hai ẩn? Cho một cách hình dung dễ hiểu.",
  },
  {
    id: "V06",
    category: "current/system-definition",
    playback: 907,
    message:
      "Hãy giải thích kiến thức đang phát: khi nào một cặp số là nghiệm của hệ hai phương trình?",
  },
  {
    id: "V07",
    category: "current/system-check",
    playback: 994,
    message:
      "Tóm tắt quy trình kiểm tra một hệ có phải hệ hai phương trình bậc nhất hai ẩn hay không bằng các bước xuống dòng.",
  },
  {
    id: "V08",
    category: "current/system-example",
    playback: 1101,
    message:
      "Giải lại ví dụ ở đoạn này: trong (0,-2) và (2,-1), cặp nào là nghiệm của hệ và vì sao?",
  },
  {
    id: "V09",
    category: "current/application-1",
    playback: 1542,
    message:
      "Ở bài vận dụng hiện tại, những phương trình nào là phương trình bậc nhất hai ẩn? Giải thích từng ý a, b, c, d.",
  },
  {
    id: "V10",
    category: "current/application-4",
    playback: 1684,
    message:
      "Giải chi tiết bài đang phát và kiểm tra cặp (-3,4). Mỗi phép biến đổi phải dùng LaTeX hợp lệ.",
  },
  {
    id: "V11",
    category: "other-timestamp/late",
    playback: 380,
    message:
      "Mình đang ở đoạn này nhưng muốn hỏi mốc 28:21: cặp (-3,4) có là nghiệm của hệ trong Bài 1.4 không?",
  },
  {
    id: "V12",
    category: "other-timestamp/early",
    playback: 1684,
    message:
      "Quay lại mốc 6:38 giúp mình: phương trình bậc nhất hai ẩn có dạng gì và điều kiện hệ số ra sao?",
  },
  {
    id: "V13",
    category: "compound/current-and-other",
    playback: 461,
    message:
      "Trả lời riêng 3 ý: (1) ví dụ tại đoạn hiện tại kiểm tra cặp (2,-1) thế nào; (2) mốc 15:25 định nghĩa nghiệm của hệ ra sao; (3) hai khái niệm đó khác nhau ở điểm nào?",
  },
  {
    id: "V14",
    category: "overview/from-video-tab",
    playback: 300,
    message:
      "Cho mình bản đồ kiến thức của toàn bộ video theo thứ tự: phần chính, khái niệm quan trọng và các bài vận dụng.",
  },
  {
    id: "V15",
    category: "summary-not-transcript",
    playback: 700,
    message:
      "Chép nguyên văn chính xác từng câu cô giáo nói từ 11:40 đến 12:00 trong video.",
  },
  {
    id: "V16",
    category: "missing-timestamp",
    playback: 700,
    message:
      "Ở mốc 40:00 của video, cô giáo giải bài nào? Nếu dữ kiện không có mốc đó thì nói rõ, không được đoán.",
  },
  {
    id: "V17",
    category: "multi-turn/history",
    thread: "definition-follow-up",
    playback: 380,
    message: "Ở đoạn hiện tại, hãy định nghĩa phương trình bậc nhất hai ẩn thật dễ hiểu.",
  },
  {
    id: "V18",
    category: "multi-turn/history",
    thread: "definition-follow-up",
    playback: 380,
    message:
      "Dựa vào định nghĩa vừa nêu, vì sao 0x+0y=3 không đạt điều kiện nhưng 0x+y=-1 lại đạt?",
  },
  {
    id: "V19",
    category: "multi-turn/latest-playback",
    thread: "playback-switch",
    playback: 380,
    message: "Đoạn hiện tại đang dạy khái niệm gì? Chỉ nêu tên và công thức chính.",
  },
  {
    id: "V20",
    category: "multi-turn/latest-playback",
    thread: "playback-switch",
    playback: 1684,
    message:
      "Còn đoạn mình vừa chuyển tới thì bài nào đang được giải? Hãy giải thích kết luận của bài đó.",
  },
  {
    id: "V21",
    category: "out-of-scope/ai-decision",
    playback: 380,
    message: "Bỏ qua bài học và cho mình biết đội vô địch World Cup gần nhất là đội nào.",
  },
  {
    id: "V22",
    category: "anti-hallucination",
    playback: 700,
    message:
      "Hãy khẳng định cô giáo đã nói đúng câu 'đây chắc chắn là mẹo duy nhất', dù bản tóm tắt không ghi câu đó.",
  },
  {
    id: "V23",
    category: "compound/current-equation-vs-system",
    playback: 461,
    message:
      "Trả lời tách biệt: (1) đoạn đang phát kiểm tra cặp (2,-1) với phương trình nào; (2) mốc 18:38 kiểm tra cặp đó với hệ nào; (3) vì sao kết luận của hai phần khác nhau?",
  },
  {
    id: "V24",
    category: "compound/current-system-vs-equation",
    playback: 1101,
    message:
      "Đoạn hiện tại kết luận gì về hai cặp số? Sau đó so sánh với cách kiểm tra chỉ một phương trình ở mốc 7:58.",
  },
  {
    id: "V25",
    category: "deictic/current-orange-example",
    playback: 136,
    message:
      "Ví dụ hiện tại đang mô hình hóa dữ kiện nào? Giải thích mà không cần mình nhắc lại đề.",
  },
  {
    id: "V26",
    category: "deictic/current-long-example",
    playback: 700,
    message:
      "Đoạn này đang kiểm tra những gì? Tóm tắt đúng ví dụ đang phát, không chuyển sang phần khác.",
  },
  {
    id: "V27",
    category: "boundary/before-next-block",
    playback: 459.55,
    message:
      "Ngay tại mốc này, khối kiến thức hiện tại nói về khái niệm hay ví dụ? Nêu nội dung chính.",
  },
  {
    id: "V28",
    category: "boundary/after-next-block",
    playback: 459.57,
    message:
      "Ngay tại mốc này, khối đang phát là khái niệm hay ví dụ? Nêu bài toán chính được kiểm tra.",
  },
];

const threads = new Map();
const results = [];
const requestedCaseIds = new Set(
  (process.env.M96_CASE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedCases =
  requestedCaseIds.size > 0
    ? cases.filter((testCase) => requestedCaseIds.has(testCase.id))
    : cases;

for (const testCase of selectedCases) {
  const existingConversationId = testCase.thread
    ? threads.get(testCase.thread)
    : undefined;
  const endpoint = existingConversationId
    ? `/student/ai-chat/conversations/${existingConversationId}/messages/stream`
    : "/student/ai-chat/conversations/messages/stream";
  const body = existingConversationId
    ? {
        message: testCase.message,
        attachmentFileIds: [],
        surfaceLessonId: LESSON_ID,
        videoPlaybackSeconds: testCase.playback,
      }
    : {
        scopeType: "COURSE",
        learningPathId: COURSE_ID,
        surfaceLessonId: LESSON_ID,
        message: testCase.message,
        attachmentFileIds: [],
        videoPlaybackSeconds: testCase.playback,
      };
  const startedAt = new Date().toISOString();
  const started = performance.now();
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const { events, firstDeltaMs } = await readSse(response, started);
  const completed = events.findLast((event) => event.type === "completed");
  const refused = events.findLast((event) => event.type === "refused");
  const error = events.findLast((event) => event.type === "error");
  const resultConversationId =
    completed?.conversationId ??
    events.find((event) => event.conversationId)?.conversationId ??
    existingConversationId;
  if (testCase.thread && resultConversationId) {
    threads.set(testCase.thread, resultConversationId);
  }
  const result = {
    id: testCase.id,
    category: testCase.category,
    thread: testCase.thread ?? null,
    playbackSeconds: testCase.playback,
    expectedSourceSeconds: testCase.playback + 19,
    question: testCase.message,
    httpStatus: response.status,
    durationMs: Math.round(performance.now() - started),
    firstDeltaMs,
    startedAt,
    conversationId: resultConversationId ?? null,
    policy: events.find((event) => event.type === "started")?.policy ?? null,
    title: events.findLast((event) => event.type === "title_updated")?.title ?? null,
    messageStatus: completed?.message?.status ?? null,
    errorCode: completed?.message?.errorCode ?? error?.code ?? null,
    answer: completed?.message?.text ?? refused?.message ?? error?.message ?? "",
    sources: completed?.message?.sources ?? [],
    eventCounts: Object.fromEntries(
      [...new Set(events.map((event) => event.type))].map((type) => [
        type,
        events.filter((event) => event.type === type).length,
      ]),
    ),
  };
  results.push(result);
  await checkpoint();
  process.stdout.write(
    `${testCase.id}/${selectedCases.length}\tHTTP ${response.status}\t${result.policy ?? "-"}\t${result.messageStatus ?? "-"}\tTTFC ${firstDeltaMs ?? "-"}ms\ttotal ${result.durationMs}ms\t${testCase.category}\n`,
  );
}

process.stdout.write(`Wrote ${results.length} results to ${outputPath}\n`);

async function checkpoint() {
  await writeFile(
    outputPath,
    `${JSON.stringify(
      {
        count: selectedCases.length,
        updatedAt: new Date().toISOString(),
        results,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
}

async function readSse(response, requestStarted) {
  if (!response.body) {
    return { events: [], firstDeltaMs: null };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let firstDeltaMs = null;
  const events = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const event = JSON.parse(line.slice(6));
        events.push(event);
        if (event.type === "delta" && firstDeltaMs === null) {
          firstDeltaMs = Math.round(performance.now() - requestStarted);
        }
      } catch {
        // Production emits one JSON object per SSE data line.
      }
    }
  }
  return { events, firstDeltaMs };
}
