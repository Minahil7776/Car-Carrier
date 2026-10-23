import type { Metadata } from "next";
import { ShieldCheck, GitBranch, ScrollText } from "lucide-react";
import { LoginForm } from "@/components/login-form";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Logo } from "@/components/ui/logo";
import { CarrierScene } from "@/components/ui/carrier-scene";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-rail text-white lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "44px 44px" }}
        />
        <Logo light />

        <div className="relative max-w-md">
          <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight">
            Every vehicle, from loading bay to showroom.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/65">
            One place for head offices, branches and recovery teams to see what is moving and who is responsible.
          </p>
          <ul className="mt-8 space-y-3.5 text-sm text-white/80">
            {[
              [GitBranch, "Head office sees every branch; branches see their own work"],
              [ShieldCheck, "Access follows each person's role and office"],
              [ScrollText, "Important actions are recorded in an audit trail"],
            ].map(([Icon, text], i) => {
              const I = Icon as typeof GitBranch;
              return (
                <li key={i} className="flex items-center gap-3">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/10"><I className="size-4 text-beacon" aria-hidden /></span>
                  {text as string}
                </li>
              );
            })}
          </ul>
        </div>

        <CarrierScene />
      </section>

      {/* Form panel */}
      <section className="relative flex flex-col">
        <div className="flex items-center justify-between p-5 sm:p-8">
          <div className="lg:invisible"><Logo /></div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center px-5 pb-16 sm:px-8">
          <div className="w-full max-w-[400px] animate-rise">
            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mb-8 mt-1.5 text-sm text-muted">Use your work email to open your dashboard.</p>
            <LoginForm next={next} />
            <p className="mt-8 text-center text-sm text-muted">
              Can&apos;t sign in? Ask your head office administrator to reset your access.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
