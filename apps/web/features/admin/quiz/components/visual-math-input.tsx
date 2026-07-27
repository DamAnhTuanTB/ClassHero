"use client";

import katex from "katex";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { cn } from "@/lib/utils";
import "mathlive/fonts.css";
import "@/features/admin/quiz/components/visual-math-input.css";

type FormulaTemplate = {
  label: string;
  latex: string;
  preview: string;
};

type FormulaCategory = {
  id: "greek" | "operators" | "relations" | "structures" | "arrows";
  label: string;
  preview: string;
  templates: FormulaTemplate[];
};

const formulaCategories: FormulaCategory[] = [
  {
    id: "greek",
    label: "Chữ cái Hy Lạp",
    preview: "\\alpha\\beta\\Delta",
    templates: [
      { label: "Alpha", latex: "\\alpha", preview: "\\alpha" },
      { label: "Beta", latex: "\\beta", preview: "\\beta" },
      { label: "Gamma", latex: "\\gamma", preview: "\\gamma" },
      { label: "Delta", latex: "\\delta", preview: "\\delta" },
      { label: "Theta", latex: "\\theta", preview: "\\theta" },
      { label: "Lambda", latex: "\\lambda", preview: "\\lambda" },
      { label: "Mu", latex: "\\mu", preview: "\\mu" },
      { label: "Pi", latex: "\\pi", preview: "\\pi" },
      { label: "Sigma", latex: "\\sigma", preview: "\\sigma" },
      { label: "Phi", latex: "\\varphi", preview: "\\varphi" },
      { label: "Omega", latex: "\\omega", preview: "\\omega" },
      { label: "Delta hoa", latex: "\\Delta", preview: "\\Delta" },
      { label: "Sigma hoa", latex: "\\Sigma", preview: "\\Sigma" },
      { label: "Omega hoa", latex: "\\Omega", preview: "\\Omega" },
    ],
  },
  {
    id: "operators",
    label: "Phép toán",
    preview: "\\times\\div\\exists",
    templates: [
      { label: "Cộng trừ", latex: "\\pm", preview: "\\pm" },
      { label: "Nhân", latex: "\\times", preview: "\\times" },
      { label: "Chia", latex: "\\div", preview: "\\div" },
      { label: "Nhân chấm", latex: "\\cdot", preview: "\\cdot" },
      { label: "Vô cực", latex: "\\infty", preview: "\\infty" },
      { label: "Đạo hàm riêng", latex: "\\partial", preview: "\\partial" },
      { label: "Nabla", latex: "\\nabla", preview: "\\nabla" },
      { label: "Với mọi", latex: "\\forall", preview: "\\forall" },
      { label: "Tồn tại", latex: "\\exists", preview: "\\exists" },
      { label: "Không tồn tại", latex: "\\nexists", preview: "\\nexists" },
      { label: "Giao", latex: "\\cap", preview: "\\cap" },
      { label: "Hợp", latex: "\\cup", preview: "\\cup" },
      { label: "Vuông góc", latex: "\\perp", preview: "\\perp" },
      { label: "Song song", latex: "\\parallel", preview: "\\parallel" },
    ],
  },
  {
    id: "relations",
    label: "Quan hệ",
    preview: "\\leq\\neq\\approx",
    templates: [
      { label: "Bằng", latex: "=", preview: "=" },
      { label: "Khác", latex: "\\neq", preview: "\\neq" },
      { label: "Nhỏ hơn", latex: "<", preview: "<" },
      { label: "Lớn hơn", latex: ">", preview: ">" },
      { label: "Nhỏ hơn hoặc bằng", latex: "\\leq", preview: "\\leq" },
      { label: "Lớn hơn hoặc bằng", latex: "\\geq", preview: "\\geq" },
      { label: "Xấp xỉ", latex: "\\approx", preview: "\\approx" },
      { label: "Tương đương", latex: "\\equiv", preview: "\\equiv" },
      { label: "Thuộc", latex: "\\in", preview: "\\in" },
      { label: "Không thuộc", latex: "\\notin", preview: "\\notin" },
      { label: "Tập con", latex: "\\subset", preview: "\\subset" },
      { label: "Tập con hoặc bằng", latex: "\\subseteq", preview: "\\subseteq" },
      { label: "Suy ra", latex: "\\implies", preview: "\\implies" },
      { label: "Khi và chỉ khi", latex: "\\iff", preview: "\\iff" },
    ],
  },
  {
    id: "structures",
    label: "Cấu trúc",
    preview: "\\sqrt{x}\\int\\sum",
    templates: [
      {
        label: "Phân số",
        latex: "\\frac{#@}{#?}",
        preview: "\\frac{a}{b}",
      },
      { label: "Căn bậc hai", latex: "\\sqrt{#@}", preview: "\\sqrt{x}" },
      {
        label: "Căn bậc n",
        latex: "\\sqrt[#?]{#@}",
        preview: "\\sqrt[n]{x}",
      },
      { label: "Lũy thừa", latex: "#@^{#?}", preview: "x^n" },
      { label: "Chỉ số dưới", latex: "#@_{#?}", preview: "x_n" },
      {
        label: "Tích phân",
        latex: "\\int_{#?}^{#?}#?\\,\\mathrm{d}#?",
        preview: "\\int_a^b f(x)\\,\\mathrm{d}x",
      },
      {
        label: "Tổng",
        latex: "\\sum_{#?}^{#?}#?",
        preview: "\\sum_{i=1}^n a_i",
      },
      {
        label: "Tích",
        latex: "\\prod_{#?}^{#?}#?",
        preview: "\\prod_{i=1}^n a_i",
      },
      {
        label: "Giới hạn",
        latex: "\\lim_{#?\\to#?}#?",
        preview: "\\lim_{x\\to a}f(x)",
      },
      {
        label: "Ngoặc tròn",
        latex: "\\left(#@\\right)",
        preview: "\\left(x\\right)",
      },
      {
        label: "Ngoặc vuông",
        latex: "\\left[#@\\right]",
        preview: "\\left[x\\right]",
      },
      {
        label: "Ngoặc nhọn",
        latex: "\\left\\{#@\\right\\}",
        preview: "\\left\\{x\\right\\}",
      },
      {
        label: "Giá trị tuyệt đối",
        latex: "\\left|#@\\right|",
        preview: "\\left|x\\right|",
      },
      {
        label: "Vector",
        latex: "\\vec{#?}",
        preview: "\\vec{F}",
      },
      {
        label: "Hóa học",
        latex: "#@_{#?}#?",
        preview: "\\mathrm{H_2O}",
      },
    ],
  },
  {
    id: "arrows",
    label: "Mũi tên",
    preview: "\\leftarrow\\uparrow\\rightarrow",
    templates: [
      { label: "Sang trái", latex: "\\leftarrow", preview: "\\leftarrow" },
      { label: "Sang phải", latex: "\\rightarrow", preview: "\\rightarrow" },
      {
        label: "Hai chiều",
        latex: "\\leftrightarrow",
        preview: "\\leftrightarrow",
      },
      { label: "Lên", latex: "\\uparrow", preview: "\\uparrow" },
      { label: "Xuống", latex: "\\downarrow", preview: "\\downarrow" },
      { label: "Ánh xạ", latex: "\\mapsto", preview: "\\mapsto" },
      { label: "Suy ra phải", latex: "\\Rightarrow", preview: "\\Rightarrow" },
      { label: "Tương đương", latex: "\\Leftrightarrow", preview: "\\Leftrightarrow" },
      { label: "Vector phải", latex: "\\overrightarrow{#@}", preview: "\\overrightarrow{AB}" },
      { label: "Vector trái", latex: "\\overleftarrow{#@}", preview: "\\overleftarrow{AB}" },
    ],
  },
];

