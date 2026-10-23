import clsx, { type ClassValue } from "clsx";
import type { OfficeStatus, RegistrationStatus, SubscriptionStatus } from "./types";

export const cn = (...v: ClassValue[]) => clsx(v);

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

export const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");

export type Tone = "ok" | "warn" | "bad" | "brand" | "neutral" | "beacon";

export const toneClass: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  brand: "bg-brand-soft text-brand-strong",
  beacon: "bg-beacon-soft text-warn",
  neutral: "bg-line/60 text-muted",
};

export const officeStatusMeta: Record<OfficeStatus, { label: string; tone: Tone; color: string }> = {
  active: { label: "Active", tone: "ok", color: "rgb(var(--ok))" },
  pending: { label: "Pending", tone: "beacon", color: "rgb(var(--beacon))" },
  suspended: { label: "Suspended", tone: "warn", color: "rgb(var(--warn))" },
  blocked: { label: "Blocked", tone: "bad", color: "rgb(var(--bad))" },
  closed: { label: "Closed", tone: "neutral", color: "rgb(var(--faint))" },
};

export const subscriptionMeta: Record<SubscriptionStatus, { label: string; tone: Tone; color: string }> = {
  active: { label: "Active", tone: "ok", color: "rgb(var(--ok))" },
  expiring_soon: { label: "Expiring soon", tone: "beacon", color: "rgb(var(--beacon))" },
  expired: { label: "Expired", tone: "bad", color: "rgb(var(--bad))" },
  exempt: { label: "Exempt", tone: "brand", color: "rgb(var(--brand))" },
  not_subscribed: { label: "Not subscribed", tone: "neutral", color: "rgb(var(--faint))" },
  cancelled: { label: "Cancelled", tone: "neutral", color: "rgb(var(--faint))" },
};

export const registrationMeta: Record<RegistrationStatus, { label: string; tone: Tone }> = {
  pending: { label: "Awaiting review", tone: "beacon" },
  under_review: { label: "In review", tone: "brand" },
  info_required: { label: "Needs documents", tone: "warn" },
  approved: { label: "Approved", tone: "ok" },
  rejected: { label: "Rejected", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
