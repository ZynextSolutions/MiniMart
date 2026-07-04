import { redirect } from "next/navigation";
import Link from "next/link";
import { requirePlatformSession } from "@/platform/auth/platform-session";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";

export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let session;
  try {
    session = await requirePlatformSession();
  } catch {
    redirect("/platform-login");
  }

  return (
    <div className="flex min-h-screen">
      <PlatformSidebar
        className="hidden lg:flex"
        platformRole={session.user.platformRole}
      />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-between border-b px-4 lg:px-6">
          <div className="lg:hidden">
            <span className="font-semibold">Platform Admin</span>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            <Link href="/" className="hover:text-foreground">
              Organization app
            </Link>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