const mathPreviewCache = new Map<string, string>();

export function VisualMathInput({
  ariaLabel,
  disabled = false,
  onBlur,
  onChange,
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  value: string;
}) {
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const latestOnBlurRef = useRef(onBlur);
  const latestOnChangeRef = useRef(onChange);
  const latestValueRef = useRef(value);
  const [activeCategoryId, setActiveCategoryId] =
    useState<FormulaCategory["id"]>("structures");
  const [isReady, setIsReady] = useState(false);

  latestOnBlurRef.current = onBlur;
  latestOnChangeRef.current = onChange;
  latestValueRef.current = value;

  useEffect(() => {
    let isDisposed = false;
    let mountedMathfield: MathfieldElement | null = null;

    void import("mathlive").then(({ MathfieldElement }) => {
      if (isDisposed || !hostRef.current) {
        return;
      }

      MathfieldElement.locale = "vi";
      MathfieldElement.fractionNavigationOrder = "numerator-denominator";

      const mathfield = new MathfieldElement({
        macros: {
          ce: {
            args: 1,
            captureSelection: false,
            def: "\\mathrm{#1}",
          },
        },
      });
      mountedMathfield = mathfield;
      mathfieldRef.current = mathfield;
      mathfield.value = latestValueRef.current;
      mathfield.smartFence = true;
      mathfield.smartMode = false;
      mathfield.smartSuperscript = true;
      mathfield.letterShapeStyle = "upright";
      mathfield.mathVirtualKeyboardPolicy = "auto";
      mathfield.placeholder = "\\text{Nhập công thức}";
      mathfield.disabled = disabled;
      mathfield.setAttribute("aria-label", ariaLabel);
      mathfield.setAttribute("data-visual-math-field", "");

      const handleInput = () => latestOnChangeRef.current(mathfield.value);
      const handleBlur = () => latestOnBlurRef.current?.();
      mathfield.addEventListener("input", handleInput);
      mathfield.addEventListener("blur", handleBlur);
      hostRef.current.replaceChildren(mathfield);
      const mathfieldShadowRoot = mathfield.shadowRoot;
      const keepVectorPlaceholderSelected = (event: Event) => {
        const clickedSelectedGlyph = event
          .composedPath()
          .some(
            (target) =>
              target instanceof Element &&
              target.classList.contains("ML__selected"),
          );
        if (
          !mathfield.value.includes("\\vec{\\placeholder") ||
          !clickedSelectedGlyph
        ) {
          return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        mathfield.focus();
      };
      mathfieldShadowRoot?.addEventListener(
        "pointerdown",
        keepVectorPlaceholderSelected,
        { capture: true },
      );
      setIsReady(true);

      mathfield.addEventListener(
        "unmount",
        () => {
          mathfield.removeEventListener("input", handleInput);
          mathfield.removeEventListener("blur", handleBlur);
          mathfieldShadowRoot?.removeEventListener(
            "pointerdown",
            keepVectorPlaceholderSelected,
            { capture: true },
          );
        },
        { once: true },
      );
    });

    return () => {
      isDisposed = true;
      mountedMathfield?.remove();
      if (mathfieldRef.current === mountedMathfield) {
        mathfieldRef.current = null;
      }
    };
  }, [ariaLabel, disabled]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (mathfield && mathfield.value !== value) {
      mathfield.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (mathfieldRef.current) {
      mathfieldRef.current.disabled = disabled;
    }
  }, [disabled]);

  const activeCategory =
    formulaCategories.find((category) => category.id === activeCategoryId) ??
    formulaCategories[0]!;

  return (
    <div className="visual-math-input">
      <div
        ref={categoryBarRef}
        className="visual-math-input__category-bar"
        role="toolbar"
        aria-label="Nhóm ký hiệu và cấu trúc công thức"
      >
        {formulaCategories.map((category) => (
          <button
            key={category.id}
            type="button"
            aria-label={category.label}
            aria-pressed={activeCategoryId === category.id}
            disabled={disabled}
            onClick={(event) => {
              setActiveCategoryId(category.id);
              const categoryBar = categoryBarRef.current;
              if (!categoryBar) {
                return;
              }

              const categoryButton = event.currentTarget;
              const centeredScrollLeft =
                categoryButton.offsetLeft -
                (categoryBar.clientWidth - categoryButton.offsetWidth) / 2;
              categoryBar.scrollTo({
                behavior: "smooth",
                left: centeredScrollLeft,
              });
            }}
            className={cn(
              "visual-math-input__category-button",
              activeCategoryId === category.id &&
                "visual-math-input__category-button--active",
            )}
          >
            <span
              className="visual-math-input__math-preview"
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html: renderMathPreviewHtml(category.preview),
              }}
            />
            <span aria-hidden="true" className="visual-math-input__caret">
              ▾
            </span>
          </button>
        ))}
      </div>

      <div
        className="visual-math-input__palette"
        role="group"
        aria-label={activeCategory.label}
      >
        {activeCategory.templates.map((template) => (
          <button
            key={template.label}
            type="button"
            disabled={disabled || !isReady}
            title={template.label}
            aria-label={`Chèn ${template.label.toLocaleLowerCase("vi")}`}
            onClick={() => {
              const mathfield = mathfieldRef.current;
              if (!mathfield) {
                return;
              }
              mathfield.insert(template.latex, {
                focus: true,
                insertionMode: "replaceSelection",
                selectionMode: "placeholder",
              });
              requestAnimationFrame(() => {
                if (mathfieldRef.current === mathfield) {
                  mathfield.focus();
                }
              });
              latestOnChangeRef.current(mathfield.value);
            }}
            className="visual-math-input__template-button"
          >
            <span
              className="visual-math-input__math-preview"
              aria-hidden="true"
              dangerouslySetInnerHTML={{
                __html: renderMathPreviewHtml(template.preview),
              }}
            />
          </button>
        ))}
      </div>

      <div className="visual-math-input__field-shell">
        <div className="visual-math-input__field-host">
          <div ref={hostRef} className="visual-math-input__mount" />
          {!isReady ? (
            <div className="visual-math-input__loading" aria-live="polite">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Đang mở vùng nhập công thức…
            </div>
          ) : null}
        </div>
        <p className="visual-math-input__hint">
          Chọn mẫu rồi nhập vào từng ô. Dùng Tab để chuyển vị trí.
        </p>
      </div>
    </div>
  );
}

function renderMathPreviewHtml(latex: string) {
  const cachedHtml = mathPreviewCache.get(latex);
  if (cachedHtml) {
    return cachedHtml;
  }

  const html = katex.renderToString(latex, {
    throwOnError: false,
    strict: false,
  });
  mathPreviewCache.set(latex, html);
  return html;
}
