import { Suspense } from "react";
import PlatformLoginPage from "./platform-login-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
      <PlatformLoginPage />
    </Suspense>
  );
}
