import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "@/components/signup-form";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { CarrierScene } from "@/components/ui/carrier-scene";
import { createDraftToken } from "@/lib/signup-draft";
import { getRegistrationDocumentTypes } from "@/lib/registration-documents";

export const metadata: Metadata = { title: "Register your company" };
export const dynamic = "force-dynamic"; // a fresh upload token per visit

const steps = [
  ["Send your details", "Tell us about your company, who will administer it, and upload your documents."],
  ["We review the request", "The system administrator checks your details and may ask for documents."],
  ["Sign in and add branches", "Once approved you become the head office administrator."],
];

export default async function SignupPage() {
  const [uploadToken, documentTypes] = await Promise.all([createDraftToken(), getRegistrationDocumentTypes()]);
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.05fr]">
      <section className="relative hidden overflow-hidden bg-rail text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }} />
        <Logo light />
        <div className="relative max-w-md">
          <h1 className="text-[2.25rem] font-semibold leading-[1.12] tracking-tight">Register your company on Carrier Hub.</h1>
          <ol className="mt-9 space-y-6">
            {steps.map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-beacon text-sm font-semibold text-rail">{i + 1}</span>
                <div><p className="font-medium">{t}</p><p className="mt-0.5 text-sm leading-relaxed text-white/65">{d}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <CarrierScene />
      </section>

      <section className="relative flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-8">
          <div className="lg:invisible"><Logo /></div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
          <div className="w-full max-w-[560px] animate-rise">
            <h2 className="text-2xl font-semibold tracking-tight">Create your company account</h2>
            <p className="mb-8 mt-1.5 text-sm text-muted">Your request is reviewed before the account goes live.</p>
            <SignupForm uploadToken={uploadToken} documentTypes={documentTypes} />
            <p className="mt-8 text-center text-sm text-muted">
              Already registered? <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
