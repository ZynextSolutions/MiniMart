"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Store, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getAvailablePlansAction,
  signupAction,
} from "@/platform/onboarding/onboarding.actions";
import { slugify } from "@/platform/onboarding/slug";
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

const schema = z.object({
  organizationName: z.string().min(2),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z
    .string()
    .min(12, "Password must be at least 12 characters")
    .regex(/[a-z]/, "Must include a lowercase letter")
    .regex(/[A-Z]/, "Must include an uppercase letter")
    .regex(/[0-9]/, "Must include a number"),
  planSlug: z.string(),
});

type FormData = z.infer<typeof schema>;

type Plan = {
  slug: string;
  name: string;
  description: string | null;
  trialDays: number;
};

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<Plan[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      organizationName: "",
      slug: "",
      firstName: "",
      lastName: "",
      email: "",
      password: "",
      planSlug: "starter",
    },
  });

  useEffect(() => {
    getAvailablePlansAction().then(setPlans);
  }, []);

  const orgName = form.watch("organizationName");
  useEffect(() => {
    if (orgName && !form.getFieldState("slug").isDirty) {
      form.setValue("slug", slugify(orgName));
    }
  }, [orgName, form]);

  async function onSubmit(data: FormData) {
    setLoading(true);
    const result = await signupAction(data);
    if (!result.success) {
      setLoading(false);
      toast.error(result.error);
      return;
    }

    const login = await signIn("organization", {
      email: data.email,
      password: data.password,
      organizationSlug: result.slug,
      redirect: false,
    });
    setLoading(false);

    if (login?.error) {
      toast.success("Account created. Please sign in.");
      router.push("/login");
      return;
    }

    toast.success("Welcome! Your organization is ready.");
    router.push("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Store className="h-6 w-6" />
          </div>
          <CardTitle>Create your organization</CardTitle>
          <CardDescription>Start your 14-day free trial</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="organizationName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization URL slug</FormLabel>
                    <FormControl><Input {...field} placeholder="my-store" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl><Input type="email" {...field} /></FormControl>
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
              <FormField
                control={form.control}
                name="planSlug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Plan</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {plans.map((plan) => (
                          <SelectItem key={plan.slug} value={plan.slug}>
                            {plan.name} ({plan.trialDays}-day trial)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create organization
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
