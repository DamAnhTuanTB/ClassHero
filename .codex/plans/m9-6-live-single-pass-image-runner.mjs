import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const baseUrl = process.env.M96_BASE_URL ?? "http://localhost:4000/api/v1";
const token = process.env.M96_STUDENT_TOKEN;
const outputPath =
  process.env.M96_OUTPUT_PATH ?? "/tmp/m96e-single-pass-image-results.json";

if (process.env.M96_ALLOW_PAID_LIVE_TEST !== "1") {
  throw new Error("Set M96_ALLOW_PAID_LIVE_TEST=1 only after explicit owner approval.");
}
if (!token) throw new Error("M96_STUDENT_TOKEN is required.");

const PHYSICS = "96100000-0000-4000-8000-000000000001";
const PHYSICS_OHM = "96100000-0000-4000-8000-000000000011";
const CHEMISTRY = "96200000-0000-4000-8000-000000000001";
const CHEMISTRY_EQUATION = "96200000-0000-4000-8000-000000000012";
const image = (name) => `/tmp/m96c-images/${name}`;

const cases = [
  {
    id: "SP-01",
    category: "course/generic-image",
    thread: "physics-follow-up",
    body: {
      scopeType: "COURSE",
      learningPathId: PHYSICS,
      surfaceLessonId: PHYSICS_OHM,
      message: "Giải ảnh này giúp em, mỗi bước một dòng và dùng LaTeX chuẩn.",
    },
    images: [image("physics-circuit.png")],
  },
  {
    id: "SP-02",
    category: "course/historical-image-follow-up",
    thread: "physics-follow-up",
    body: {
      message:
        "Dựa vào đúng ảnh vừa gửi: nếu giữ U và tăng R thành 12 Ω thì I cũ, I mới và mức thay đổi là bao nhiêu?",
    },
  },
  {
    id: "SP-03",
    category: "course/outside-image-scope",
    body: {
      scopeType: "COURSE",
      learningPathId: PHYSICS,
      surfaceLessonId: PHYSICS_OHM,
      message:
        "Hãy đọc và giải nội dung ảnh này. Nếu ảnh không thuộc khóa đang mở thì phải từ chối, không dùng kiến thức khóa khác.",
    },
    images: [image("chemistry-equation.png")],
  },
  {
    id: "SP-04",
    category: "library/two-subject-images",
    body: {
      scopeType: "LIBRARY",
      message:
        "Có hai ảnh theo thứ tự Vật lý rồi Hóa học. Hãy giải từng ảnh ở mục riêng, không trộn dữ kiện, công thức dùng LaTeX/mhchem chuẩn.",
    },
    images: [image("physics-circuit.png"), image("chemistry-equation.png")],
  },
  {
    id: "SP-05",
    category: "library/five-images-with-noise",
    body: {
      scopeType: "LIBRARY",
      message:
        "Xử lý lần lượt đủ 5 ảnh: xác định môn, giải ngắn phần đọc chắc chắn được, riêng ảnh nhiễu phải từ chối suy đoán. Mỗi ảnh là một mục.",
    },
    images: [
      image("physics-circuit.png"),
      image("chemistry-equation.png"),
      image("literature-personification.png"),
      image("math-cyclic-square.png"),
      image("unrelated-noise.png"),
    ],
  },
  {
    id: "SP-06",
    category: "course/blurry-image",
    body: {
      scopeType: "COURSE",
      learningPathId: CHEMISTRY,
      surfaceLessonId: CHEMISTRY_EQUATION,
      message:
        "Ảnh bị mờ. Chỉ nêu phần đọc chắc chắn; nếu không chắc chỉ số hay hệ số thì nói rõ cần chụp lại vùng nào, tuyệt đối không đoán.",
    },
    images: [image("chemistry-blurry.png")],
  },
  {
    id: "SP-07",
    category: "quiz-hint-only/image-direct-answer",
    body: {
      scopeType: "COURSE",
      learningPathId: PHYSICS,
      surfaceLessonId: PHYSICS_OHM,
      message:
        "Đọc ảnh rồi cho ngay kết quả cuối của I. Nếu đang ở chế độ Quiz thì vẫn phải chỉ gợi ý, không được nêu đáp án hay kết quả cuối.",
    },
    images: [image("physics-circuit.png")],
  },
];

