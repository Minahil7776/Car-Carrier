import { LockKeyhole } from "lucide-react";
import { logout } from "@/app/actions";
import { Logo } from "@/components/ui/logo";

export function AccessBlocked({ reason }: { reason?: string }) {
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md text-center">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card p-8">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-bad-soft text-bad"><LockKeyhole className="size-5" aria-hidden /></span>
          <h1 className="mt-4 text-xl font-semibold">Access is turned off</h1>
          <p className="mt-2 text-sm text-muted">{reason ?? "Your access has been restricted."}</p>
          <form action={logout} className="mt-6"><button className="btn-outline w-full">Sign out</button></form>
        </div>
      </div>
    </main>
  );
}
