"use client";

import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string; code?: string };
  reset: () => void;
}) {
  const isSubscriptionInactive =
    error.message === "SUBSCRIPTION_INACTIVE" ||
    error.name === "SubscriptionInactiveError" ||
    error.code === "SUBSCRIPTION_INACTIVE";

  if (isSubscriptionInactive) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
        <div
          role="alert"
          className="w-full max-w-lg rounded-lg border border-amber-500/60 bg-amber-50 p-6 dark:bg-amber-950/30"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-3 text-left">
              <div>
                <h2 className="font-semibold text-amber-900 dark:text-amber-100">
                  Subscription inactive
                </h2>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
                  Your subscription is past due, cancelled, or expired. Contact the
                  platform administrator or subscribe to a plan to restore access.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <Link href="/settings/billing">View billing &amp; plans</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href="mailto:superadmin@platform.com?subject=Subscription%20help">
                    <Mail className="mr-2 h-4 w-4" />
                    Contact administrator
                  </a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[400px] flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-center text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. Please try again.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
