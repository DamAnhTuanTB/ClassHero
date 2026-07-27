"use client";

import { Image } from "@tiptap/extension-image";
import { Mathematics } from "@tiptap/extension-mathematics";
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table";
import { TextAlign } from "@tiptap/extension-text-align";
import { Color, TextStyle } from "@tiptap/extension-text-style";
import {
  EditorContent,
  Extension,
  ReactNodeViewRenderer,
  useEditor,
  type Editor,
} from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import katex from "katex";
import "katex/contrib/mhchem";
import "katex/dist/katex.min.css";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  Bold,
  Check,
  Columns3,
  Heading2,
  ImagePlus,
  Italic,
  List,
  ListOrdered,
  Loader2,
  PanelLeft,
  PanelTop,
  Pilcrow,
  Redo2,
  Rows3,
  Sigma,
  Strikethrough,
  Table2,
  TableCellsMerge,
  TableCellsSplit,
  Trash2,
  Underline,
  Undo2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { EditorDialogShell } from "@/components/admin/courses/editor-dialog-shell";
import type { TiptapTextDocument } from "@/types/rich-text";
import { uploadAdminQuizImage } from "@/features/admin/quiz/api/admin-quiz-api";
import { QuizRichImageNodeView } from "@/features/admin/quiz/components/quiz-rich-image-node-view";
import { QuizTextColorPicker } from "@/features/admin/quiz/components/quiz-text-color-picker";
import {
  areTiptapDocumentsEquivalent,
  hasTiptapDocumentContent,
} from "@/lib/tiptap-rich-content";
import { useAuthSessionStore } from "@/features/auth/session/auth-session";
import { cn } from "@/lib/utils";
import "@/features/admin/quiz/components/quiz-rich-content-editor.css";

type FormulaKind = "inline" | "block";
type ImageAlignment = "center" | "left" | "right";

type FormulaDraft = {
  kind: FormulaKind;
  latex: string;
  position?: number;
};

type TableDraft = {
  columns: number;
  rows: number;
  withHeaderRow: boolean;
};

const maxIndentLevel = 8;
const initialImageBaseWidthPercent = 60;

const QuizIndent = Extension.create({
  name: "quizIndent",
  priority: 1_000,

  addGlobalAttributes() {
    return [
      {
        types: ["paragraph", "heading"],
        attributes: {
          indent: {
            default: null,
            parseHTML: (element) => readIndentLevel(element.getAttribute("data-indent")),
            renderHTML: (attributes) => {
              const indent = readIndentLevel(attributes.indent);
              return indent > 0 ? { "data-indent": String(indent) } : {};
            },
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (this.editor.isActive("listItem")) {
          this.editor.commands.sinkListItem("listItem");
          return true;
        }
        return updateCurrentBlockIndent(this.editor, 1);
      },
      "Shift-Tab": () => {
        if (this.editor.isActive("listItem")) {
          this.editor.commands.liftListItem("listItem");
          return true;
        }
        return updateCurrentBlockIndent(this.editor, -1);
      },
    };
  },
});

const QuizTableCell = TableCell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cellHeight: createCellHeightAttribute(),
    };
  },
});

const QuizTableHeader = TableHeader.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      cellHeight: createCellHeightAttribute(),
    };
  },
});

const QuizImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-file-id"),
        renderHTML: (attributes) =>
          typeof attributes.fileId === "string" && attributes.fileId
            ? { "data-file-id": attributes.fileId }
            : {},
      },
      baseWidthPercent: createNumericImageAttribute("data-base-width-percent"),
      widthPercent: createNumericImageAttribute("data-width-percent"),
      sourceWidth: createNumericImageAttribute("data-source-width"),
      sourceHeight: createNumericImageAttribute("data-source-height"),
      cropTop: createNumericImageAttribute("data-crop-top"),
      cropRight: createNumericImageAttribute("data-crop-right"),
      cropBottom: createNumericImageAttribute("data-crop-bottom"),
      cropLeft: createNumericImageAttribute("data-crop-left"),
      alignment: {
        default: "center",
        parseHTML: (element) =>
          readImageAlignment(element.getAttribute("data-alignment")),
        renderHTML: (attributes) => ({
          "data-alignment": readImageAlignment(attributes.alignment),
        }),
      },
    };
  },

  addNodeView() {
    return ReactNodeViewRenderer(QuizRichImageNodeView);
  },
});

const formulaTemplates = [
  { label: "Phân số", latex: "\\frac{a}{b}" },
  { label: "Căn", latex: "\\sqrt{x}" },
  { label: "Lũy thừa", latex: "x^{n}" },
  { label: "Tích phân", latex: "\\int_{a}^{b} f(x)\\,dx" },
  { label: "Tổng", latex: "\\sum_{i=1}^{n} a_i" },
  { label: "Vector", latex: "\\vec{F}=m\\vec{a}" },
  { label: "Đơn vị", latex: "v=10\\,\\mathrm{m/s}" },
  { label: "Hóa học", latex: "\\ce{H2SO4 + 2NaOH -> Na2SO4 + 2H2O}" },
];

