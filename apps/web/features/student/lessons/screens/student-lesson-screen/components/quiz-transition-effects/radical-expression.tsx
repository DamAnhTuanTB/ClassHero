export function RadicalExpression({ radicand = "x" }: { radicand?: string }) {
  return (
    <span className="inline-flex items-start leading-none">
      <span className="translate-y-[0.06em]">√</span>
      <span className="-ml-[0.08em] border-t-[0.08em] border-current px-[0.04em] pt-[0.04em]">
        {radicand}
      </span>
    </span>
  );
}
