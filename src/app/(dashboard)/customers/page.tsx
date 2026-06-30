import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { CustomerService } from "@/features/customers/services/customer.service";
import { CustomersPageClient } from "@/features/customers/components/customers-page-client";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.CUSTOMERS.VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const search = params.search;

  const result = await CustomerService.list(session.user.organizationId, {
    page,
    search,
  });

  const initialCustomers = result.customers.map((customer) => ({
    id: customer.id,
    code: customer.code,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
    membershipTier: customer.membershipTier,
    creditLimit: customer.creditLimit.toString(),
    isActive: customer.isActive,
  }));

  return (
    <CustomersPageClient
      initialCustomers={initialCustomers}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      initialSearch={search ?? ""}
    />
  );
}
