import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";

const baseUrl = process.env.M96_BASE_URL ?? "http://localhost:4000/api/v1";
const token = process.env.M96_STUDENT_TOKEN;
const outputPath = process.env.M96_OUTPUT_PATH ?? "/tmp/m96d-visual-results.json";

if (process.env.M96_ALLOW_PAID_LIVE_TEST !== "1") {
  throw new Error("Set M96_ALLOW_PAID_LIVE_TEST=1 only after explicit owner approval.");
}
if (!token) throw new Error("M96_STUDENT_TOKEN is required.");

const PHYSICS = "96100000-0000-4000-8000-000000000001";
const PHYSICS_OHM = "96100000-0000-4000-8000-000000000011";
const CHEMISTRY = "96200000-0000-4000-8000-000000000001";
const CHEMISTRY_MOL = "96200000-0000-4000-8000-000000000011";
const LITERATURE = "96300000-0000-4000-8000-000000000001";
const LITERATURE_ARGUMENT = "96300000-0000-4000-8000-000000000011";
const image = (name) => `/tmp/m96c-images/${name}`;

const cases = [
  {
    id: "25",
    category: "visual-generic/physics",
    thread: "generic-physics-chain",
    body: {
      scopeType: "COURSE",
      learningPathId: PHYSICS,
      surfaceLessonId: PHYSICS_OHM,
      message: "Giải ảnh này giúp em.",
    },
    images: [image("physics-circuit.png")],
  },
  {
    id: "26",
    category: "visual-generic/historical-follow-up",
    thread: "generic-physics-chain",
    body: { message: "Giải lại ảnh đó." },
  },
  {
    id: "27",
    category: "visual-generic/chemistry",
    body: {
      scopeType: "COURSE",
      learningPathId: CHEMISTRY,
      surfaceLessonId: CHEMISTRY_MOL,
      message: "Ảnh này nói gì?",
    },
    images: [image("chemistry-equation.png")],
  },
  {
    id: "28",
    category: "visual-generic/literature",
    body: {
      scopeType: "COURSE",
      learningPathId: LITERATURE,
      surfaceLessonId: LITERATURE_ARGUMENT,
      message: "Phân tích ảnh này.",
    },
    images: [image("literature-personification.png")],
  },
  {
    id: "29",
    category: "visual-generic/five-images-library",
    body: {
      scopeType: "LIBRARY",
      message:
        "Phân loại lần lượt 5 ảnh theo môn học đã mua; giải ngắn nội dung đọc chắc chắn được và từ chối suy đoán ảnh nhiễu. Không bỏ sót ảnh.",
    },
    images: [
      image("physics-circuit.png"),
      image("chemistry-equation.png"),
      image("literature-personification.png"),
      image("math-cyclic-square.png"),
      image("unrelated-noise.png"),
    ],
  },
];

const threads = new Map();
const results = [];

for (const testCase of cases) {
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
    signal: AbortSignal.timeout(90_000),
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
      completed?.message?.text ?? refused?.message ?? failed?.message ?? streamed.raw.slice(0, 2_000),
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
    `${testCase.id}/30\t${response.status}\t${result.policy ?? "-"}\t${result.messageStatus ?? "-"}\tTTFC=${result.timeToFirstContentMs ?? "-"}ms\ttotal=${result.durationMs}ms\t${testCase.category}\n`,
  );
}

await checkpoint();

async function checkpoint() {
  await writeFile(
    outputPath,
    `${JSON.stringify({ selectedCount: cases.length, results }, null, 2)}\n`,
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
  if (!response.body) return { raw: await response.text(), events: [], timeToFirstContentMs: null };
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