export function QuizRichContentEditor({
  ariaLabel,
  compact = false,
  disabled = false,
  error,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string;
  compact?: boolean;
  disabled?: boolean;
  error?: string;
  onBlur?: () => void;
  onChange: (value: TiptapTextDocument) => void;
  placeholder: string;
  value: TiptapTextDocument;
}) {
  const token = useAuthSessionStore((state) => state.session?.accessToken ?? "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const latestValueRef = useRef(value);
  const lastEmittedValueRef = useRef(JSON.stringify(value));
  const [formulaDraft, setFormulaDraft] = useState<FormulaDraft | null>(null);
  const [tableDraft, setTableDraft] = useState<TableDraft | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [, setEditorRevision] = useState(0);

  latestValueRef.current = value;

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      TextStyle,
      Color,
      TextAlign.configure({
        types: ["heading", "paragraph"],
        alignments: ["left", "center", "right", "justify"],
      }),
      QuizIndent,
      Table.configure({
        allowTableNodeSelection: true,
        cellMinWidth: 72,
        lastColumnResizable: true,
        renderWrapper: true,
        resizable: true,
      }),
      QuizTableCell,
      QuizTableHeader,
      TableRow,
      QuizImage.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "quiz-rich-content-image",
        },
      }),
      Mathematics.configure({
        inlineOptions: {
          onClick: (node, position) =>
            setFormulaDraft({
              kind: "inline",
              latex: typeof node.attrs.latex === "string" ? node.attrs.latex : "",
              position,
            }),
        },
        blockOptions: {
          onClick: (node, position) =>
            setFormulaDraft({
              kind: "block",
              latex: typeof node.attrs.latex === "string" ? node.attrs.latex : "",
              position,
            }),
        },
        katexOptions: {
          throwOnError: false,
          strict: false,
          macros: {
            "\\R": "\\mathbb{R}",
            "\\N": "\\mathbb{N}",
            "\\Z": "\\mathbb{Z}",
          },
        },
      }),
    ],
    [],
  );

  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions,
    content: value,
    editorProps: {
      attributes: {
        "aria-label": ariaLabel,
        class: "quiz-rich-content-prosemirror",
        role: "textbox",
      },
    },
    onBlur: () => onBlur?.(),
    onSelectionUpdate: () => setEditorRevision((revision) => revision + 1),
    // Commands such as bold/italic/underline at a collapsed cursor only update
    // Tiptap's stored marks. They do not change the document or selection, so
    // neither onUpdate nor onSelectionUpdate can refresh the active toolbar state.
    onTransaction: () => setEditorRevision((revision) => revision + 1),
    onUpdate: ({ editor: currentEditor }) => {
      const nextValue = currentEditor.getJSON() as TiptapTextDocument;
      const serializedNextValue = JSON.stringify(nextValue);

      // Tiptap extensions may dispatch a normalizing transaction while the editor
      // is mounting. Do not report that unchanged document as a user edit because
      // React Hook Form would validate a pristine modal immediately.
      if (areTiptapDocumentsEquivalent(nextValue, latestValueRef.current)) {
        return;
      }

      latestValueRef.current = nextValue;
      lastEmittedValueRef.current = serializedNextValue;
      onChange(nextValue);
      setEditorRevision((revision) => revision + 1);
    },
  });

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    const serializedValue = JSON.stringify(value);
    if (
      serializedValue === lastEmittedValueRef.current ||
      serializedValue === JSON.stringify(editor.getJSON())
    ) {
      return;
    }

    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value]);

  useTableRowResize(editor, disabled);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !editor) {
      return;
    }
    if (!token) {
      toast.error("Phiên đăng nhập đã hết hạn");
      return;
    }

    setIsUploadingImage(true);
    try {
      const [uploadedImage, imageDimensions] = await Promise.all([
        uploadAdminQuizImage(file, token),
        readLocalImageDimensions(file),
      ]);
      editor
        .chain()
        .focus()
        .insertContent({
          type: "image",
          attrs: {
            alignment: "center",
            alt: uploadedImage.fileName,
            fileId: uploadedImage.fileId,
            src: uploadedImage.imageUrl,
            sourceHeight: imageDimensions.height,
            sourceWidth: imageDimensions.width,
            title: uploadedImage.fileName,
            baseWidthPercent: initialImageBaseWidthPercent,
            widthPercent: 100,
          },
        })
        .run();
      toast.success("Đã chèn ảnh vào nội dung");
    } catch (uploadError) {
      toast.error(
        uploadError instanceof Error ? uploadError.message : "Chưa tải được ảnh lên",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const isEmpty = editor
    ? !hasTiptapDocumentContent(editor.getJSON() as TiptapTextDocument)
    : true;

  return (
    <div>
      <div
        className={cn(
          "quiz-rich-content-editor overflow-hidden rounded-xl border bg-[var(--theme-input-bg)] transition",
          compact && "quiz-rich-content-editor--compact",
          error
            ? "border-[var(--theme-error-border)]"
            : "border-[var(--theme-input-border)] hover:border-[var(--theme-input-hover-border)]",
          disabled && "cursor-not-allowed opacity-65",
        )}
        aria-invalid={error ? "true" : "false"}
      >
        <EditorToolbar
          disabled={disabled}
          editor={editor}
          isUploadingImage={isUploadingImage}
          onAddFormula={() => {
            if (!editor) {
              return;
            }
            setTableDraft(null);
            const { from, to } = editor.state.selection;
            setFormulaDraft({
              kind: "inline",
              latex: from === to ? "" : editor.state.doc.textBetween(from, to, " "),
            });
          }}
          onAddImage={() => fileInputRef.current?.click()}
          onAddTable={() => {
            setFormulaDraft(null);
            setTableDraft({
              columns: 3,
              rows: 3,
              withHeaderRow: true,
            });
          }}
        />
        {editor?.isActive("table") ? (
          <TableContextToolbar disabled={disabled} editor={editor} />
        ) : null}
        <div className="relative">
          {isEmpty ? (
            <span className="pointer-events-none absolute left-4 top-3 z-[1] text-sm font-medium text-[var(--theme-text-placeholder)]">
              {placeholder}
            </span>
          ) : null}
          <EditorContent editor={editor} />
        </div>
        {formulaDraft ? (
          <FormulaComposer
            draft={formulaDraft}
            editor={editor}
            onChange={setFormulaDraft}
            onClose={() => setFormulaDraft(null)}
          />
        ) : null}
      </div>
      {tableDraft ? (
        <TableComposerDialog
          draft={tableDraft}
          editor={editor}
          onChange={setTableDraft}
          onClose={() => setTableDraft(null)}
        />
      ) : null}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Chọn ảnh cho ${ariaLabel.toLocaleLowerCase("vi")}`}
        onChange={handleImageChange}
      />
      {error ? (
        <p className="mt-1.5 text-sm text-[var(--theme-error-text)]">{error}</p>
      ) : null}
    </div>
  );
}

export function ScientificAnswerField({
  error,
  id,
  onBlur,
  onChange,
  placeholder,
  value,
}: {
  error?: string;
  id: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isFormulaToolsOpen, setIsFormulaToolsOpen] = useState(false);
  const previewHtml = useMemo(
    () =>
      value.trim()
        ? katex.renderToString(value, {
            throwOnError: false,
            strict: false,
          })
        : "",
    [value],
  );

  const insertAtCursor = (latex: string) => {
    const input = inputRef.current;
    const selectionStart = input?.selectionStart ?? value.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const nextValue = value.slice(0, selectionStart) + latex + value.slice(selectionEnd);
    onChange(nextValue);
    requestAnimationFrame(() => {
      input?.focus();
      const nextCursor = selectionStart + latex.length;
      input?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2">
        <input
          ref={inputRef}
          id={id}
          value={value}
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          aria-invalid={error ? "true" : "false"}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "min-h-10 w-full rounded-xl border bg-[var(--theme-input-bg)] px-4 text-sm font-semibold text-[var(--theme-text-strong)] outline-none transition placeholder:text-[var(--theme-text-placeholder)]",
            error
              ? "border-[var(--theme-error-border)]"
              : "border-[var(--theme-input-border)] hover:border-[var(--theme-input-hover-border)] focus:border-[var(--theme-primary)]",
          )}
        />
        <button
          type="button"
          aria-label="Mở công cụ nhập công thức"
          aria-expanded={isFormulaToolsOpen}
          onClick={() => setIsFormulaToolsOpen((isOpen) => !isOpen)}
          className={cn(
            "grid h-10 w-10 place-items-center rounded-lg border text-sm font-extrabold transition",
            isFormulaToolsOpen
              ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
              : "border-[var(--theme-border)] text-[var(--theme-text-muted)]",
          )}
        >
          <Sigma className="h-4 w-4" />
        </button>
      </div>
      {isFormulaToolsOpen ? (
        <div className="mt-2 space-y-2 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
          <p className="text-xs font-semibold text-[var(--theme-text-muted)]">
            Chèn LaTeX hoặc phương trình Hóa học vào đáp án dùng để chấm.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {formulaTemplates.map((template) => (
              <button
                key={template.label}
                type="button"
                onClick={() => insertAtCursor(template.latex)}
                className="theme-button-primary-subtle min-h-8 rounded-lg px-2.5 text-xs font-bold"
              >
                {template.label}
              </button>
            ))}
          </div>
          <div className="min-h-12 overflow-x-auto rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2 text-center text-[var(--theme-text-strong)]">
            {previewHtml ? (
              <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
            ) : (
              <span className="text-xs text-[var(--theme-text-muted)]">
                Xem trước đáp án công thức
              </span>
            )}
          </div>
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-[var(--theme-error-text)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function EditorToolbar({
  disabled,
  editor,
  isUploadingImage,
  onAddFormula,
  onAddImage,
  onAddTable,
}: {
  disabled: boolean;
  editor: Editor | null;
  isUploadingImage: boolean;
  onAddFormula: () => void;
  onAddImage: () => void;
  onAddTable: () => void;
}) {
  const stopSelectionLoss = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-2"
      role="toolbar"
      aria-label="Định dạng nội dung"
    >
      <ToolbarButton
        active={editor?.isActive("paragraph")}
        disabled={disabled || !editor}
        label="Đoạn văn"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().setParagraph().run()}
      >
        <Pilcrow />
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("heading", { level: 2 })}
        disabled={disabled || !editor}
        label="Tiêu đề"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        active={editor?.isActive("bold")}
        disabled={disabled || !editor}
        label="In đậm"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleBold().run()}
      >
        <Bold />
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("italic")}
        disabled={disabled || !editor}
        label="In nghiêng"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleItalic().run()}
      >
        <Italic />
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("underline")}
        disabled={disabled || !editor}
        label="Gạch chân"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleUnderline().run()}
      >
        <Underline />
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("strike")}
        disabled={disabled || !editor}
        label="Gạch ngang"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleStrike().run()}
      >
        <Strikethrough />
      </ToolbarButton>
      <QuizTextColorPicker disabled={disabled} editor={editor} />
      <ToolbarDivider />
      <ToolbarButton
        active={editor?.isActive("bulletList")}
        disabled={disabled || !editor}
        label="Danh sách bullet"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleBulletList().run()}
      >
        <List />
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("orderedList")}
        disabled={disabled || !editor}
        label="Danh sách đánh số"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered />
      </ToolbarButton>
      <ToolbarDivider />
      {[
        { align: "left", label: "Căn trái", icon: AlignLeft },
        { align: "center", label: "Căn giữa", icon: AlignCenter },
        { align: "right", label: "Căn phải", icon: AlignRight },
        { align: "justify", label: "Căn đều", icon: AlignJustify },
      ].map(({ align, icon: Icon, label }) => (
        <ToolbarButton
          key={align}
          active={isTextAlignmentActive(editor, align)}
          disabled={
            disabled ||
            !editor ||
            (align === "justify" && Boolean(getSelectedImage(editor)))
          }
          label={label}
          onMouseDown={stopSelectionLoss}
          onClick={() => applyEditorAlignment(editor, align)}
        >
          <Icon />
        </ToolbarButton>
      ))}
      <ToolbarDivider />
      <ToolbarButton
        disabled={disabled || !editor}
        label="Chèn công thức Toán, Lý, Hóa"
        onMouseDown={stopSelectionLoss}
        onClick={onAddFormula}
      >
        <Sigma />
      </ToolbarButton>
      <ToolbarButton
        disabled={disabled || !editor || isUploadingImage}
        label="Chèn ảnh"
        onMouseDown={stopSelectionLoss}
        onClick={onAddImage}
      >
        {isUploadingImage ? <Loader2 className="animate-spin" /> : <ImagePlus />}
      </ToolbarButton>
      <ToolbarButton
        active={editor?.isActive("table")}
        disabled={disabled || !editor}
        label="Chèn bảng"
        onMouseDown={stopSelectionLoss}
        onClick={onAddTable}
      >
        <Table2 />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton
        disabled={disabled || !editor?.can().chain().focus().undo().run()}
        label="Hoàn tác"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().undo().run()}
      >
        <Undo2 />
      </ToolbarButton>
      <ToolbarButton
        disabled={disabled || !editor?.can().chain().focus().redo().run()}
        label="Làm lại"
        onMouseDown={stopSelectionLoss}
        onClick={() => editor?.chain().focus().redo().run()}
      >
        <Redo2 />
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  active = false,
  children,
  disabled,
  label,
  onClick,
  onMouseDown,
}: {
  active?: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        onMouseDown={onMouseDown}
        onClick={onClick}
        className={cn(
          "grid h-9 w-9 place-items-center rounded-lg border text-[var(--theme-text-muted)] transition hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)] disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-4 [&_svg]:w-4",
          active
            ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
            : "border-transparent",
        )}
      >
        {children}
      </button>
    </span>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-[var(--theme-border)]" />;
}

function isTextAlignmentActive(editor: Editor | null, alignment: string) {
  if (!editor) {
    return false;
  }

  const selectedImage = getSelectedImage(editor);
  if (selectedImage) {
    return (
      alignment !== "justify" &&
      readImageAlignment(selectedImage.node.attrs.alignment) === alignment
    );
  }

  if (alignment !== "left") {
    return editor.isActive({ textAlign: alignment });
  }

  const isTextBlock = editor.isActive("paragraph") || editor.isActive("heading");
  const hasExplicitNonLeftAlignment = ["center", "right", "justify"].some(
    (explicitAlignment) => editor.isActive({ textAlign: explicitAlignment }),
  );
  return isTextBlock && !hasExplicitNonLeftAlignment;
}

function applyEditorAlignment(editor: Editor | null, alignment: string) {
  if (!editor) {
    return;
  }

  const selectedImage = getSelectedImage(editor);
  if (selectedImage) {
    if (alignment !== "justify") {
      const transaction = editor.state.tr.setNodeMarkup(
        selectedImage.position,
        undefined,
        {
          ...selectedImage.node.attrs,
          alignment: readImageAlignment(alignment),
        },
      );
      editor.view.dispatch(transaction);
      editor.view.focus();
    }
    return;
  }

  editor.chain().focus().setTextAlign(alignment).run();
}

function getSelectedImage(editor: Editor) {
  if (!editor.isActive("image")) {
    return null;
  }

  const position = editor.state.selection.from;
  const node = editor.state.doc.nodeAt(position);
  return node?.type.name === "image" ? { node, position } : null;
}

function readImageAlignment(value: unknown): ImageAlignment {
  return value === "left" || value === "right" ? value : "center";
}

function TableContextToolbar({
  disabled,
  editor,
}: {
  disabled: boolean;
  editor: Editor;
}) {
  const stopSelectionLoss = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };
  const actionGroups = [
    {
      label: "Thao tác cột",
      items: [
        {
          disabled: !editor.can().chain().focus().addColumnBefore().run(),
          icon: <BetweenVerticalStart />,
          label: "Thêm cột bên trái",
          run: () => editor.chain().focus().addColumnBefore().run(),
        },
        {
          disabled: !editor.can().chain().focus().addColumnAfter().run(),
          icon: <BetweenVerticalEnd />,
          label: "Thêm cột bên phải",
          run: () => editor.chain().focus().addColumnAfter().run(),
        },
        {
          disabled: !editor.can().chain().focus().deleteColumn().run(),
          icon: <Columns3 />,
          label: "Xóa cột đang chọn",
          run: () => editor.chain().focus().deleteColumn().run(),
          tone: "danger" as const,
        },
      ],
    },
    {
      label: "Thao tác hàng",
      items: [
        {
          disabled: !editor.can().chain().focus().addRowBefore().run(),
          icon: <BetweenHorizontalStart />,
          label: "Thêm hàng phía trên",
          run: () => editor.chain().focus().addRowBefore().run(),
        },
        {
          disabled: !editor.can().chain().focus().addRowAfter().run(),
          icon: <BetweenHorizontalEnd />,
          label: "Thêm hàng phía dưới",
          run: () => editor.chain().focus().addRowAfter().run(),
        },
        {
          disabled: !editor.can().chain().focus().deleteRow().run(),
          icon: <Rows3 />,
          label: "Xóa hàng đang chọn",
          run: () => editor.chain().focus().deleteRow().run(),
          tone: "danger" as const,
        },
      ],
    },
    {
      label: "Gộp và tách ô",
      items: [
        {
          disabled: !editor.can().chain().focus().mergeCells().run(),
          icon: <TableCellsMerge />,
          label: "Gộp các ô đã chọn",
          run: () => editor.chain().focus().mergeCells().run(),
        },
        {
          disabled: !editor.can().chain().focus().splitCell().run(),
          icon: <TableCellsSplit />,
          label: "Tách ô đang chọn",
          run: () => editor.chain().focus().splitCell().run(),
        },
      ],
    },
    {
      label: "Thiết lập tiêu đề bảng",
      items: [
        {
          disabled: !editor.can().chain().focus().toggleHeaderRow().run(),
          icon: <PanelTop />,
          label: "Bật hoặc tắt hàng tiêu đề",
          run: () => editor.chain().focus().toggleHeaderRow().run(),
        },
        {
          disabled: !editor.can().chain().focus().toggleHeaderColumn().run(),
          icon: <PanelLeft />,
          label: "Bật hoặc tắt cột tiêu đề",
          run: () => editor.chain().focus().toggleHeaderColumn().run(),
        },
      ],
    },
  ];

  return (
    <div
      className="space-y-2 border-b border-[var(--theme-border)] bg-[var(--theme-bg)] p-2"
      role="toolbar"
      aria-label="Công cụ chỉnh sửa bảng"
    >
      <div className="flex flex-wrap items-center gap-2">
        {actionGroups.map((group, groupIndex) => (
          <div
            key={group.label}
            role="group"
            aria-label={group.label}
            className={cn(
              "flex items-center gap-1",
              groupIndex > 0 &&
                "border-l border-[var(--theme-border)] pl-2 max-sm:border-l-0 max-sm:pl-0",
            )}
          >
            {group.items.map((action) => (
              <TableContextIconButton
                key={action.label}
                disabled={disabled || action.disabled}
                label={action.label}
                tone={action.tone}
                onMouseDown={stopSelectionLoss}
                onClick={action.run}
              >
                {action.icon}
              </TableContextIconButton>
            ))}
          </div>
        ))}
        <div className="ml-auto">
          <TableContextIconButton
            label="Xóa toàn bộ bảng"
            disabled={disabled || !editor.can().chain().focus().deleteTable().run()}
            tone="danger"
            onMouseDown={stopSelectionLoss}
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <Trash2 />
          </TableContextIconButton>
        </div>
      </div>
    </div>
  );
}

function TableContextIconButton({
  children,
  disabled,
  label,
  onClick,
  onMouseDown,
  tone = "neutral",
}: {
  children: ReactNode;
  disabled?: boolean;
  label: string;
  onClick: () => void;
  onMouseDown?: (event: MouseEvent<HTMLButtonElement>) => void;
  tone?: "danger" | "neutral" | "primary";
}) {
  return (
    <span className="relative inline-flex shrink-0">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onMouseDown={onMouseDown}
        onClick={onClick}
        className={cn(
          "grid h-9 w-9 shrink-0 cursor-pointer place-items-center rounded-lg border transition disabled:cursor-not-allowed disabled:opacity-35 [&_svg]:h-4 [&_svg]:w-4",
          tone === "danger"
            ? "border-[var(--theme-error-border)] text-[var(--theme-error-text)] hover:bg-[var(--theme-error-bg)]"
            : tone === "primary"
              ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)] hover:bg-[var(--theme-primary)] hover:text-white"
              : "border-[var(--theme-border)] bg-[var(--theme-input-bg)] text-[var(--theme-text-muted)] hover:border-[var(--theme-primary)] hover:text-[var(--theme-primary)]",
        )}
      >
        {children}
        <span className="sr-only">{label}</span>
      </button>
    </span>
  );
}

function readIndentLevel(value: unknown) {
  const numericValue =
    typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  if (!Number.isFinite(numericValue)) {
    return 0;
  }
  return Math.min(Math.max(Math.round(numericValue), 0), maxIndentLevel);
}

function updateCurrentBlockIndent(editor: Editor, direction: 1 | -1) {
  const blockType = editor.isActive("heading")
    ? "heading"
    : editor.isActive("paragraph")
      ? "paragraph"
      : null;
  if (!blockType) {
    return false;
  }

  const currentIndent = readIndentLevel(editor.getAttributes(blockType).indent);
  const nextIndent = readIndentLevel(currentIndent + direction);
  if (nextIndent === currentIndent) {
    return true;
  }

  return editor.commands.updateAttributes(blockType, {
    indent: nextIndent > 0 ? nextIndent : null,
  });
}

function createCellHeightAttribute() {
  return {
    default: null,
    parseHTML: (element: HTMLElement) =>
      readCellHeight(element.getAttribute("data-cell-height"), null),
    renderHTML: (attributes: Record<string, unknown>) => {
      const height = readCellHeight(attributes.cellHeight, null);
      return height
        ? {
            "data-cell-height": String(height),
            style: `height: ${height}px`,
          }
        : {};
    },
  };
}

function readCellHeight(value: unknown, fallback: number | null) {
  const numericValue =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }
  return Math.min(Math.max(Math.round(numericValue), 32), 320);
}

function useTableRowResize(editor: Editor | null, disabled: boolean) {
  useEffect(() => {
    if (!editor || disabled) {
      return;
    }

    const editorElement = editor.view.dom;
    const edgeTolerance = 7;
    let hoveredRow: HTMLTableRowElement | null = null;
    let resizing: {
      pointerId: number;
      rowIndex: number;
      startHeight: number;
      startY: number;
      tableIndex: number;
    } | null = null;

    const clearHoveredRow = () => {
      hoveredRow?.classList.remove("quiz-table-row-resize-target");
      hoveredRow = null;
      if (!resizing) {
        editorElement.classList.remove("quiz-table-row-resize-cursor");
      }
    };

    const findResizeTarget = (event: PointerEvent) => {
      const cell = getClosestTableCell(event.target, editorElement);
      const directRow = cell?.parentElement ?? null;
      const directTarget = findRowEdgeTarget(
        isTableRowElement(directRow) ? directRow : null,
        event.clientY,
        edgeTolerance,
      );
      if (directTarget) {
        return directTarget;
      }

      if (!isDomElement(event.target) || !editorElement.contains(event.target)) {
        return null;
      }

      // With collapsed table borders, browsers can hit-test the horizontal border
      // as the row/table instead of a td/th. Fall back to row geometry so the
      // whole visible border remains draggable, including cell intersections.
      let closestTarget: HTMLTableRowElement | null = null;
      let closestDistance = Number.POSITIVE_INFINITY;

      editorElement.querySelectorAll<HTMLTableRowElement>("table tr").forEach((row) => {
        const bounds = row.getBoundingClientRect();
        if (
          event.clientX < bounds.left - edgeTolerance ||
          event.clientX > bounds.right + edgeTolerance
        ) {
          return;
        }

        const target = findRowEdgeTarget(row, event.clientY, edgeTolerance);
        if (!target) {
          return;
        }

        const distance = Math.min(
          Math.abs(event.clientY - bounds.top),
          Math.abs(event.clientY - bounds.bottom),
        );
        if (distance < closestDistance) {
          closestTarget = target;
          closestDistance = distance;
        }
      });

      return closestTarget;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (resizing) {
        const nextHeight = readCellHeight(
          resizing.startHeight + event.clientY - resizing.startY,
          resizing.startHeight,
        );
        const currentRow = findTableRowByCoordinates(
          editorElement,
          resizing.tableIndex,
          resizing.rowIndex,
        );
        if (nextHeight && currentRow) {
          persistTableRowHeight(editor, currentRow, nextHeight);
        }
        return;
      }

      const nextRow = findResizeTarget(event);
      if (nextRow === hoveredRow) {
        return;
      }

      clearHoveredRow();
      if (nextRow) {
        hoveredRow = nextRow;
        hoveredRow.classList.add("quiz-table-row-resize-target");
        editorElement.classList.add("quiz-table-row-resize-cursor");
      }
    };

    const handleWindowPointerMove = (event: PointerEvent) => {
      if (resizing) {
        handlePointerMove(event);
      }
    };

    const finishResize = () => {
      if (!resizing) {
        return;
      }

      const { pointerId, rowIndex, tableIndex } = resizing;
      const currentRow = findTableRowByCoordinates(editorElement, tableIndex, rowIndex);
      if (currentRow) {
        const nextHeight =
          readCellHeight(currentRow.getBoundingClientRect().height, 44) ?? 44;
        persistTableRowHeight(editor, currentRow, nextHeight);
        currentRow.classList.remove("quiz-table-row-resizing");
      }
      document.body.classList.remove("quiz-table-row-resizing-active");
      if (editorElement.hasPointerCapture(pointerId)) {
        editorElement.releasePointerCapture(pointerId);
      }
      resizing = null;
      clearHoveredRow();
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) {
        return;
      }

      const row = findResizeTarget(event);
      if (!row) {
        return;
      }
      const rowCoordinates = getTableRowCoordinates(editorElement, row);
      if (!rowCoordinates) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      resizing = {
        pointerId: event.pointerId,
        ...rowCoordinates,
        startHeight: row.getBoundingClientRect().height,
        startY: event.clientY,
      };
      row.classList.add("quiz-table-row-resizing");
      editorElement.classList.add("quiz-table-row-resize-cursor");
      document.body.classList.add("quiz-table-row-resizing-active");
      editorElement.setPointerCapture(event.pointerId);
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (resizing?.pointerId === event.pointerId) {
        finishResize();
      }
    };

    editorElement.addEventListener("pointermove", handlePointerMove);
    editorElement.addEventListener("pointerdown", handlePointerDown, true);
    editorElement.addEventListener("pointerleave", clearHoveredRow);
    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      finishResize();
      clearHoveredRow();
      editorElement.removeEventListener("pointermove", handlePointerMove);
      editorElement.removeEventListener("pointerdown", handlePointerDown, true);
      editorElement.removeEventListener("pointerleave", clearHoveredRow);
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [disabled, editor]);
}

function getTableRowCoordinates(editorElement: HTMLElement, row: HTMLTableRowElement) {
  const table = row.closest("table");
  if (!table) {
    return null;
  }

  const tableIndex = Array.from(editorElement.querySelectorAll("table")).indexOf(table);
  const rowIndex = Array.from(table.querySelectorAll("tr")).indexOf(row);
  return tableIndex >= 0 && rowIndex >= 0 ? { rowIndex, tableIndex } : null;
}

function findTableRowByCoordinates(
  editorElement: HTMLElement,
  tableIndex: number,
  rowIndex: number,
) {
  const table = editorElement.querySelectorAll("table").item(tableIndex);
  const row = table?.querySelectorAll("tr").item(rowIndex) ?? null;
  return isTableRowElement(row) ? row : null;
}

function findRowEdgeTarget(
  row: HTMLTableRowElement | null,
  clientY: number,
  edgeTolerance: number,
) {
  if (!row) {
    return null;
  }

  const bounds = row.getBoundingClientRect();
  if (Math.abs(clientY - bounds.bottom) <= edgeTolerance) {
    return row;
  }

  if (
    Math.abs(clientY - bounds.top) <= edgeTolerance &&
    isTableRowElement(row.previousElementSibling)
  ) {
    return row.previousElementSibling;
  }

  return null;
}

function getClosestTableCell(target: EventTarget | null, editorElement: HTMLElement) {
  if (!isDomElement(target)) {
    return null;
  }

  const cell = target.closest("td, th");
  return isTableCellElement(cell) && editorElement.contains(cell) ? cell : null;
}

function isTableCellElement(element: Element | null): element is HTMLTableCellElement {
  return Boolean(element && ["TD", "TH"].includes(element.tagName));
}

function isTableRowElement(element: Element | null): element is HTMLTableRowElement {
  return element?.tagName === "TR";
}

function isDomElement(target: EventTarget | null): target is Element {
  return Boolean(
    target &&
    typeof (target as Element).closest === "function" &&
    typeof (target as Element).tagName === "string",
  );
}

function persistTableRowHeight(editor: Editor, row: HTMLTableRowElement, height: number) {
  const transaction = editor.state.tr;
  let hasChanges = false;

  row
    .querySelectorAll<HTMLTableCellElement>(":scope > th, :scope > td")
    .forEach((cell) => {
      const position = findTableCellPosition(editor, cell);
      if (position === null) {
        return;
      }

      const node = editor.state.doc.nodeAt(position);
      if (!node || !["tableCell", "tableHeader"].includes(node.type.name)) {
        return;
      }

      transaction.setNodeMarkup(position, undefined, {
        ...node.attrs,
        cellHeight: height,
      });
      hasChanges = true;
    });

  if (hasChanges) {
    editor.view.dispatch(transaction);
  }
}

function findTableCellPosition(editor: Editor, cell: HTMLTableCellElement) {
  try {
    const positionInsideCell = editor.view.posAtDOM(cell, 0);
    return (
      [positionInsideCell - 1, positionInsideCell].find((position) => {
        if (position < 0) {
          return false;
        }
        const node = editor.state.doc.nodeAt(position);
        return node ? ["tableCell", "tableHeader"].includes(node.type.name) : false;
      }) ?? null
    );
  } catch {
    return null;
  }
}

function createNumericImageAttribute(dataAttribute: string) {
  return {
    default: null,
    parseHTML: (element: HTMLElement) => {
      const value = Number(element.getAttribute(dataAttribute));
      return Number.isFinite(value) ? value : null;
    },
    renderHTML: (attributes: Record<string, unknown>) => {
      const attributeName = dataAttribute
        .replace(/^data-/, "")
        .replace(/-([a-z])/g, (_, character: string) => character.toUpperCase());
      const value = attributes[attributeName];
      return typeof value === "number" && Number.isFinite(value)
        ? { [dataAttribute]: String(value) }
        : {};
    },
  };
}

async function readLocalImageDimensions(file: File) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const dimensions = { height: bitmap.height, width: bitmap.width };
      bitmap.close();
      return dimensions;
    } catch {
      // Fall through to the image element fallback for browsers without bitmap support.
    }
  }

  return new Promise<{ height: number; width: number }>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    const finish = (dimensions: { height: number; width: number }) => {
      URL.revokeObjectURL(objectUrl);
      resolve(dimensions);
    };
    image.onload = () =>
      finish({
        height: image.naturalHeight || 9,
        width: image.naturalWidth || 16,
      });
    image.onerror = () => finish({ height: 9, width: 16 });
    image.src = objectUrl;
  });
}

function TableComposerDialog({
  draft,
  editor,
  onChange,
  onClose,
}: {
  draft: TableDraft;
  editor: Editor | null;
  onChange: (draft: TableDraft) => void;
  onClose: () => void;
}) {
  const updateDimension = (field: "columns" | "rows", rawValue: string) => {
    const numericValue = Number.parseInt(rawValue.replace(/\D/g, ""), 10);
    onChange({
      ...draft,
      [field]: Number.isFinite(numericValue)
        ? Math.min(Math.max(numericValue, 1), 20)
        : 1,
    });
  };

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <EditorDialogShell
      ariaLabel="Chèn bảng"
      isOpen
      onClose={onClose}
      panelClassName="max-w-lg"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className="theme-dialog-header shrink-0 px-5 py-5 pr-16 sm:px-6">
          <h2 className="text-xl font-extrabold text-[var(--theme-text-strong)]">
            Chèn bảng
          </h2>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {(
              [
                ["rows", "Số hàng"],
                ["columns", "Số cột"],
              ] as const
            ).map(([field, label]) => (
              <label
                key={field}
                className="space-y-2 text-sm font-extrabold text-[var(--theme-text-strong)]"
              >
                <span>{label}</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={draft[field]}
                  onChange={(event) => updateDimension(field, event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 text-sm font-bold text-[var(--theme-text-strong)] outline-none transition focus:border-[var(--theme-primary)] focus:ring-2 focus:ring-[var(--theme-primary-subtle)]"
                />
                <span className="block text-xs font-medium text-[var(--theme-text-muted)]">
                  Từ 1 đến 20
                </span>
              </label>
            ))}
          </div>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-surface-soft)] px-4 text-sm font-bold text-[var(--theme-text-strong)]">
            <input
              type="checkbox"
              checked={draft.withHeaderRow}
              onChange={(event) =>
                onChange({ ...draft, withHeaderRow: event.target.checked })
              }
              className="h-4 w-4 accent-[var(--theme-primary)]"
            />
            Dùng hàng đầu làm tiêu đề
          </label>

          <div
            className="overflow-hidden rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input-bg)]"
            aria-label={`Xem trước bảng ${draft.rows} hàng và ${draft.columns} cột`}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${Math.min(draft.columns, 8)}, minmax(0, 1fr))`,
              }}
            >
              {Array.from({
                length: Math.min(draft.rows, 6) * Math.min(draft.columns, 8),
              }).map((_, index) => (
                <span
                  key={index}
                  aria-hidden="true"
                  className={cn(
                    "h-8 border-b border-r border-[var(--theme-border)]",
                    draft.withHeaderRow &&
                      index < Math.min(draft.columns, 8) &&
                      "bg-[var(--theme-primary-subtle)]",
                  )}
                />
              ))}
            </div>
            {draft.rows > 6 || draft.columns > 8 ? (
              <p className="border-t border-[var(--theme-border)] px-3 py-2 text-center text-xs font-bold text-[var(--theme-text-muted)]">
                Xem trước thu gọn · {draft.rows} hàng × {draft.columns} cột
              </p>
            ) : null}
          </div>
        </div>

        <footer className="theme-dialog-footer flex shrink-0 justify-end gap-2 p-4">
          <button
            type="button"
            onClick={onClose}
            className="theme-button-neutral min-h-11 rounded-lg px-4 text-sm font-extrabold"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!editor}
            onClick={() => {
              editor
                ?.chain()
                .focus()
                .insertTable({
                  cols: draft.columns,
                  rows: draft.rows,
                  withHeaderRow: draft.withHeaderRow,
                })
                .run();
              onClose();
            }}
            className="theme-button-primary inline-flex min-h-11 items-center gap-2 rounded-lg px-5 text-sm font-extrabold disabled:opacity-50"
          >
            <Table2 className="h-4 w-4" aria-hidden="true" />
            Chèn bảng
          </button>
        </footer>
      </div>
    </EditorDialogShell>,
    document.body,
  );
}