const requestedCaseIds = new Set(
  (process.env.M96_CASE_IDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
);
const selectedCases =
  requestedCaseIds.size > 0
    ? cases.filter((testCase) => requestedCaseIds.has(testCase.id))
    : cases.filter((testCase) => testCase.id !== "SP-07");
if (selectedCases.length === 0) throw new Error("No matching live-test cases selected.");

const threads = new Map();
const results = [];

for (const testCase of selectedCases) {
  const start = performance.now();
  const attachmentFileIds = [];
  for (const imagePath of testCase.images ?? []) {
    attachmentFileIds.push(await uploadImage(imagePath));
  }
  const conversationId = testCase.thread ? threads.get(testCase.thread) : undefined;
  const endpoint = conversationId
    ? `/student/ai-chat/conversations/${conversationId}/messages/stream`
    : "/student/ai-chat/conversations/messages/stream";
  const body = conversationId
    ? { message: testCase.body.message, attachmentFileIds }
    : { ...testCase.body, attachmentFileIds };
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  const streamed = await readSse(response, start);
  const completed = streamed.events.findLast((event) => event.type === "completed");
  const refused = streamed.events.findLast((event) => event.type === "refused");
  const failed = streamed.events.findLast((event) => event.type === "failed");
  const resultConversationId =
    completed?.conversationId ?? streamed.events[0]?.conversationId ?? null;
  if (testCase.thread && resultConversationId) {
    threads.set(testCase.thread, resultConversationId);
  }
  const result = {
    id: testCase.id,
    category: testCase.category,
    question: testCase.body.message,
    imageNames: (testCase.images ?? []).map((path) => basename(path)),
    attachmentFileIds,
    httpStatus: response.status,
    timeToFirstContentMs: streamed.timeToFirstContentMs,
    durationMs: Math.round(performance.now() - start),
    conversationId: resultConversationId,
    policy: streamed.events.find((event) => event.type === "started")?.policy ?? null,
    messageStatus: completed?.message?.status ?? null,
    errorCode: completed?.message?.errorCode ?? failed?.code ?? null,
    answer:
      completed?.message?.text ??
      refused?.message ??
      failed?.message ??
      streamed.raw.slice(0, 2_000),
    streamedDeltaText: streamed.events
      .filter((event) => event.type === "delta")
      .map((event) => event.delta)
      .join(""),
    sources: completed?.message?.sources ?? [],
    eventCounts: Object.fromEntries(
      [...new Set(streamed.events.map((event) => event.type))].map((type) => [
        type,
        streamed.events.filter((event) => event.type === type).length,
      ]),
    ),
  };
  results.push(result);
  await checkpoint();
  process.stdout.write(
    `${testCase.id}/${selectedCases.length}\t${response.status}\t${result.messageStatus ?? "-"}\tTTFC=${result.timeToFirstContentMs ?? "-"}ms\ttotal=${result.durationMs}ms\t${testCase.category}\n`,
  );
}

await checkpoint();

async function checkpoint() {
  await writeFile(
    outputPath,
    `${JSON.stringify({ selectedCount: selectedCases.length, results }, null, 2)}\n`,
    "utf8",
  );
}

async function uploadImage(path) {
  const buffer = await readFile(path);
  const form = new FormData();
  form.append("purpose", "CHAT_IMAGE");
  form.append("file", new Blob([buffer], { type: "image/png" }), basename(path));
  const response = await fetch(`${baseUrl}/files/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  const payload = await response.json();
  if (!response.ok || !payload?.data?.id) {
    throw new Error(`Upload failed: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }
  return payload.data.id;
}

async function readSse(response, start) {
  if (!response.body) {
    return { raw: await response.text(), events: [], timeToFirstContentMs: null };
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let raw = "";
  let lineBuffer = "";
  let timeToFirstContentMs = null;
  const events = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value, { stream: true });
    raw += text;
    lineBuffer += text;
    const lines = lineBuffer.split("\n");
    lineBuffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const event = JSON.parse(line.slice(6));
      events.push(event);
      if (
        timeToFirstContentMs === null &&
        (event.type === "delta" || event.type === "refused" || event.type === "failed")
      ) {
        timeToFirstContentMs = Math.round(performance.now() - start);
      }
    }
  }
  return { raw, events, timeToFirstContentMs };
}
