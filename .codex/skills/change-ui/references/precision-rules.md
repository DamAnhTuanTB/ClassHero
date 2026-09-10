# Change UI Precision Rules

Read only the section matching the requested change.

## Scoped property changes

- For color-only changes, preserve shadow/glow/transform/border/radius/spacing and
  interaction states. Recolor every state without replacing a variant whose
  computed behavior differs.
- For font-size-only changes, preserve family/style/weight and glyph rendering.
  When text and math must share one size, use one root token; KaTeX/MathJax inherit
  `1em`. If optical glyph height must match across typefaces, derive one relative
  optical-size token from measured metrics rather than scattered pixels.
- Recoloring one item in a finite semantic set requires auditing the full palette
  in both themes. Keep hues distinct from adjacent success/error/warning states.
- A feature accent applied to a shared component must cover every accent-bearing
  element and hover/dark state.

## Toolbar, navigation and controls

- “All icons/tooltips” means every visible toolbar level in scope, including
  parent section, content block/card/media and edit states. Distinguish text-label
  controls from icon-only controls and keep accessible labels.
- Adding a control beside an existing action must not repurpose or overwrite the
  existing handler unless replacement was explicitly requested.
- Compact repeated navigation should show one primary semantic badge; move
  secondary metadata such as AI origin to a subtle accessible icon.
- Bottom-pinned sidebar/footer stays after the scrollable region in DOM order with
  a full-height `min-h-0` flex chain; do not rely on CSS `order` alone.

## Math and answer content

- STEM formula editing uses the shared WYSIWYG math field; raw LaTeX is only an
  explicitly requested advanced mode. Fraction/root/power/integral structures
  must expose navigable visual slots.
- Decorative radicals use the shared overbar pattern with an explicit radicand,
  not standalone Unicode `√`.
- Multiple-choice/multi-statement answer bodies remain left-aligned, including
  display KaTeX and MathJax SVG. Keep only the A/B/C/D badge centered; use the
  shared renderer alignment mode and target both outer/inner renderer elements.
- Answer cards expand vertically. Local formula/table/code regions may scroll
  horizontally but must not introduce fixed-height vertical scrollbars.

## Auth and branded states

- Student/parent auth uses concise action-focused copy and age-appropriate study
  visuals, not corporate/coworking imagery or explanatory side panels.
- A strong desktop auth visual may use a split screen with compact brand welcome
  copy; keep the form readable and the mobile flow primary when the reference is
  mobile. Avoid oversized black headlines or opaque blocks hiding the visual.
- Decorative icons on loading/transition screens remain secondary to logo/status;
  avoid saturated moving tiles or heavy shadows that compete for attention.

## Repeated visual mismatch

Static checks do not prove browser appearance. When owner says a repeated CSS
change is not visible, first verify route/component, dev server/HMR/cache, active
theme and CSS cascade/computed style before changing more classes. Report the
actual verification level.
