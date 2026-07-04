import { Suspense } from "react";
import SignupPage from "./signup-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-lg space-y-4">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <SignupPage />
    </Suspense>
  );
}
