import { Skeleton } from "@/components/ui/skeleton";

export default function ChatLoading() {
  return (
    <div className="h-screen bg-slate-100 p-4 md:flex">
      <aside className="hidden w-[300px] min-w-[300px] border-r border-slate-200 bg-white p-3 md:block">
        <Skeleton className="mb-3 h-10 w-full" />
        <Skeleton className="mb-3 h-10 w-full" />
        <Skeleton className="mb-2 h-4 w-24" />
        <Skeleton className="mb-2 h-12 w-full" />
        <Skeleton className="mb-2 h-12 w-full" />
      </aside>
      <main className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
      </main>
    </div>
  );
}
