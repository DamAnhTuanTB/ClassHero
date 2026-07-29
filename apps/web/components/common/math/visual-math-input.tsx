"use client";

import katex from "katex";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { MathfieldElement } from "mathlive";
import { ImmediateTooltip } from "@/components/common/ui/immediate-tooltip";
import { ImmediateTooltipPortal } from "@/components/common/ui/immediate-tooltip-portal";
import { cn } from "@/lib/utils";
import "mathlive/fonts.css";
import "@/components/common/math/visual-math-input.css";

type FormulaTemplate = {
  label: string;
  latex: string;
  preview: string;
};

type FormulaCategory = {
  id: "numbers" | "greek" | "operators" | "relations" | "structures" | "arrows";
  label: string;
  preview: string;
  templates: FormulaTemplate[];
};

export type VisualMathInputPreset = "full" | "student-answer";
export type VisualMathInputStatus = "correct" | "incorrect" | "idle";

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
      {
        label: "Vector phải",
        latex: "\\overrightarrow{#@}",
        preview: "\\overrightarrow{AB}",
      },
      {
        label: "Vector trái",
        latex: "\\overleftarrow{#@}",
        preview: "\\overleftarrow{AB}",
      },
    ],
  },
];

const studentAnswerFormulaCategories: FormulaCategory[] = [
  {
    id: "numbers",
    label: "Số",
    preview: "123",
    templates: [
      { label: "Số 0", latex: "0", preview: "0" },
      { label: "Số 1", latex: "1", preview: "1" },
      { label: "Số 2", latex: "2", preview: "2" },
      { label: "Số 3", latex: "3", preview: "3" },
      { label: "Số 4", latex: "4", preview: "4" },
      { label: "Số 5", latex: "5", preview: "5" },
      { label: "Số 6", latex: "6", preview: "6" },
      { label: "Số 7", latex: "7", preview: "7" },
      { label: "Số 8", latex: "8", preview: "8" },
      { label: "Số 9", latex: "9", preview: "9" },
      { label: "Dấu trừ", latex: "-", preview: "-" },
      { label: "Dấu chấm thập phân", latex: ".", preview: "." },
    ],
  },
  {
    id: "structures",
    label: "Phân số, căn và số mũ",
    preview: "\\frac{a}{b}\\sqrt{x}x^n",
    templates: [
      {
        label: "Phân số",
        latex: "\\frac{#@}{#?}",
        preview: "\\frac{a}{b}",
      },
      { label: "Căn bậc hai", latex: "\\sqrt{#@}", preview: "\\sqrt{x}" },
      { label: "Lũy thừa", latex: "#@^{#?}", preview: "x^n" },
    ],
  },
];

const mathPreviewCache = new Map<string, string>();

const mathfieldInteractionStyles = `
  :host([data-empty]) .ML__content-placeholder .ML__text {
    background: transparent !important;
  }

  .ML__toggles {
    align-self: center !important;
  }

  :host([data-virtual-keyboard-open]) .ML__virtual-keyboard-toggle,
  :host([data-virtual-keyboard-open]) .ML__virtual-keyboard-toggle:hover {
    border-color: color-mix(
      in srgb,
      var(--visual-math-accent) 42%,
      var(--theme-border)
    ) !important;
    background: var(--theme-primary-soft) !important;
    color: var(--visual-math-accent) !important;
    fill: currentColor !important;
  }
`;

const studentPlaceholderCaretStyles = `
  @keyframes visual-math-placeholder-caret-blink {
    0%, 48% { opacity: 1; }
    49%, 100% { opacity: 0; }
  }

  .ML__content-placeholder {
    color: var(
      --student-math-placeholder-color,
      var(--theme-text-placeholder)
    ) !important;
  }

  .ML__content-placeholder .ML__text {
    font-size: 0.8889em;
    font-weight: 700;
  }

  .ML__focused .ML__cmr.ML__selected {
    position: relative;
  }

  .ML__focused .ML__cmr.ML__selected::after {
    content: "";
    position: absolute;
    top: 18%;
    bottom: 18%;
    left: 50%;
    width: 2px;
    border-radius: 999px;
    background: var(--_caret-color);
    pointer-events: none;
    animation: visual-math-placeholder-caret-blink 1.05s step-end infinite;
  }
`;

