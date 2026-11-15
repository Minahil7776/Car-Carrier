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

export interface OfficeSubscription {
  expiresAt?: Date | null;
  exemptFrom?: Date | null;
  exemptUntil?: Date | null;
  exemptionId?: ObjectId;
  inheritExemption?: boolean;
  planId?: ObjectId;
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
  // Branch fields (FR-BR-001)
  branchCode?: string; // the short, configurable part of the identifier, e.g. LHR in BR-LHR-001
  managerName?: string;
  managerEmail?: string;
  managerPhone?: string;
  openingDate?: Date;
  notes?: string;
  // Head office primary contact (FR-ORG-001)
  contactName?: string;
  contactDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Latest administrative status change (full trail lives in office_status_history)
  statusReason?: string | null;
  statusChangedAt?: Date | null;
  createdById?: ObjectId | null;
  updatedAt?: Date;
  createdAt: Date;
}

/** One row per administrative status change (SRS FR-ORG-007: previous status, new status, who, when, why). */
export interface OfficeStatusHistoryDoc {
  _id: ObjectId;
  officeId: ObjectId;
  headOfficeId: ObjectId; // tenant key
  from: OfficeStatus | null;
  to: OfficeStatus;
  reason: string;
  byId: ObjectId | null;
  byName: string;
  at: Date;
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
  description?: string;
  status?: "active" | "inactive";
  isCustom?: boolean;
  headOfficeId?: ObjectId;
  createdById?: ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
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

export type FleetVehicleType = "car_carrier" | "recovery_vehicle" | "other";
export type FleetOfficeStatus = "active" | "inactive" | "retired";
export type FleetOperationalStatus = "available" | "assigned" | "on_trip" | "maintenance" | "out_of_service";

export interface FleetAllocationDoc {
  officeId: ObjectId;
  allocatedAt: Date;
  endedAt?: Date;
  reason: string;
  byId: ObjectId;
  byName: string;
}

export interface FleetStatusChangeDoc {
  administrativeStatus: FleetOfficeStatus;
  operationalStatus: FleetOperationalStatus;
  effectiveAt: Date;
  reason?: string;
  byId: ObjectId;
  byName: string;
}

export interface FleetVehicleDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  controllingOfficeId: ObjectId;
  assignedOfficeId: ObjectId;
  vehicleType: FleetVehicleType;
  ownershipClassification: "company_owned";
  fleetId: string;
  registrationNumber: string;
  make: string;
  model: string;
  modelYear?: number;
  chassisNumber?: string;
  engineNumber?: string;
  acquisitionDate?: Date;
  capacity?: string;
  administrativeStatus: FleetOfficeStatus;
  operationalStatus: FleetOperationalStatus;
  remarks?: string;
  retirementReason?: string;
  allocations: FleetAllocationDoc[];
  statusHistory: FleetStatusChangeDoc[];
  createdById: ObjectId;
  updatedById: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export type FleetDocumentCategory = "registration" | "insurance" | "fitness" | "route_permit" | "other";

export interface FleetVehicleDocumentDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  vehicleId: ObjectId;
  category: FleetDocumentCategory;
  verificationStatus: "pending" | "verified" | "rejected";
  documentNumber?: string;
  issuingAuthority?: string;
  issueDate?: Date;
  effectiveDate?: Date;
  expiryDate?: Date;
  jurisdiction?: string;
  remarks?: string;
  fileId: ObjectId;
  fileName: string;
  mime: string;
  size: number;
  supersedesId?: ObjectId;
  current: boolean;
  uploadedById: ObjectId;
  uploadedAt: Date;
}

export interface FleetFileDoc {
  _id: ObjectId;
  tenantId: ObjectId;
  vehicleId: ObjectId;
  mime: string;
  name: string;
  size: number;
  data: import("mongodb").Binary;
  uploadedAt: Date;
}
