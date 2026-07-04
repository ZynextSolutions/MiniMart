"use client";

import { useState } from "react";
import Link from "next/link";
import { getSession, signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Store, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { resolveLandingPath } from "@/lib/auth/landing-path";
import { normalizeOrgCallbackUrl } from "@/lib/auth/safe-redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  organizationSlug: z.string().optional(),
});

type LoginForm = z.infer<typeof loginSchema>;

type OrgOption = { id: string; name: string; slug: string };

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const [isLoading, setIsLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [needsOrgSelection, setNeedsOrgSelection] = useState(false);

  function normalizeCallbackUrl(url: string) {
    return normalizeOrgCallbackUrl(url, window.location.origin);
  }

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", organizationSlug: "" },
  });

  async function performLogin(data: LoginForm) {
    const safeCallbackUrl = normalizeCallbackUrl(callbackUrl);
    const result = await signIn("organization", {
      email: data.email,
      password: data.password,
      organizationSlug: data.organizationSlug || undefined,
      redirect: false,
    });

    if (result?.error) {
      toast.error("Invalid email or password");
      return;
    }

    const session = await getSession();
    const destination =
      resolveLandingPath(session?.user?.permissions, safeCallbackUrl) ?? "/pos";
    router.push(destination);
    router.refresh();
  }

  async function onSubmit(data: LoginForm) {
    setIsLoading(true);
    try {
      if (!needsOrgSelection && !data.organizationSlug) {
        const res = await fetch(
          `/api/v1/auth/organizations?email=${encodeURIComponent(data.email)}`,
        );
        const json = await res.json();
        if (json.requiresSelection) {
          setOrgOptions(json.organizations);
          setNeedsOrgSelection(true);
          setIsLoading(false);
          return;
        }
        if (json.organizations?.length === 1) {
          data.organizationSlug = json.organizations[0].slug;
        }
      }

      await performLogin(data);
    } catch {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Store className="h-6 w-6" />
        </div>
        <CardTitle className="text-2xl">POS Platform</CardTitle>
        <CardDescription>Sign in to your organization</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" autoComplete="email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" autoComplete="current-password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {needsOrgSelection && (
              <FormField
                control={form.control}
                name="organizationSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select your organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {orgOptions.map((org) => (
                          <SelectItem key={org.id} value={org.slug}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>
        </Form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          No account?{" "}
          <Link href="/signup" className="text-primary hover:underline">
            Create organization
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
