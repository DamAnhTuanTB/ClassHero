import React, { useEffect, useState, useRef } from 'react';

const MATH_SNIPPETS = [
  { label: 'Inline ($)', snippet: '$$', cursorOffset: -1 },
  { label: 'Block ($$)', snippet: '$$\n\n$$', cursorOffset: -3 },
  { label: 'Phân số', snippet: '\\frac{}{}', cursorOffset: -3 },
  { label: 'Căn (√)', snippet: '\\sqrt{}', cursorOffset: -1 },
  { label: 'Nhân (·)', snippet: '\\cdot ', cursorOffset: 0 },
  { label: 'Độ (°)', snippet: '^\\circ', cursorOffset: 0 },
  { label: 'Pi (π)', snippet: '\\pi ', cursorOffset: 0 },
  { label: 'Khác (≠)', snippet: '\\neq ', cursorOffset: 0 },
  { label: 'Thuộc (∈)', snippet: '\\in ', cursorOffset: 0 },
  { label: 'Tập Z', snippet: '\\mathbb{Z}', cursorOffset: 0 },
  { label: 'Tập N', snippet: '\\mathbb{N}', cursorOffset: 0 },
  { label: 'Tập Q', snippet: '\\mathbb{Q}', cursorOffset: 0 },
  { label: 'Tập R', snippet: '\\mathbb{R}', cursorOffset: 0 },
  { label: 'Hệ PT', snippet: '\\begin{cases}\n\n\\end{cases}', cursorOffset: -12 },
];

export function MathToolbar() {
  const [activeInput, setActiveInput] = useState<HTMLTextAreaElement | HTMLInputElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const toolbarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (
        target && 
        (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') && 
        target.closest('.react-json-view')
      ) {
        setActiveInput(target as HTMLTextAreaElement | HTMLInputElement);
        updatePosition(target as HTMLTextAreaElement | HTMLInputElement);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        if (document.activeElement?.closest('.math-toolbar-container')) {
           return;
        }
        if (document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
           setActiveInput(null);
        }
      }, 150);
    };

    const handleScroll = () => {
      if (activeInput) {
        updatePosition(activeInput);
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleScroll);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleScroll);
    };
  }, [activeInput]);

  useEffect(() => {
    if (activeInput && toolbarRef.current) {
      updatePosition(activeInput);
    }
  }, [activeInput]);

  const updatePosition = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const toolbarHeight = toolbarRef.current?.offsetHeight || 80;
    let top = rect.top - toolbarHeight - 8;
    
    if (top < 0) {
      top = rect.bottom + 8;
    }

    setPosition({
      top: top,
      left: rect.left,
      width: rect.width,
    });
  };

  const handleInsert = (e: React.MouseEvent, snippet: string, cursorOffset: number) => {
    e.preventDefault(); 
    if (!activeInput) return;

    let finalSnippet = snippet;
    // react-json-view parses <input> values as JSON, so we must escape backslashes and newlines
    if (activeInput.tagName === 'INPUT') {
      finalSnippet = finalSnippet.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
    }

    const start = activeInput.selectionStart || 0;
    const end = activeInput.selectionEnd || 0;
    const text = activeInput.value;

    const before = text.substring(0, start);
    const after = text.substring(end, text.length);

    const newValue = before + finalSnippet + after;
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      activeInput.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
      'value'
    )?.set;
    
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(activeInput, newValue);
    } else {
      activeInput.value = newValue;
    }
    
    activeInput.dispatchEvent(new Event('input', { bubbles: true }));

    const newCursorPos = start + finalSnippet.length + cursorOffset;
    setTimeout(() => {
      activeInput.focus();
      activeInput.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  if (!activeInput) return null;

  return (
    <div 
      ref={toolbarRef}
      className="math-toolbar-container fixed z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-md p-1.5 flex flex-wrap gap-1 items-center"
      style={{
        top: Math.max(10, position.top) + 'px', 
        left: Math.max(10, position.left) + 'px',
        width: position.width > 0 ? position.width + 'px' : 'auto',
      }}
    >
      <div className="text-xs font-bold text-blue-600 dark:text-blue-400 px-2 uppercase mr-1 whitespace-nowrap">Chèn Toán:</div>
      {MATH_SNIPPETS.map((item, idx) => (
        <button
          key={idx}
          onMouseDown={(e) => handleInsert(e, item.snippet, item.cursorOffset)}
          className="px-2.5 py-1 text-xs font-mono bg-slate-50 hover:bg-blue-100 dark:bg-slate-900/50 dark:hover:bg-blue-900/50 text-slate-700 dark:text-slate-300 rounded border border-slate-200 dark:border-slate-700 transition-colors whitespace-nowrap shadow-sm hover:shadow"
          title={item.snippet}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
