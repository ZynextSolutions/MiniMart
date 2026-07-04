import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function SuspendedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <CardTitle>Organization Suspended</CardTitle>
          <CardDescription>
            Your organization account has been suspended or cancelled. Please contact support or update billing to restore access.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/settings/billing">View billing</Link>
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/api/auth/signout?callbackUrl=/login">Sign out</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
