import { auth } from "@/lib/auth/auth";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/permissions/authorization";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { SupplierService } from "@/features/suppliers/services/supplier.service";
import { SuppliersPageClient } from "@/features/suppliers/components/suppliers-page-client";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; page?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  await authorize(session.user.id, PERMISSIONS.SUPPLIERS.VIEW);

  const params = await searchParams;
  const page = parseInt(params.page ?? "1", 10);
  const search = params.search;

  const result = await SupplierService.list(session.user.organizationId, {
    page,
    search,
  });

  const initialSuppliers = result.suppliers.map((supplier) => ({
    id: supplier.id,
    code: supplier.code,
    name: supplier.name,
    contactPerson: supplier.contactPerson,
    email: supplier.email,
    phone: supplier.phone,
    address: supplier.address,
    taxId: supplier.taxId,
    paymentTerms: supplier.paymentTerms,
    creditLimit: supplier.creditLimit.toString(),
    isActive: supplier.isActive,
  }));

  return (
    <SuppliersPageClient
      initialSuppliers={initialSuppliers}
      total={result.total}
      page={result.page}
      totalPages={result.totalPages}
      initialSearch={search ?? ""}
    />
  );
}
