export function Item({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className={`mt-0.5 break-words text-sm font-medium ${mono ? "font-mono" : ""}`}>{value || <span className="font-normal text-faint">Not provided</span>}</dd>
    </div>
  );
}
