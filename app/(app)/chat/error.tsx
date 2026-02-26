"use client";

import { Button } from "@/components/ui/button";

export default function ChatError({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-6">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="mb-4 text-sm text-slate-600">{error.message}</p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
