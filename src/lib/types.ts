import type { ObjectId } from "mongodb";

export type OfficeType = "head" | "branch";
export type OfficeStatus = "pending" | "active" | "suspended" | "blocked" | "closed";
export type UserStatus = "active" | "suspended";
export type RegistrationStatus =
  | "pending"
  | "under_review"
  | "info_required"
  | "approved"
  | "rejected"
  | "cancelled";
export type SubscriptionStatus =
  | "not_subscribed"
  | "active"
  | "expiring_soon"
  | "expired"
  | "exempt"
  | "cancelled";
export type Scope = "system" | "head" | "branch";

/** Subscription dates only. Fees and payments are intentionally out of scope for this release. */
export interface OfficeSubscription {
  expiresAt?: Date | null;
  exemptFrom?: Date | null;
  exemptUntil?: Date | null;
  cancelled?: boolean;
}

export interface OfficeDoc {
  _id: ObjectId;
  code: string; // HO-000001 or BR-LHR-001
  name: string;
  legalName?: string;
  ntn?: string;
  salesTaxNumber?: string;
  companyRegNumber?: string;
  registeredAddress?: string;
  operationalAddress?: string;
  officePhone?: string;
  officeEmail?: string;
  website?: string;
  type: OfficeType;
  parentId?: ObjectId | null; // set for branches
  city: string;
  province?: string;
  country: string;
  status: OfficeStatus;
  subscription?: OfficeSubscription;
  createdAt: Date;
}

export interface UserDoc {
  _id: ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  status: UserStatus;
  officeId?: ObjectId | null; // null for the Super Administrator
  roleKeys: string[]; // a user may hold several roles (FR-USR-002)
  failedLogins?: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
}

export interface RoleDoc {
  _id: ObjectId;
  key: string;
  name: string;
  scope: Scope;
  permissions: string[];
}

export interface RegistrationDoc {
  _id: ObjectId;
  kind: OfficeType; // branch creation also goes through approval
  officeName: string;
  applicantName: string;
  applicantEmail: string;
  city: string;
  parentId?: ObjectId | null;
  documentsCount: number;
  status: RegistrationStatus;
  submittedAt: Date;
}

export interface AuditLogDoc {
  _id: ObjectId;
  userId?: ObjectId | null;
  userName: string;
  headOfficeId?: ObjectId | null; // tenant key for isolation
  officeId?: ObjectId | null;
  action: string; // e.g. "office.approve"
  summary: string;
  entity: string;
  entityId?: string;
  ip?: string;
  createdAt: Date;
}

export interface NotificationDoc {
  _id: ObjectId;
  userId: ObjectId;
  title: string;
  body: string;
  read: boolean;
  createdAt: Date;
}
