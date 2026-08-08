const { Client } = require('pg');

async function run() {
  const client = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/learning_path_dev?schema=public' });
  await client.connect();
  
  const lessonId = '0ba395e6-d64a-439f-a668-d9cbb3fc9544';
  const contentJson = JSON.stringify({
    type: "lesson_summary_blocks",
    data: [
      {
        type: "key_knowledge",
        title: "Kiến thức cần nhớ",
        points: [
          "Số hữu tỉ là số viết được dưới dạng phân số a/b với a, b là các số nguyên, b khác 0.",
          "Tập hợp các số hữu tỉ được kí hiệu là Q.",
          "Mỗi số hữu tỉ đều được biểu diễn bởi một điểm trên trục số."
        ],
        sourceChunkIds: ["chunk-001"]
      },
      {
        type: "rule",
        title: "Quy tắc so sánh số hữu tỉ",
        statement: "Muốn so sánh hai số hữu tỉ, ta làm như sau:",
        steps: [
          "Viết chúng dưới dạng phân số có cùng mẫu dương.",
          "So sánh các tử số. Phân số nào có tử số lớn hơn thì lớn hơn."
        ],
        conditions: [
          "Mẫu số phải là số dương."
        ],
        sourceChunkIds: ["chunk-002"]
      }
    ]
  });

  const res = await client.query(`
    INSERT INTO lesson_summaries (id, lesson_id, content_json, source, review_status, created_at, updated_at)
    VALUES (gen_random_uuid(), $1, $2, 'AI', 'APPROVED', NOW(), NOW())
    ON CONFLICT (lesson_id) DO UPDATE SET content_json = $2, review_status = 'APPROVED', updated_at = NOW();
  `, [lessonId, contentJson]);
  
  console.log("Upserted summary:", res.rowCount);
  await client.end();
}
run().catch(console.error);
