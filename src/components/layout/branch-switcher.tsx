"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronsUpDown, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { switchBranchAction } from "@/features/auth/actions/switch-branch.action";

interface Branch {
  id: string;
  name: string;
  code: string;
  isDefault: boolean;
}

export function BranchSwitcher() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadBranches() {
      const res = await fetch("/api/v1/branches");
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    }
    if (session?.user) loadBranches();
  }, [session?.user]);

  const currentBranch = branches.find((b) => b.id === session?.user?.branchId);

  if (branches.length <= 1) return null;

  async function handleSwitch(branchId: string) {
    setLoading(true);
    try {
      const result = await switchBranchAction(branchId);
      if (result.success) {
        await update({ branchId, permissions: result.permissions });
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden h-8 gap-2 sm:flex"
          disabled={loading}
        >
          <Store className="h-3.5 w-3.5" />
          <span className="max-w-[120px] truncate">
            {currentBranch?.name ?? "Select branch"}
          </span>
          <ChevronsUpDown className="h-3.5 w-3.5 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {branches.map((branch) => (
          <DropdownMenuItem
            key={branch.id}
            onClick={() => handleSwitch(branch.id)}
            className="gap-2"
          >
            <Check
              className={cn(
                "h-4 w-4",
                session?.user?.branchId === branch.id
                  ? "opacity-100"
                  : "opacity-0",
              )}
            />
            <div className="flex flex-col">
              <span>{branch.name}</span>
              <span className="text-xs text-muted-foreground">{branch.code}</span>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
