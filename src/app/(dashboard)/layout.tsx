import { auth } from "@/lib/auth/auth";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <div className="flex min-h-screen">
      <AppSidebar
        organizationName={session?.user?.organizationName}
        className="hidden lg:flex"
      />
      <div className="flex flex-1 flex-col">
        <AppHeader />
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
