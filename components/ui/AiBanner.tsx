// DESIGN_SYSTEM.md §5: locked pattern, reused everywhere AI output appears
// (draft review, sprint plan proposals, generated docs, executive
// recommendations) — ai-100 background, ai-600 4px left border, caption
// label.
export function AiBanner({ label = "AI-generated — review before accepting" }: { label?: string }) {
  return (
    <div className="border-l-4 border-ai-600 bg-ai-100 px-4 py-3">
      <p className="text-caption font-medium uppercase tracking-wide text-ai-600">{label}</p>
    </div>
  );
}
