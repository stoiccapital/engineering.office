// Inline numeric span: JetBrains Mono + tabular-nums per design.md's number rule.
// Use this whenever a number appears inside a text run (titles, subtitles, prose).
// For dedicated numeric table cells, use the `.num` CSS class instead.
export function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-mono tabular-nums">{children}</span>
}
