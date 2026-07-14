import { redirect } from "next/navigation";
import { requirePlatformSession } from "@/platform/auth/platform-session";
import { PlatformSidebar } from "@/components/layout/platform-sidebar";
import { PlatformHeader } from "@/components/layout/platform-header";
import { AppFooter } from "@/components/layout/app-footer";

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
        <PlatformHeader platformRole={session.user.platformRole} />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
        <AppFooter />
      </div>
    </div>
  );
}
