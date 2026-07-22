const fs = require("fs");
const path =
  "apps/web/features/admin/courses/screens/admin-course-detail-manager/components/lesson-page-range-row.tsx";
let content = fs.readFileSync(path, "utf8");

// 1. Variable declarations
content = content.replace(
  /const primaryDocument = getPrimaryLessonDocument\(documents\);\s+const supplements = getSupplementLessonDocuments\(documents\);\s+const newSupplements = draft.newSupplements \?\? \[\];/,
  `const primaryDocument = getPrimaryLessonDocument(documents);
  const allSupplements = getSupplementLessonDocuments(documents);
  const supplements = allSupplements.filter(d => d.kind === "SUPPLEMENT" || d.kind === "PRIMARY_REPLACEMENT");
  const homeworks = allSupplements.filter(d => d.kind === "HOMEWORK");
  
  const allNewSupplements = draft.newSupplements ?? [];
  const newSupplements = allNewSupplements.filter(d => d.type === "SUPPLEMENT" || !d.type);
  const newHomeworks = allNewSupplements.filter(d => d.type === "HOMEWORK");`,
);

// 2. Title Khoảng trang -> Tài liệu nền tảng + hint
content = content.replace(
  /<h3 className="text-sm font-extrabold text-\[var\(--theme-text-strong\)\]">\s*Khoảng trang\s*<\/h3>/,
  `<h3 className="text-sm font-extrabold text-[var(--theme-text-strong)]">
              Tài liệu nền tảng
            </h3>`,
);

content = content.replace(
  /<div className="grid gap-3 xl:grid-cols-\[1fr_1fr\]">/,
  `<p className="mb-4 text-sm font-medium text-[var(--theme-text-muted)]">
          Gợi ý: Nhập khoảng trang để hệ thống tự động trích xuất nội dung bài học từ Tài liệu nguồn.
        </p>

        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">`,
);

// 3. Remove isPrimary for page range
content = content.replace(
  /<div className="mt-4 flex items-center gap-2">[\s\S]*?<label\s+htmlFor={`admin-lesson-source-primary-\${item\.lesson\.id}`}[\s\S]*?Đánh dấu là tài liệu chính\s*<\/label>\s*<\/div>/,
  "",
);

// 4. Update Thêm tài liệu bổ sung
content = content.replace(
  /onUpdateRange\(item\.lesson\.id, "newSupplements", \[\s*\.\.\.newSupplements,\s*\{ id: crypto\.randomUUID\(\), file: null, title: "", isPrimary: false \},\s*\]\);/,
  `onUpdateRange(item.lesson.id, "newSupplements", [
                ...allNewSupplements,
                { id: crypto.randomUUID(), file: null, title: "", type: "SUPPLEMENT" },
              ]);`,
);

// 5. Remove isPrimary from existing supplements
content = content.replace(
  /<div className="col-span-full mt-1 flex items-center gap-2">\s*<input\s+type="checkbox"\s+id={`admin-lesson-supplement-primary-\${document\.id}`}[\s\S]*?Đánh dấu là tài liệu chính\s*<\/label>\s*<\/div>/g,
  "",
);

// 6. Fix onChange title for newSupplements
content = content.replace(
  /const updated = \[\.\.\.newSupplements\];\s*updated\[index\] = \{ \.\.\.updated\[index\]!, title: e\.target\.value \};/g,
  `const updated = allNewSupplements.map(doc => 
                        doc.id === newDoc.id ? { ...doc, title: e.target.value } : doc
                      );`,
);

// 7. Fix onChange file for newSupplements
content = content.replace(
  /const updated = \[\.\.\.newSupplements\];\s*updated\[index\] = \{ \.\.\.updated\[index\]!, file \};/g,
  `const updated = allNewSupplements.map(doc => 
                          doc.id === newDoc.id ? { ...doc, file } : doc
                        );`,
);

// 8. Fix delete for newSupplements
content = content.replace(
  /const updated = newSupplements\.filter\(\(_, i\) => i !== index\);\s*onUpdateRange\(item\.lesson\.id, "newSupplements", updated\);\s*if \(newDoc\.isPrimary\) \{[\s\S]*?\}/g,
  `const updated = allNewSupplements.filter(doc => doc.id !== newDoc.id);
                      onUpdateRange(item.lesson.id, "newSupplements", updated);`,
);

// 9. Remove isPrimary for new supplements
content = content.replace(
  /<div className="col-span-full mt-1 flex items-center gap-2">\s*<input\s+type="checkbox"\s+id={`admin-lesson-new-supplement-primary-\${newDoc\.id}`}[\s\S]*?Đánh dấu là tài liệu chính\s*<\/label>\s*<\/div>/g,
  "",
);

// 10. Append Homework section
const homeworkHtml = fs.readFileSync("scratch-homework.tsx", "utf8");
content = content.replace(
  /<\/section>\s*\{rangeSubmitAttempted && issue \? \(/,
  `</section>\n\n${homeworkHtml}\n\n      {rangeSubmitAttempted && issue ? (`,
);

fs.writeFileSync(path, content);
console.log("Patched successfully");
