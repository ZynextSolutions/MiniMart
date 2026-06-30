"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/feedback/confirm-dialog";
import { CustomerFormDialog } from "./customer-form-dialog";
import { deleteCustomerAction } from "@/features/customers/actions/customer.actions";
import { formatMoney } from "@/lib/utils/format";

interface CustomerRow {
  id: string;
  code: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  membershipTier: string | null;
  creditLimit: string;
  isActive: boolean;
}

interface CustomersPageClientProps {
  initialCustomers: CustomerRow[];
  total: number;
  page: number;
  totalPages: number;
  initialSearch: string;
}

export function CustomersPageClient({
  initialCustomers,
  total,
  page,
  totalPages,
  initialSearch,
}: CustomersPageClientProps) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [formOpen, setFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<CustomerRow | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    router.push(`/customers?${params.toString()}`);
  }

  function buildPageUrl(nextPage: number) {
    const params = new URLSearchParams();
    if (initialSearch) params.set("search", initialSearch);
    params.set("page", String(nextPage));
    return `/customers?${params.toString()}`;
  }

  async function handleDelete() {
    if (!deleteId) return;
    const result = await deleteCustomerAction(deleteId);
    if (result.success) {
      toast.success("Customer deleted");
      router.refresh();
    } else {
      toast.error(result.error);
    }
    setDeleteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">{total} customers total</p>
        </div>
        <Button onClick={() => { setEditingCustomer(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Customer
        </Button>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by name, code, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Membership Tier</TableHead>
              <TableHead>Credit Limit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[70px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              initialCustomers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell className="font-mono text-sm">{customer.code}</TableCell>
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone ?? "—"}</TableCell>
                  <TableCell>{customer.email ?? "—"}</TableCell>
                  <TableCell>{customer.membershipTier ?? "—"}</TableCell>
                  <TableCell>{formatMoney(customer.creditLimit)}</TableCell>
                  <TableCell>
                    <Badge variant={customer.isActive ? "default" : "secondary"}>
                      {customer.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingCustomer(customer);
                            setFormOpen(true);
                          }}
                        >
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(customer.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => router.push(buildPageUrl(page - 1))}
          >
            Previous
          </Button>
          <span className="flex items-center text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => router.push(buildPageUrl(page + 1))}
          >
            Next
          </Button>
        </div>
      )}

      <CustomerFormDialog
        key={editingCustomer?.id ?? "new-customer"}
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
        onSuccess={() => router.refresh()}
      />

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete customer"
        description="This customer will be removed from the system."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
