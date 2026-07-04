import { PlatformAdminService } from "@/platform/admin/platform-admin.service";
import { PlatformUsersManager } from "@/platform/admin/components/platform-users-manager";

export default async function PlatformUsersPage() {
  const users = await PlatformAdminService.listPlatformUsers();
  const serializedUsers = users.map((user) => ({
    ...user,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Platform Users</h1>
        <p className="text-muted-foreground">Super admin and support staff.</p>
      </div>
      <PlatformUsersManager users={serializedUsers} />
    </div>
  );
}
