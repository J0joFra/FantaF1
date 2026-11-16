// Pulsing placeholder cards shown while a page's data loads, so the content
// area doesn't sit blank (white) under the header for a few seconds.
export default function PageSkeleton({ heights = ["h-24", "h-40", "h-56", "h-32"] }) {
  return (
    <div className="px-4 py-5 space-y-4" aria-busy="true" aria-live="polite">
      {heights.map((h, i) => (
        <div key={i} className={`${h} rounded-2xl bg-gray-200/70 animate-pulse`} />
      ))}
    </div>
  );
}