export function VisualMathInput({
  ariaLabel,
  disabled = false,
  onBlur,
  onChange,
  onFocus,
  paletteId,
  placeholder = "\\text{Nhập công thức}",
  preset = "full",
  showPalette = true,
  status = "idle",
  value,
}: {
  ariaLabel: string;
  disabled?: boolean;
  onBlur?: () => void;
  onChange: (value: string) => void;
  onFocus?: () => void;
  paletteId?: string;
  placeholder?: string;
  preset?: VisualMathInputPreset;
  showPalette?: boolean;
  status?: VisualMathInputStatus;
  value: string;
}) {
  const availableCategories =
    preset === "student-answer" ? studentAnswerFormulaCategories : formulaCategories;
  const categoryBarRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const mathfieldRef = useRef<MathfieldElement | null>(null);
  const latestOnBlurRef = useRef(onBlur);
  const latestOnChangeRef = useRef(onChange);
  const latestOnFocusRef = useRef(onFocus);
  const latestValueRef = useRef(value);
  const [keyboardTooltipAnchor, setKeyboardTooltipAnchor] = useState<HTMLElement | null>(
    null,
  );
  const [activeCategoryId, setActiveCategoryId] = useState<FormulaCategory["id"]>(() =>
    preset === "student-answer" ? "numbers" : "structures",
  );
  const [isReady, setIsReady] = useState(false);

  latestOnBlurRef.current = onBlur;
  latestOnChangeRef.current = onChange;
  latestOnFocusRef.current = onFocus;
  latestValueRef.current = value;

  useEffect(() => {
    let isDisposed = false;
    let mountedMathfield: MathfieldElement | null = null;
    let virtualKeyboard: typeof window.mathVirtualKeyboard | null = null;
    let virtualKeyboardToggle: HTMLElement | null = null;
    let removeVirtualKeyboardToggleListener: (() => void) | null = null;

    void import("mathlive").then(({ MathfieldElement }) => {
      if (isDisposed || !hostRef.current) {
        return;
      }

      MathfieldElement.locale = "vi";
      MathfieldElement.fractionNavigationOrder = "numerator-denominator";

      const mathfield = new MathfieldElement();
      mountedMathfield = mathfield;
      mathfieldRef.current = mathfield;
      hostRef.current.replaceChildren(mathfield);
      mathfield.macros = {
        ...mathfield.macros,
        ce: {
          args: 1,
          captureSelection: false,
          def: "\\mathrm{#1}",
        },
      };
      mathfield.value = latestValueRef.current;
      mathfield.smartFence = true;
      mathfield.smartMode = false;
      mathfield.smartSuperscript = true;
      mathfield.letterShapeStyle = "upright";
      mathfield.mathVirtualKeyboardPolicy =
        preset === "student-answer" ? "manual" : "auto";
      mathfield.placeholder = placeholder;
      mathfield.disabled = disabled;
      mathfield.setAttribute("aria-label", ariaLabel);
      mathfield.setAttribute("data-visual-math-field", "");

      const syncMathfieldEmptyState = () => {
        mathfield.toggleAttribute("data-empty", mathfield.value.length === 0);
      };
      const syncVirtualKeyboardToggleState = () => {
        const isKeyboardOpenForField =
          Boolean(virtualKeyboard?.visible) && mathfield.hasFocus();

        virtualKeyboardToggle?.classList.toggle("is-active", isKeyboardOpenForField);
        virtualKeyboardToggle?.setAttribute(
          "aria-pressed",
          String(isKeyboardOpenForField),
        );
        virtualKeyboardToggle?.setAttribute(
          "aria-label",
          isKeyboardOpenForField ? "Đóng bàn phím ảo" : "Mở bàn phím ảo",
        );
        mathfield.toggleAttribute("data-virtual-keyboard-open", isKeyboardOpenForField);
      };
      const handleInput = () => {
        syncMathfieldEmptyState();
        latestOnChangeRef.current(mathfield.value);
      };
      const handleBlur = () => {
        latestOnBlurRef.current?.();
        requestAnimationFrame(syncVirtualKeyboardToggleState);
      };
      const handleFocus = () => {
        latestOnFocusRef.current?.();
        requestAnimationFrame(syncVirtualKeyboardToggleState);
      };
      const restorePointerFocus = () => {
        requestAnimationFrame(() => {
          if (mathfieldRef.current === mathfield && !mathfield.disabled) {
            mathfield.focus();
          }
        });
      };
      mathfield.addEventListener("input", handleInput);
      mathfield.addEventListener("blur", handleBlur);
      mathfield.addEventListener("focus", handleFocus);
      mathfield.addEventListener("pointerdown", restorePointerFocus);
      syncMathfieldEmptyState();
      const mathfieldShadowRoot = mathfield.shadowRoot;
      if (mathfieldShadowRoot) {
        const interactionStyle = document.createElement("style");
        interactionStyle.textContent = mathfieldInteractionStyles;
        mathfieldShadowRoot.append(interactionStyle);

        if (preset === "student-answer") {
          const placeholderCaretStyle = document.createElement("style");
          placeholderCaretStyle.textContent = studentPlaceholderCaretStyles;
          mathfieldShadowRoot.append(placeholderCaretStyle);
        }
      }
      virtualKeyboardToggle =
        mathfieldShadowRoot?.querySelector<HTMLElement>(
          '[part="virtual-keyboard-toggle"]',
        ) ?? null;
      virtualKeyboard = window.mathVirtualKeyboard;
      const showKeyboardTooltip = () => {
        setKeyboardTooltipAnchor(virtualKeyboardToggle);
      };
      const hideKeyboardTooltip = () => {
        setKeyboardTooltipAnchor(null);
      };
      virtualKeyboardToggle?.removeAttribute("data-tooltip");
      virtualKeyboardToggle?.removeAttribute("data-l10n-tooltip");
      virtualKeyboardToggle?.setAttribute("aria-label", "Mở bàn phím ảo");
      virtualKeyboardToggle?.setAttribute("aria-pressed", "false");
      virtualKeyboardToggle?.addEventListener("pointerenter", showKeyboardTooltip);
      virtualKeyboardToggle?.addEventListener("pointerleave", hideKeyboardTooltip);
      virtualKeyboardToggle?.addEventListener("focusin", showKeyboardTooltip);
      virtualKeyboardToggle?.addEventListener("focusout", hideKeyboardTooltip);
      virtualKeyboard.addEventListener(
        "virtual-keyboard-toggle",
        syncVirtualKeyboardToggleState,
      );
      removeVirtualKeyboardToggleListener = () => {
        virtualKeyboard?.removeEventListener(
          "virtual-keyboard-toggle",
          syncVirtualKeyboardToggleState,
        );
      };
      syncVirtualKeyboardToggleState();
      const keepVectorPlaceholderSelected = (event: Event) => {
        const clickedSelectedGlyph = event
          .composedPath()
          .some(
            (target) =>
              target instanceof Element && target.classList.contains("ML__selected"),
          );
        if (!mathfield.value.includes("\\vec{\\placeholder") || !clickedSelectedGlyph) {
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
      if (preset === "student-answer") {
        restorePointerFocus();
      }

      mathfield.addEventListener(
        "unmount",
        () => {
          mathfield.removeEventListener("input", handleInput);
          mathfield.removeEventListener("blur", handleBlur);
          mathfield.removeEventListener("focus", handleFocus);
          mathfield.removeEventListener("pointerdown", restorePointerFocus);
          mathfieldShadowRoot?.removeEventListener(
            "pointerdown",
            keepVectorPlaceholderSelected,
            { capture: true },
          );
          virtualKeyboardToggle?.removeEventListener("pointerenter", showKeyboardTooltip);
          virtualKeyboardToggle?.removeEventListener("pointerleave", hideKeyboardTooltip);
          virtualKeyboardToggle?.removeEventListener("focusin", showKeyboardTooltip);
          virtualKeyboardToggle?.removeEventListener("focusout", hideKeyboardTooltip);
          removeVirtualKeyboardToggleListener?.();
          hideKeyboardTooltip();
        },
        { once: true },
      );
    });

    return () => {
      isDisposed = true;
      setKeyboardTooltipAnchor(null);
      removeVirtualKeyboardToggleListener?.();
      mountedMathfield?.remove();
      if (mathfieldRef.current === mountedMathfield) {
        mathfieldRef.current = null;
      }
    };
  }, [ariaLabel, disabled, placeholder, preset]);

  useEffect(() => {
    const mathfield = mathfieldRef.current;
    if (mathfield) {
      if (mathfield.value !== value) {
        mathfield.setValue(value);
      }
      mathfield.toggleAttribute("data-empty", mathfield.value.length === 0);
    }
  }, [value]);

  useEffect(() => {
    if (mathfieldRef.current) {
      mathfieldRef.current.disabled = disabled;
    }
  }, [disabled]);

  const activeCategory =
    availableCategories.find((category) => category.id === activeCategoryId) ??
    availableCategories[0]!;
  const visibleTemplates =
    preset === "student-answer"
      ? availableCategories.flatMap((category) => category.templates)
      : activeCategory.templates;

  const categoryPalette = (
    <div
      id={paletteId}
      className="visual-math-input__controls"
      aria-hidden={showPalette ? undefined : true}
    >
      {preset === "full" ? (
        <div
          ref={categoryBarRef}
          className="visual-math-input__category-bar"
          role="toolbar"
          aria-label="Nhóm ký hiệu và cấu trúc công thức"
        >
          {availableCategories.map((category) => (
            <ImmediateTooltip key={category.id} content={category.label}>
              <button
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
            </ImmediateTooltip>
          ))}
        </div>
      ) : null}

      <div
        className="visual-math-input__palette"
        role="group"
        aria-label={
          preset === "student-answer" ? "Bàn phím số và công thức" : activeCategory.label
        }
      >
        {visibleTemplates.map((template) => (
          <ImmediateTooltip key={template.label} content={template.label}>
            <button
              type="button"
              disabled={disabled || !isReady}
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
          </ImmediateTooltip>
        ))}
      </div>
    </div>
  );

  const field = (
    <div className="visual-math-input__field-shell">
      <div className="visual-math-input__field-host">
        <div ref={hostRef} className="visual-math-input__mount" />
        {!isReady ? (
          <div
            className="visual-math-input__loading"
            role="status"
            aria-label="Đang mở vùng nhập công thức"
            aria-live="polite"
          >
            {preset === "full" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Đang mở vùng nhập công thức…
              </>
            ) : null}
          </div>
        ) : null}
      </div>
      {preset === "full" ? (
        <p className="visual-math-input__hint">
          Chọn mẫu rồi nhập vào từng ô. Dùng Tab để chuyển vị trí.
        </p>
      ) : null}
    </div>
  );

  return (
    <div
      className={cn(
        "visual-math-input",
        preset === "student-answer" && "visual-math-input--student-answer",
        status === "correct" && "visual-math-input--correct",
        status === "incorrect" && "visual-math-input--incorrect",
      )}
    >
      {preset === "student-answer" ? field : null}
      {showPalette ? categoryPalette : null}
      {preset === "full" ? field : null}
      <ImmediateTooltipPortal
        anchor={keyboardTooltipAnchor}
        content="Mở hoặc đóng bàn phím ảo"
      />
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
