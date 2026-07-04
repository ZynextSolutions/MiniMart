import { Suspense } from "react";
import InvitePage from "./invite-page";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full max-w-md" />}>
      <InvitePageWrapper params={params} />
    </Suspense>
  );
}

async function InvitePageWrapper({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitePage token={token} />;
}
