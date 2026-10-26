import { z } from "zod";
import { DESIGNATIONS, OFFICE_TYPES } from "./signup-config";
import { GEO, PROVINCES } from "./pakistan-geo";

/** One schema, used by the browser (step validation) and the server (the real check). */

const digits = (v: string) => v.replace(/[\s\-()]/g, "");
const phone = (min: number, what: string) =>
  z.string().trim().min(1, `Enter ${what}.`).refine((v) => new RegExp(`^\\+?\\d{${min},15}$`).test(digits(v)), `Enter a valid ${what}.`);
const optionalCode = (max: number, what: string) =>
  z.string().trim().max(max, `${what} is too long.`).regex(/^[A-Za-z0-9\-\s/]*$/, `${what} can only contain letters, numbers and hyphens.`);

/** Canonical NTN: 1234567-8 for 8 digits, or the 13-digit CNIC form. */
export const normalizeNtn = (v: string) => {
  const d = v.replace(/[\s-]/g, "");
  return d.length === 8 ? `${d.slice(0, 7)}-${d.slice(7)}` : d;
};
export const normalizeWebsite = (v: string) => (!v ? "" : /^https?:\/\//i.test(v) ? v : `https://${v}`);

const companyShape = {
  officeName: z.string().trim().min(2, "Enter the head office name.").max(120, "Keep the name under 120 characters."),
  legalName: z.string().trim().max(160, "Keep the legal name under 160 characters."),
  officeType: z.enum(OFFICE_TYPES.map((o) => o.value) as [string, ...string[]], "Select an office type."),
  ntn: z.string().trim().min(1, "Enter your NTN.").refine((v) => /^(\d{7}-?\d|\d{13})$/.test(v.replace(/\s/g, "")), "Enter a valid NTN, for example 1234567-8."),
  salesTaxNumber: optionalCode(25, "Sales tax number"),
  companyRegNumber: optionalCode(30, "Registration number"),
  registeredAddress: z.string().trim().min(5, "Enter the registered address.").max(250, "Keep the address under 250 characters."),
  operationalAddress: z.string().trim().min(5, "Enter the operational address.").max(250, "Keep the address under 250 characters."),
  country: z.literal("Pakistan", "Country must be Pakistan."),
  province: z.enum(PROVINCES as [string, ...string[]], "Select a province."),
  city: z.string().trim().min(1, "Select a city."),
  officePhone: phone(7, "office phone number"),
  officeEmail: z.string().trim().toLowerCase().min(1, "Enter the office email.").email("Enter a valid office email."),
  officeWebsite: z.string().trim().max(120, "Keep the website under 120 characters.").refine((v) => {
    if (!v) return true;
    try { return new URL(normalizeWebsite(v)).hostname.includes("."); } catch { return false; }
  }, "Enter a valid website, for example www.example.com."),
};

const accountShape = {
  contactName: z.string().trim().min(2, "Enter your full name.").max(80, "Keep your name under 80 characters."),
  designation: z.enum(DESIGNATIONS as unknown as [string, ...string[]], "Select your designation."),
  email: z.string().trim().toLowerCase().min(1, "Enter your work email.").email("Enter a valid work email."),
  phone: phone(10, "mobile number"),
  password: z.string().min(8, "Use at least 8 characters.").regex(/[A-Za-z]/, "Include at least one letter.").regex(/\d/, "Include at least one number."),
  confirm: z.string().min(1, "Re-enter your password."),
};

const cityCheck = (d: { province?: string; city?: string }, ctx: z.RefinementCtx) => {
  if (d.province && d.city && !(GEO[d.province] ?? []).includes(d.city)) {
    ctx.addIssue({ code: "custom", path: ["city"], message: "Select a city from the list for this province." });
  }
};
const matchCheck = (d: { password?: string; confirm?: string }, ctx: z.RefinementCtx) => {
  if (d.password !== d.confirm) ctx.addIssue({ code: "custom", path: ["confirm"], message: "Passwords don't match." });
};

export const companySchema = z.object(companyShape).superRefine(cityCheck);
export const accountSchema = z.object(accountShape).superRefine(matchCheck);
export const signupSchema = z.object({ ...companyShape, ...accountShape }).superRefine((d, ctx) => { cityCheck(d, ctx); matchCheck(d, ctx); });

/** First message per field, ready to show beside the input. */
export function fieldErrors(issues: z.core.$ZodIssue[]) {
  const out: Record<string, string> = {};
  for (const i of issues) out[String(i.path[0])] ??= i.message;
  return out;
}
