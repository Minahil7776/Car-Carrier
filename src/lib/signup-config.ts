/**
 * Signup configuration. Everything the client may want to change without touching logic lives here.
 * Values marked CONFIRM are not defined in the SRS and need the client's sign-off.
 */

// Public signup creates a Head Office only (SRS FR-ORG-002). Add "branch" here if that ever changes.
export const OFFICE_TYPES = [{ value: "head", label: "Head Office" }] as const;

// CONFIRM: the SRS asks for the contact person's designation but does not list the options.
export const DESIGNATIONS = [
  "Owner / Proprietor",
  "Partner",
  "Director",
  "Chief Executive Officer",
  "General Manager",
  "Operations Manager",
  "Administrator",
  "Authorized Representative",
  "Other",
] as const;

// CONFIRM: SRS FR-ORG-003 lists example document types and says the list must be configurable.
// Move this to a database collection when the Super Administrator needs to edit it in the UI.
export interface DocumentType {
  key: string;
  label: string;
  hint?: string;
  required: boolean;
}
export const DOCUMENT_TYPES: DocumentType[] = [
  { key: "ntn_certificate", label: "NTN certificate", required: false },
  { key: "strn_certificate", label: "STRN certificate", hint: "If you are sales tax registered", required: false },
  { key: "secp_certificate", label: "SECP / company registration certificate", hint: "If your company is incorporated", required: false },
  { key: "business_license", label: "Business registration or license", required: false },
  { key: "address_proof", label: "Office address proof", required: false },
  { key: "authorized_cnic", label: "Authorized person's CNIC", required: false },
  { key: "authorization_letter", label: "Letter of authorization", required: false },
  { key: "other", label: "Other supporting document", required: false },
];

// The SRS says the applicant "shall be required to upload documents" without naming which ones.
// Until the client confirms mandatory types, at least this many documents (of any type) are required.
export const MIN_DOCUMENTS = 1;

// CONFIRM: limits are not defined in the SRS. 4 MB stays under the 4.5 MB request cap of serverless hosts.
export const UPLOAD_LIMITS = {
  maxFileBytes: 4 * 1024 * 1024,
  accept: ".pdf,.jpg,.jpeg,.png",
  label: "PDF, JPG or PNG",
  // Draft uploads that are never submitted are deleted automatically after this long.
  draftHours: 24,
};

export const docLabel = (key: string) => DOCUMENT_TYPES.find((d) => d.key === key)?.label ?? key;
