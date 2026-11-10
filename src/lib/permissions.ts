export const PERMISSION_GROUPS = [
  { label: "Dashboard", permissions: [{ key: "dashboard.view", label: "View dashboard" }] },
  {
    label: "Organizations and branches",
    permissions: [
      { key: "office.view", label: "View offices" },
      { key: "office.create", label: "Create offices" },
      { key: "office.update", label: "Update offices" },
      { key: "office.suspend", label: "Suspend offices" },
      { key: "branch.view", label: "View branches" },
      { key: "branch.create", label: "Create branches" },
      { key: "branch.update", label: "Update branches" },
    ],
  },
  {
    label: "Users and roles",
    permissions: [
      { key: "user.view", label: "View users" },
      { key: "user.create", label: "Create users" },
      { key: "user.update", label: "Update users and role assignments" },
      { key: "user.suspend", label: "Suspend and reactivate users" },
      { key: "role.view", label: "View roles" },
      { key: "role.create", label: "Create custom roles" },
      { key: "role.update", label: "Update custom roles" },
    ],
  },
  {
    label: "Recovery operations",
    permissions: [
      { key: "vehicle.view", label: "View recovery vehicles" },
      { key: "vehicle.create", label: "Create recovery vehicles" },
      { key: "vehicle.update", label: "Update recovery vehicles" },
      { key: "booking.view", label: "View bookings" },
      { key: "booking.create", label: "Create bookings" },
      { key: "booking.assign", label: "Assign recovery vehicles" },
      { key: "driver.view", label: "View driver information" },
    ],
  },
  {
    label: "Advances and expenses",
    permissions: [
      { key: "advance.view", label: "View advances" },
      { key: "advance.create", label: "Create advance requests" },
      { key: "expense.view", label: "View expenses" },
      { key: "expense.create", label: "Create expense settlements" },
      { key: "expense.approve", label: "Approve advances and expenses" },
    ],
  },
  {
    label: "Subscriptions and reporting",
    permissions: [
      { key: "subscription.view", label: "View subscription status" },
      { key: "subscription.create", label: "Create subscriptions" },
      { key: "subscription.update", label: "Update subscriptions" },
      { key: "subscription.exempt", label: "Grant subscription exemptions" },
      { key: "subscription.extend", label: "Extend subscriptions" },
      { key: "subscription.cancel", label: "Cancel subscriptions" },
      { key: "subscription_payment.view", label: "View subscription payments" },
      { key: "subscription_payment.create", label: "Record subscription payments" },
      { key: "subscription_payment.update", label: "Update subscription payments" },
      { key: "subscription_payment.verify", label: "Verify subscription payments" },
      { key: "subscription_report.view", label: "View subscription reports" },
      { key: "subscription_report.export", label: "Export subscription reports" },
      { key: "audit.view", label: "View audit logs" },
    ],
  },
] as const;

export const PERMISSION_KEYS = new Set<string>(
  PERMISSION_GROUPS.flatMap((group) => group.permissions.map((permission) => permission.key)),
);
