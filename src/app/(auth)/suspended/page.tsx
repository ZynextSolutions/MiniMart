import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const PLATFORM_SUPPORT_EMAIL =
  process.env.PLATFORM_SUPPORT_EMAIL ?? "superadmin@platform.com";

export default function SuspendedPage() {
  const mailto = `mailto:${PLATFORM_SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "Organization access restoration",
  )}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Organization Suspended</CardTitle>
          <CardDescription>
            Your organization account has been suspended or cancelled. You can
            review billing details or contact support to restore access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/settings/billing">View billing</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <a href={mailto}>Contact support</a>
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/api/auth/signout?callbackUrl=/login">Sign out</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
