"use client";

import { useState } from "react";
import { OFFICE_TYPES } from "@/lib/signup-config";
import { GEO, PROVINCES } from "@/lib/pakistan-geo";
import { Field, SelectBox, inputProps } from "@/components/ui/form-field";

type Defaults = Record<string, string | null | undefined>;

/** The company details block, shared by the public signup form and the administrator's edit form. */
export function CompanyFields({ errors, defaults = {} }: { errors: Record<string, string>; defaults?: Defaults }) {
  const startProvince = defaults.province && GEO[defaults.province] ? defaults.province : "";
  const [province, setProvince] = useState(startProvince);
  const [city, setCity] = useState(startProvince && GEO[startProvince].includes(defaults.city ?? "") ? (defaults.city as string) : "");
  const p = (k: string) => inputProps(errors, k);
  const d = (k: string) => defaults[k] ?? undefined;

  return (
    <div className="space-y-4">
      <Field id="officeName" label="Head office name" error={errors.officeName}>
        <input {...p("officeName")} defaultValue={d("officeName")} autoComplete="organization" placeholder="ABC Car Carriers" />
      </Field>
      <Field id="legalName" label="Registered legal name" optional error={errors.legalName}>
        <input {...p("legalName")} defaultValue={d("legalName")} placeholder="ABC Car Carriers (Pvt) Ltd" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="officeType" label="Office type" error={errors.officeType}>
          <SelectBox name="officeType" errors={errors} options={OFFICE_TYPES} defaultValue={d("officeType") ?? OFFICE_TYPES[0].value} />
        </Field>
        <Field id="ntn" label="NTN" error={errors.ntn}><input {...p("ntn")} defaultValue={d("ntn")} inputMode="numeric" placeholder="1234567-8" /></Field>
        <Field id="salesTaxNumber" label="Sales tax number" optional error={errors.salesTaxNumber}><input {...p("salesTaxNumber")} defaultValue={d("salesTaxNumber")} /></Field>
        <Field id="companyRegNumber" label="Company registration number" optional error={errors.companyRegNumber}><input {...p("companyRegNumber")} defaultValue={d("companyRegNumber")} /></Field>
      </div>
      <Field id="registeredAddress" label="Registered address" error={errors.registeredAddress}>
        <input {...p("registeredAddress")} defaultValue={d("registeredAddress")} autoComplete="street-address" placeholder="Street, area" />
      </Field>
      <Field id="operationalAddress" label="Operational address" error={errors.operationalAddress}>
        <input {...p("operationalAddress")} defaultValue={d("operationalAddress")} placeholder="Where your operations run from" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="country" label="Country"><input {...p("country")} value="Pakistan" readOnly className="input cursor-not-allowed bg-raised text-muted" /></Field>
        <Field id="province" label="Province" error={errors.province}>
          <SelectBox name="province" errors={errors} options={PROVINCES} placeholder="Select" value={province} onChange={(e) => { setProvince(e.target.value); setCity(""); }} />
        </Field>
        <Field id="city" label="City" error={errors.city}>
          <SelectBox name="city" errors={errors} options={GEO[province] ?? []} placeholder="Select" value={city} disabled={!province} onChange={(e) => setCity(e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="officePhone" label="Office phone number" error={errors.officePhone}><input {...p("officePhone")} defaultValue={d("officePhone")} type="tel" autoComplete="tel" placeholder="042 35123456" /></Field>
        <Field id="officeEmail" label="Office email" error={errors.officeEmail}><input {...p("officeEmail")} defaultValue={d("officeEmail")} type="email" placeholder="info@company.com" /></Field>
      </div>
      <Field id="officeWebsite" label="Office website" optional error={errors.officeWebsite}><input {...p("officeWebsite")} defaultValue={d("officeWebsite")} inputMode="url" placeholder="www.company.com" /></Field>
    </div>
  );
}
