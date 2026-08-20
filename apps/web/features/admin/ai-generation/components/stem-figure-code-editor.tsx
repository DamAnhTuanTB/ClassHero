"use client";

import {
  autocompletion,
  type Completion,
  type CompletionContext,
  type CompletionResult,
  snippetCompletion,
} from "@codemirror/autocomplete";
import { StreamLanguage } from "@codemirror/language";
import { stex } from "@codemirror/legacy-modes/mode/stex";
import {
  lintGutter,
  setDiagnostics,
  type Diagnostic,
} from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { basicSetup, EditorView } from "codemirror";
import { useEffect, useRef } from "react";

import type { AdminStemFigureDiagnosticBatch } from "@/features/admin/ai-generation/types/admin-ai-generation.types";

type StemFigureCompileIssue = AdminStemFigureDiagnosticBatch["issues"][number];

export function StemFigureCodeEditor({
  focusLine,
  issues,
  onChange,
  value,
}: {
  focusLine: number | null;
  issues: StemFigureCompileIssue[];
  onChange: (value: string) => void;
  value: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const syncingValueRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!containerRef.current) return;

    const editor = new EditorView({
      doc: value,
      extensions: [
        basicSetup,
        lintGutter(),
        StreamLanguage.define(stex),
        oneDark,
        autocompletion({
          activateOnTyping: true,
          maxRenderedOptions: 10,
          override: [completeStemFigureCode],
        }),
        EditorView.contentAttributes.of({
          "aria-label": "Mã vẽ hình",
          "aria-multiline": "true",
          autocapitalize: "off",
          autocomplete: "off",
          autocorrect: "off",
          spellcheck: "false",
        }),
        EditorView.theme({
          "&": {
            height: "100%",
            backgroundColor: "#020617",
            fontSize: "12px",
          },
          ".cm-scroller": {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            lineHeight: "1.25rem",
            overflow: "auto",
          },
          ".cm-content": {
            minHeight: "100%",
            padding: "0.75rem 0",
          },
          ".cm-line": {
            padding: "0 0.75rem",
          },
          ".cm-gutters": {
            backgroundColor: "#020617",
            borderRight: "1px solid #334155",
            color: "#64748b",
          },
          ".cm-activeLine": {
            backgroundColor: "rgba(30, 41, 59, 0.5)",
          },
          ".cm-activeLineGutter": {
            backgroundColor: "rgba(30, 41, 59, 0.72)",
            color: "#cbd5e1",
          },
          ".cm-cursor, .cm-dropCursor": {
            borderLeftColor: "#f8fafc",
          },
          "&.cm-focused": {
            outline: "1px solid #0ea5e9",
            outlineOffset: "-1px",
          },
          ".cm-tooltip-autocomplete": {
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "0.5rem",
            color: "#e2e8f0",
            overflow: "hidden",
          },
          ".cm-tooltip-autocomplete > ul > li": {
            minHeight: "1.9rem",
            padding: "0.25rem 0.5rem",
          },
          ".cm-tooltip-autocomplete > ul > li[aria-selected]": {
            backgroundColor: "#0369a1",
            color: "#ffffff",
          },
          ".cm-completionDetail": {
            color: "#94a3b8",
            fontStyle: "normal",
            marginLeft: "0.75rem",
          },
        }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged && !syncingValueRef.current) {
            onChangeRef.current(update.state.doc.toString());
          }
        }),
      ],
      parent: containerRef.current,
    });

    editorRef.current = editor;
    return () => {
      editor.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || editor.state.doc.toString() === value) return;

    syncingValueRef.current = true;
    editor.dispatch({
      changes: {
        from: 0,
        insert: value,
        to: editor.state.doc.length,
      },
    });
    syncingValueRef.current = false;
  }, [value]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.dispatch(
      setDiagnostics(
        editor.state,
        issues.map((issue) => createEditorDiagnostic(editor, issue)),
      ),
    );
  }, [issues]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || focusLine === null) return;
    const lineNumber = Math.min(Math.max(focusLine, 1), editor.state.doc.lines);
    const line = editor.state.doc.line(lineNumber);
    editor.dispatch({
      effects: EditorView.scrollIntoView(line.from, { y: "center" }),
      selection: { anchor: line.from },
    });
    editor.focus();
  }, [focusLine]);

  return <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />;
}

function createEditorDiagnostic(
  editor: EditorView,
  issue: StemFigureCompileIssue,
): Diagnostic {
  const lineNumber = Math.min(
    Math.max(issue.line ?? 1, 1),
    editor.state.doc.lines,
  );
  const line = editor.state.doc.line(lineNumber);
  const from =
    typeof issue.column === "number"
      ? Math.min(line.from + Math.max(issue.column - 1, 0), line.to)
      : line.from;
  const to =
    typeof issue.column === "number"
      ? Math.min(from + 1, line.to)
      : Math.max(line.from, line.to);

  return {
    from,
    message: issue.message,
    severity: issue.severity === "WARNING" ? "warning" : "error",
    source: issue.code,
    to,
  };
}