function FormulaComposer({
  draft,
  editor,
  onChange,
  onClose,
}: {
  draft: FormulaDraft;
  editor: Editor | null;
  onChange: (draft: FormulaDraft) => void;
  onClose: () => void;
}) {
  const previewHtml = useMemo(
    () =>
      draft.latex.trim()
        ? katex.renderToString(draft.latex, {
            displayMode: draft.kind === "block",
            throwOnError: false,
            strict: false,
          })
        : "",
    [draft.kind, draft.latex],
  );

  const saveFormula = () => {
    const latex = draft.latex.trim();
    if (!editor || !latex) {
      return;
    }

    if (draft.position !== undefined) {
      if (draft.kind === "block") {
        editor.chain().focus().updateBlockMath({ latex, pos: draft.position }).run();
      } else {
        editor.chain().focus().updateInlineMath({ latex, pos: draft.position }).run();
      }
    } else if (draft.kind === "block") {
      editor.chain().focus().insertBlockMath({ latex }).run();
    } else {
      editor.chain().focus().insertInlineMath({ latex }).insertContent(" ").run();
    }
    onClose();
  };

  return (
    <div className="space-y-3 border-t border-[var(--theme-border)] bg-[var(--theme-bg)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-extrabold text-[var(--theme-text-strong)]">
            {draft.position === undefined ? "Chèn công thức" : "Sửa công thức"}
          </p>
          <p className="text-xs font-medium text-[var(--theme-text-muted)]">
            Dùng LaTeX cho Toán/Lý; dùng <code>\ce{"{...}"}</code> cho Hóa học.
          </p>
        </div>
        <button
          type="button"
          aria-label="Đóng trình nhập công thức"
          onClick={onClose}
          className="theme-button-neutral grid h-9 w-9 place-items-center rounded-lg"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {(["inline", "block"] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => onChange({ ...draft, kind })}
            className={cn(
              "min-h-9 rounded-lg border px-3 text-xs font-extrabold",
              draft.kind === kind
                ? "border-[var(--theme-primary)] bg-[var(--theme-primary-subtle)] text-[var(--theme-primary)]"
                : "border-[var(--theme-border)] text-[var(--theme-text-muted)]",
            )}
          >
            {kind === "inline" ? "Trong dòng" : "Một dòng riêng"}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {formulaTemplates.map((template) => (
          <button
            key={template.label}
            type="button"
            onClick={() => onChange({ ...draft, latex: template.latex })}
            className="theme-button-primary-subtle min-h-8 rounded-lg px-2.5 text-xs font-bold"
          >
            {template.label}
          </button>
        ))}
      </div>
      <textarea
        value={draft.latex}
        onChange={(event) => onChange({ ...draft, latex: event.target.value })}
        className="min-h-20 w-full resize-y rounded-lg border border-[var(--theme-input-border)] bg-[var(--theme-input-bg)] px-3 py-2 font-mono text-sm text-[var(--theme-text-strong)] outline-none focus:border-[var(--theme-primary)]"
        placeholder="\frac{a}{b} hoặc \ce{2H2 + O2 -> 2H2O}"
        aria-label="Mã LaTeX công thức"
      />
      <div className="min-h-16 overflow-x-auto rounded-lg border border-dashed border-[var(--theme-border)] bg-[var(--theme-surface-soft)] p-3 text-center text-[var(--theme-text-strong)]">
        {previewHtml ? (
          <span dangerouslySetInnerHTML={{ __html: previewHtml }} />
        ) : (
          <span className="text-sm text-[var(--theme-text-muted)]">
            Xem trước công thức
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          disabled={!draft.latex.trim()}
          onClick={saveFormula}
          className="theme-button-primary inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-extrabold disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
          {draft.position === undefined ? "Chèn công thức" : "Cập nhật"}
        </button>
      </div>
    </div>
  );
}
