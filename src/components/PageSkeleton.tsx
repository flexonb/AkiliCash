import { Skeleton } from "./ui/skeleton";

export function PageSkeleton() {
  return (
    <div className="p-6 md:p-10 space-y-8 max-w-5xl mx-auto w-full">
      <div className="space-y-4">
        <Skeleton className="h-8 w-[200px]" />
        <Skeleton className="h-4 w-[300px]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    </div>
  );
}
