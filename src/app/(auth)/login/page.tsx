import { Suspense } from "react";
import LoginPage from "./login-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense
      fallback={
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="mx-auto h-12 w-12 rounded-xl" />
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-64 w-full" />
        </div>
      }
    >
      <LoginPage />
    </Suspense>
  );
}
