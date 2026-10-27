import "server-only";
import { ObjectId } from "mongodb";
import { getDb } from "./mongodb";
import type { RegistrationStatus } from "./types";
import { docLabel } from "./signup-config";

export type RegFilter = "open" | "approved" | "rejected" | "all";
const OPEN: RegistrationStatus[] = ["pending", "under_review", "info_required"];

export interface RegListRow {
  id: string;
  kind: "head" | "branch";
  officeName: string;
  applicantName: string;
  applicantEmail: string;
  city: string;
  status: RegistrationStatus;
  submittedAt: string;
  documentsCount: number;
}

export interface RegDetail extends RegListRow {
  legalName: string | null;
  ntn: string | null;
  applicantPhone: string | null;
  parentName: string | null;
  officeType: string | null;
  salesTaxNumber: string | null;
  companyRegNumber: string | null;
  registeredAddress: string | null;
  operationalAddress: string | null;
  province: string | null;
  country: string | null;
  officePhone: string | null;
  officeEmail: string | null;
  officeWebsite: string | null;
  designation: string | null;
  documents: { id: string; docType: string; label: string; name: string; size: number }[];
  reviewedAt: string | null;
  reviewRemarks: string | null;
  history: { at: string; by: string; action: "approved" | "rejected" | "info_requested" | "edited" | "document_added" | "document_removed"; remarks: string | null }[];
}

export async function listRegistrations(filter: RegFilter) {
  const db = await getDb();
  const col = db.collection("registrations");
  const where =
    filter === "open" ? { status: { $in: OPEN } } : filter === "all" ? {} : { status: filter };

  const [rows, open, approved, rejected, all] = await Promise.all([
    col.find(where).sort({ submittedAt: filter === "open" ? 1 : -1 }).limit(100).toArray(),
    col.countDocuments({ status: { $in: OPEN } }),
    col.countDocuments({ status: "approved" }),
    col.countDocuments({ status: "rejected" }),
    col.countDocuments({}),
  ]);

  return {
    counts: { open, approved, rejected, all },
    rows: rows.map<RegListRow>((r) => ({
      id: r._id.toString(),
      kind: r.kind,
      officeName: r.officeName,
      applicantName: r.applicantName,
      applicantEmail: r.applicantEmail,
      city: r.city,
      status: r.status,
      submittedAt: new Date(r.submittedAt).toISOString(),
      documentsCount: r.documentsCount ?? 0,
    })),
  };
}

export async function getRegistrationDetail(id: string): Promise<RegDetail | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = await getDb();
  const r = await db.collection("registrations").findOne({ _id: new ObjectId(id) });
  if (!r) return null;
  const parent = r.parentId ? await db.collection("offices").findOne({ _id: r.parentId }) : null;
  return {
    id: r._id.toString(),
    kind: r.kind,
    officeName: r.officeName,
    applicantName: r.applicantName,
    applicantEmail: r.applicantEmail,
    applicantPhone: r.applicantPhone ?? null,
    legalName: r.legalName ?? null,
    ntn: r.ntn ?? null,
    city: r.city,
    status: r.status,
    documentsCount: r.documentsCount ?? 0,
    submittedAt: new Date(r.submittedAt).toISOString(),
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt).toISOString() : null,
    reviewRemarks: r.reviewRemarks ?? null,
    parentName: parent?.name ?? null,
    officeType: r.officeType ?? null,
    salesTaxNumber: r.salesTaxNumber ?? null,
    companyRegNumber: r.companyRegNumber ?? null,
    registeredAddress: r.registeredAddress ?? null,
    operationalAddress: r.operationalAddress ?? null,
    province: r.province ?? null,
    country: r.country ?? null,
    officePhone: r.officePhone ?? null,
    officeEmail: r.officeEmail ?? null,
    officeWebsite: r.officeWebsite ?? null,
    designation: r.designation ?? null,
    documents: (r.documents ?? []).map((d: { fileId: ObjectId; docType: string; name: string; size: number }) => ({ id: d.fileId.toString(), docType: d.docType, label: docLabel(d.docType), name: d.name, size: d.size })),
    history: (r.history ?? []).map((h: { at: Date; by: string; action: RegDetail["history"][number]["action"]; remarks?: string | null }) => ({
      at: new Date(h.at).toISOString(),
      by: h.by,
      action: h.action,
      remarks: h.remarks ?? null,
    })),
  };
}
