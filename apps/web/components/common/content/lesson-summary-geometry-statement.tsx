import type { LessonSummaryGeometryStatement } from "@learning-path/shared";

import { MathpixMarkdownRenderer } from "@/components/shared/mathpix-markdown-renderer";

interface LessonSummaryGeometryStatementProps {
  statement: LessonSummaryGeometryStatement;
}

export function LessonSummaryGeometryStatementTable({
  statement,
}: LessonSummaryGeometryStatementProps) {
  return (
    <div className="my-4 overflow-x-auto">
      <table
        aria-label="Bảng giả thiết và kết luận"
        className="w-full min-w-[280px] border-collapse text-[14px] sm:text-[15px]"
      >
        <tbody>
          <tr className="border-b-2 border-slate-400/80 dark:border-slate-500/90">
            <th
              scope="row"
              className="w-12 border-r-2 border-slate-400/80 px-2 py-3 text-center align-middle font-black tracking-wide text-slate-800 dark:border-slate-500/90 dark:text-slate-100 sm:w-16 sm:px-3"
            >
              GT
            </th>
            <td className="px-3 py-3 align-middle text-slate-800 dark:text-slate-100 sm:px-5">
              <div className="space-y-1.5">
                {statement.hypotheses.map((hypothesis, index) => (
                  <MathpixMarkdownRenderer
                    key={`${hypothesis}-${index}`}
                    className="[&>*]:my-0"
                    content={hypothesis}
                  />
                ))}
              </div>
            </td>
          </tr>
          <tr>
            <th
              scope="row"
              className="w-12 border-r-2 border-slate-400/80 px-2 py-3 text-center align-middle font-black tracking-wide text-slate-800 dark:border-slate-500/90 dark:text-slate-100 sm:w-16 sm:px-3"
            >
              KL
            </th>
            <td className="px-3 py-3 align-middle text-slate-800 dark:text-slate-100 sm:px-5">
              <div className="space-y-1.5">
                {statement.conclusions.map((conclusion, index) => (
                  <MathpixMarkdownRenderer
                    key={`${conclusion}-${index}`}
                    className="[&>*]:my-0"
                    content={conclusion}
                  />
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
