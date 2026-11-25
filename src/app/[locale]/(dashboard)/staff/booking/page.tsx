import { Suspense } from "react";
import { BookingHubClient } from "@/components/bookings/booking-hub-client";
import { Skeleton } from "@/components/ui/skeleton";

function StaffBookingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 w-full rounded-[var(--radius-card)]" />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-[var(--radius-card)]" />
    </div>
  );
}

export default function StaffBookingPage() {
  return (
    <Suspense fallback={<StaffBookingSkeleton />}>
      <BookingHubClient variant="staff" />
    </Suspense>
  );
}
