"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  acceptInviteAction,
  getInviteByTokenAction,
} from "@/platform/onboarding/onboarding.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  password: z.string().min(8),
});

type FormData = z.infer<typeof schema>;

export default function InvitePage({ token }: { token: string }) {
  const router = useRouter();
  const [invite, setInvite] = useState<{
    email: string;
    organizationName: string;
    organizationSlug: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", password: "" },
  });

  useEffect(() => {
    getInviteByTokenAction(token).then(setInvite);
  }, [token]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    const result = await acceptInviteAction({ token, ...data });
    if (!result.success || !result.organizationSlug) {
      setLoading(false);
      toast.error(result.error ?? "Failed to accept invite");
      return;
    }

    if (!invite) return;

    const login = await signIn("organization", {
      email: invite.email,
      password: data.password,
      organizationSlug: result.organizationSlug,
      redirect: false,
    });
    setLoading(false);

    if (login?.error) {
      toast.success("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    router.push("/");
    router.refresh();
  }

  if (!invite) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid invite</CardTitle>
            <CardDescription>This invitation link is invalid or has expired.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Join {invite.organizationName}</CardTitle>
          <CardDescription>
            Accept your invitation for {invite.email}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
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
                    <FormControl><Input type="password" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Accept invitation
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
