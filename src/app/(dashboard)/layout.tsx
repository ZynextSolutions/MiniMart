import { auth } from "@/lib/auth/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { AppFooter } from "@/components/layout/app-footer";
import { AnnouncementBanners } from "@/components/layout/announcement-banners";
import { ModuleProvider } from "@/components/providers/module-provider";
import { ModuleAccessService } from "@/platform/modules/module-access.service";
import { isRouteAllowed } from "@/platform/modules/platform-modules";
import { defaultModuleMap } from "@/platform/modules/platform-modules";
import { SubscriptionGuardService } from "@/platform/subscriptions/subscription-guard.service";
import { AnnouncementService } from "@/platform/announcements/announcement.service";

const BILLING_PATH = "/settings/billing";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const organizationId = session?.user?.organizationId;
  const pathname = (await headers()).get("x-pathname") ?? "";

  if (
    organizationId &&
    session?.user?.sessionType === "organization" &&
    !pathname.startsWith(BILLING_PATH)
  ) {
    const org = await SubscriptionGuardService.getOrganizationStatus(organizationId);
    if (
      !org?.subscription ||
      !SubscriptionGuardService.isSubscriptionActive(
        org.subscription.status,
        org.subscription.trialEndsAt,
      )
    ) {
      redirect(BILLING_PATH);
    }
  }

  const modules = organizationId
    ? await ModuleAccessService.getEnabledModules(organizationId)
    : defaultModuleMap();

  if (
    organizationId &&
    session?.user?.sessionType === "organization" &&
    pathname &&
    !pathname.startsWith(BILLING_PATH) &&
    !isRouteAllowed(pathname, modules)
  ) {
    redirect(BILLING_PATH);
  }

  const announcements =
    organizationId && session?.user?.sessionType === "organization"
      ? await AnnouncementService.listActiveForOrganization(organizationId)
      : [];

  return (
    <ModuleProvider modules={modules}>
      <div className="flex min-h-screen">
        <AppSidebar
          organizationName={session?.user?.organizationName}
          className="hidden lg:flex"
        />
        <div className="flex flex-1 flex-col">
          <AppHeader />
          <AnnouncementBanners
            announcements={announcements.map((a) => ({
              id: a.id,
              title: a.title,
              message: a.message,
              type: a.type,
            }))}
          />
          <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
          <AppFooter />
        </div>
      </div>
    </ModuleProvider>
  );
}
