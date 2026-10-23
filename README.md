# Carrier Hub

Login and role-based dashboards for the Car Carrier & Recovery Vehicle Management System.
Next.js 15 (App Router), TypeScript, Tailwind CSS, MongoDB.

## Run it

```bash
npm install
cp .env.example .env.local      # then paste your MONGODB_URI and set AUTH_SECRET
npm run seed                    # indexes, roles, and the Super Administrator
npm run seed:demo               # optional: sample offices, users, activity
npm run dev                     # http://localhost:3000
```

Generate a secret with `openssl rand -base64 32`.

Seeded logins (change the password in `.env.local` before seeding):

| Who | Email | Password |
| --- | --- | --- |
| Super Administrator | `SEED_ADMIN_EMAIL` | `SEED_ADMIN_PASSWORD` |
| Head Office admin (demo) | sana@abccarriers.test | Demo@12345 |
| Branch manager (demo) | ali@abccarriers.test | Demo@12345 |

## What is included

- Login with server-side validation, lockout after 5 failed attempts (15 min), httpOnly session cookie.
- Three dashboards chosen by the user's office: Super Administrator, Head Office, Branch.
- Access decision from user status + office status + subscription status + exemption (SRS 13, 47).
  Suspended or blocked users and offices are denied on the next request; an expired subscription only restricts.
- Audit log written on sign-in; notifications bell; Ctrl/Cmd+K command palette; light and dark theme; collapsible sidebar.

## Left out on purpose

Subscription fees, payments, receipts and payment reports (FR-SUB-003/004). Only subscription *status*
(active, expiring, expired, exempt) is shown. Sidebar items marked "Soon" are the next modules.

## Structure

```
src/lib/          mongodb, session, auth, access rules, dashboard queries
src/app/login     sign-in page + server action
src/app/(app)     protected layout + /dashboard
src/components/   shell (sidebar, top bar, palette) and dashboard widgets
scripts/seed.ts   seed script
```

## Security notes

- Dashboard data scope comes from the signed-in user's office on the server, never from the URL.
- Audit rows carry `headOfficeId` so every query is tenant-scoped.
- Add `MONGODB_URI` as an environment variable on your host; never commit `.env.local`.
