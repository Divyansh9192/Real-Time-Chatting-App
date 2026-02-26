import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top_right,_#e0f2fe,_#f8fafc_40%,_#f1f5f9)] px-4">
      <section className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white/80 p-8 shadow-xl backdrop-blur">
        <div className="mb-6 flex items-center gap-3">
          <div className="rounded-xl bg-sky-600 p-3">
            <MessageCircle className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Real-Time Messaging</h1>
            <p className="text-sm text-slate-600">
              Next.js + Convex + Clerk + Tailwind + shadcn/ui
            </p>
          </div>
        </div>

        <p className="mb-8 text-slate-700">
          Secure real-time direct messages and groups with typing indicators,
          unread counts, reactions, and presence.
        </p>

        <div className="flex flex-wrap gap-3">
          <SignedOut>
            <SignInButton mode="modal">
              <Button>Sign in</Button>
            </SignInButton>
            <SignUpButton mode="modal">
              <Button variant="outline">Create account</Button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <Link href="/chat">
              <Button>Open chat</Button>
            </Link>
          </SignedIn>
        </div>
      </section>
    </main>
  );
}