const TEX_COMMAND_COMPLETIONS: readonly Completion[] = [
  snippetCompletion(
    "\\begin\\{tikzpicture\\}[${options}]\n\t${}\n\\end\\{tikzpicture\\}${0}",
    { label: "\\begin{tikzpicture}", type: "keyword", detail: "Khung vẽ hình" },
  ),
  snippetCompletion(
    "\\begin\\{scope\\}[${options}]\n\t${}\n\\end\\{scope\\}${0}",
    { label: "\\begin{scope}", type: "keyword", detail: "Nhóm đối tượng" },
  ),
  snippetCompletion(
    "\\begin\\{axis\\}[${options}]\n\t${}\n\\end\\{axis\\}${0}",
    { label: "\\begin{axis}", type: "keyword", detail: "Khung đồ thị" },
  ),
  snippetCompletion(
    "\\draw[${style}] (${x1},${y1}) -- (${x2},${y2});${0}",
    { label: "\\draw", type: "function", detail: "Vẽ đoạn thẳng" },
  ),
  snippetCompletion(
    "\\draw[${style}, ->] (${x1},${y1}) -- (${x2},${y2});${0}",
    { label: "\\draw", type: "function", detail: "Vẽ mũi tên" },
  ),
  snippetCompletion(
    "\\node[${position}] at (${x},${y}) \\{${text}\\};${0}",
    { label: "\\node", type: "function", detail: "Thêm chữ hoặc điểm" },
  ),
  snippetCompletion("\\coordinate (${name}) at (${x},${y});${0}", {
    label: "\\coordinate",
    type: "function",
    detail: "Tạo tọa độ",
  }),
  snippetCompletion("\\path[${style}] (${x},${y}) ${path};${0}", {
    label: "\\path",
    type: "function",
    detail: "Tạo đường dẫn",
  }),
  snippetCompletion("\\fill[${color}] (${x},${y}) circle (${radius});${0}", {
    label: "\\fill",
    type: "function",
    detail: "Tô một điểm tròn",
  }),
  snippetCompletion("\\filldraw[${style}] ${path};${0}", {
    label: "\\filldraw",
    type: "function",
    detail: "Vẽ và tô màu",
  }),
  snippetCompletion("\\clip ${path};${0}", {
    label: "\\clip",
    type: "function",
    detail: "Giới hạn vùng vẽ",
  }),
  snippetCompletion(
    "\\foreach \\${item} in \\{${values}\\} \\{\n\t${}\n\\}${0}",
    { label: "\\foreach", type: "keyword", detail: "Lặp nhiều đối tượng" },
  ),
  snippetCompletion("\\addplot[${style}] coordinates \\{${points}\\};${0}", {
    label: "\\addplot",
    type: "function",
    detail: "Vẽ đồ thị từ các điểm",
  }),
  snippetCompletion("\\vec\\{${name}\\}${0}", {
    label: "\\vec",
    type: "function",
    detail: "Ký hiệu vectơ",
  }),
  { label: "\\Delta", type: "constant", detail: "Ký hiệu Delta" },
  { label: "\\usetikzlibrary", type: "keyword", detail: "Chọn công cụ vẽ" },
  { label: "\\tikzset", type: "function", detail: "Đặt kiểu hiển thị" },
];

const TIKZ_OPTION_COMPLETIONS: readonly Completion[] = [
  { label: "above", type: "property", detail: "Đặt phía trên" },
  { label: "below", type: "property", detail: "Đặt phía dưới" },
  { label: "left", type: "property", detail: "Đặt bên trái" },
  { label: "right", type: "property", detail: "Đặt bên phải" },
  { label: "draw", type: "property", detail: "Màu đường viền" },
  { label: "fill", type: "property", detail: "Màu nền" },
  { label: "line width", type: "property", detail: "Độ dày đường" },
  { label: "dashed", type: "property", detail: "Nét đứt" },
  { label: "dotted", type: "property", detail: "Nét chấm" },
  { label: "opacity", type: "property", detail: "Độ trong suốt" },
  { label: "scale", type: "property", detail: "Tỷ lệ" },
  { label: "rotate", type: "property", detail: "Xoay" },
  { label: "red", type: "constant", detail: "Màu đỏ" },
  { label: "blue", type: "constant", detail: "Màu xanh dương" },
  { label: "green", type: "constant", detail: "Màu xanh lá" },
  { label: "cyan", type: "constant", detail: "Màu xanh ngọc" },
  { label: "orange", type: "constant", detail: "Màu cam" },
  { label: "black", type: "constant", detail: "Màu đen" },
  { label: "white", type: "constant", detail: "Màu trắng" },
];

function completeStemFigureCode(
  context: CompletionContext,
): CompletionResult | null {
  const command = context.matchBefore(/\\[A-Za-z@]*$/u);
  if (command) {
    return {
      from: command.from,
      options: TEX_COMMAND_COMPLETIONS,
      validFor: /^\\[A-Za-z@]*$/u,
    };
  }

  const line = context.state.doc.lineAt(context.pos);
  const lineBeforeCursor = context.state.sliceDoc(line.from, context.pos);
  const insideOptions =
    lineBeforeCursor.lastIndexOf("[") > lineBeforeCursor.lastIndexOf("]");
  const option = context.matchBefore(/[A-Za-z-]*$/u);
  if (insideOptions && option) {
    return {
      from: option.from,
      options: TIKZ_OPTION_COMPLETIONS,
      validFor: /^[A-Za-z-]*$/u,
    };
  }

  if (!context.explicit) return null;
  return {
    from: context.pos,
    options: [...TEX_COMMAND_COMPLETIONS, ...TIKZ_OPTION_COMPLETIONS],
  };
}
