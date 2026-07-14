"use client";

import Link from "next/link";
import { Menu } from "lucide-react";
import { useMounted } from "@/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { PlatformSidebar } from "./platform-sidebar";

export function PlatformHeader({ platformRole }: { platformRole?: string }) {
  const mounted = useMounted();

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4 lg:px-6">
      {mounted ? (
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <PlatformSidebar platformRole={platformRole} collapsible={false} />
          </SheetContent>
        </Sheet>
      ) : (
        <Button variant="ghost" size="icon" className="lg:hidden" aria-hidden>
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
      )}

      <div className="lg:hidden">
        <span className="font-semibold">Platform Admin</span>
      </div>

      <div className="ml-auto text-sm text-muted-foreground">
        <Link href="/" className="hover:text-foreground">
          Organization app
        </Link>
      </div>
    </header>
  );
}
