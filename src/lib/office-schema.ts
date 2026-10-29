import { z } from "zod";
import { GEO, PROVINCES } from "./pakistan-geo";
import type { OfficeStatus } from "./types";

/**
 * Validation and rules for the Organization and Branch modules.
 * Client-safe (no server imports): the browser validates each form with the same schema the server enforces.
 */

const digits = (v: string) => v.replace(/[\s\-()]/g, "");
const phone = (min: number, what: string) =>
  z.string().trim().min(1, `Enter ${what}.`).refine((v) => new RegExp(`^\\+?\\d{${min},15}$`).test(digits(v)), `Enter a valid ${what}.`);
const optionalPhone = (min: number, what: string) =>
  z.string().trim().refine((v) => !v || new RegExp(`^\\+?\\d{${min},15}$`).test(digits(v)), `Enter a valid ${what}.`);

const cityCheck = (d: { province?: string; city?: string }, ctx: z.RefinementCtx) => {
  if (d.province && d.city && !(GEO[d.province] ?? []).includes(d.city)) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Select a city from the list for this province." });
  }
};

/* ---------- Branch (FR-BR-001) ---------- */

export const branchShape = {
  branchName: z.string().trim().min(2, "Enter the branch name.").max(100, "Keep the name under 100 characters."),
  // The configurable part of the identifier. The system turns LHR into BR-LHR-001.
  branchCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,6}$/, "Use 2 to 6 letters or numbers, for example LHR."),
  address: z.string().trim().min(5, "Enter the branch address.").max(250, "Keep the address under 250 characters."),
  country: z.literal("Pakistan", "Country must be Pakistan."),
  province: z.enum(PROVINCES as [string, ...string[]], "Select a province."),
  city: z.string().trim().min(1, "Select a city."),
  contactPhone: phone(7, "contact number"),
  email: z.string().trim().toLowerCase().min(1, "Enter the branch email.").email("Enter a valid branch email."),
  managerName: z.string().trim().min(2, "Enter the branch manager's name.").max(80, "Keep the name under 80 characters."),
  managerEmail: z.string().trim().toLowerCase().max(120, "Keep the email under 120 characters.").refine((v) => !v || z.string().email().safeParse(v).success, "Enter a valid email."),
  managerPhone: optionalPhone(10, "mobile number"),
  openingDate: z.string().trim().refine((v) => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)), "Enter the opening date."),
  notes: z.string().trim().max(500, "Keep the notes under 500 characters."),
};
export const branchSchema = z.object(branchShape).superRefine(cityCheck);

// The identifier is fixed once issued, so editing a branch never touches the code.
const { branchCode: _code, ...editShape } = branchShape; // eslint-disable-line @typescript-eslint/no-unused-vars
export const branchEditSchema = z.object(editShape).superRefine(cityCheck);

export const BRANCH_FIELDS = Object.keys(branchShape);
export const BRANCH_EDIT_FIELDS = Object.keys(editShape);

/** Suggests a branch code from the city: the first three letters (Lahore -> LAH). The user can change it. */
export const suggestBranchCode = (city: string) => city.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();

/* ---------- Administrative status (FR-ORG-006, FR-ORG-007) ---------- */

export const STATUS_TRANSITIONS: Record<OfficeStatus, OfficeStatus[]> = {
  pending: ["active"],
  active: ["suspended", "blocked", "closed"],
  suspended: ["active", "blocked", "closed"],
  blocked: ["active", "closed"], // "not permitted unless explicitly reactivated"
  closed: ["active"],
};

export const STATUS_ACTION_COPY: Record<OfficeStatus, { verb: string; button: string; help: string }> = {
  pending: { verb: "Approved", button: "Approve", help: "Makes the office active." },
  active: { verb: "Reactivated", button: "Reactivate", help: "Restores access for the office and the users who belong to it." },
  suspended: { verb: "Suspended", button: "Suspend", help: "Temporary. Everyone in the office is signed out of the system until you reactivate it." },
  blocked: { verb: "Blocked", button: "Block", help: "Stronger than suspension. The office stays out until you explicitly reactivate it." },
  closed: { verb: "Closed", button: "Close", help: "The office is shut down. Its records stay available for audit." },
};

export const statusChangeSchema = z.object({
  id: z.string().min(1),
  to: z.enum(["active", "suspended", "blocked", "closed"]),
  reason: z.string().trim().min(3, "Give a short reason. It is kept in the record.").max(300, "Keep the reason under 300 characters."),
});

/* ---------- Listing filters (server-side search, FR-ORG-008) ---------- */

export const OFFICE_STATUSES: OfficeStatus[] = ["active", "pending", "suspended", "blocked", "closed"];
export const OFFICE_SORTS = [
  { value: "name", label: "Name A to Z" },
  { value: "newest", label: "Newest first" },
  { value: "city", label: "City" },
] as const;
export type OfficeSort = (typeof OFFICE_SORTS)[number]["value"];
export const PAGE_SIZE = 20;
