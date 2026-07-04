"use client";

import { AlertTriangle, Mail } from "lucide-react";
import { formatMoney } from "@/lib/utils/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { PlanLimits } from "@/platform/subscriptions/plan-limits.types";
import type { PlatformModuleKey } from "@/platform/modules/platform-modules";
import { PLATFORM_MODULES } from "@/platform/modules/platform-modules";

type PlanOption = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: string;
  currency: string;
  billingInterval: string;
  trialDays: number;
};

type Props = {
  subscriptionIsActive: boolean;
  supportEmail: string;
  availablePlans: PlanOption[];
  subscription: {
    status: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    plan: {
      name: string;
      slug: string;
      price: string;
      currency?: string;
      billingInterval: string;
      limits: PlanLimits | Record<string, unknown>;
      features: string[] | unknown;
      modules?: string[];
    };
  };
  enabledModuleKeys?: PlatformModuleKey[];
  usage: {
    limits: PlanLimits;
    usage: {
      branches: number;
      users: number;
      products: number;
      warehouses: number;
    };
  };
};

function UsageBar({
  label,
  used,
  max,
}: {
  label: string;
  used: number;
  max?: number;
}) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">
          {used} / {max ?? "∞"}
        </span>
      </div>
      {max ? <Progress value={pct} /> : null}
    </div>
  );
}

function subscriptionAlertMessage(status: string): string {
  switch (status) {
    case "PAST_DUE":
      return "Your payment is overdue and full platform access is limited. Please contact the platform administrator or subscribe to a plan below to restore access.";
    case "CANCELLED":
      return "Your subscription has been cancelled. Contact the platform administrator or choose a plan below to reactivate your organization.";
    case "TRIAL":
      return "Your free trial has ended. Subscribe to a plan below or contact the platform administrator to continue using the platform.";
    default:
      return "Your subscription is not active. Contact the platform administrator or subscribe to a plan below to restore access.";
  }
}

export function BillingClient({
  subscription,
  usage,
  enabledModuleKeys = [],
  subscriptionIsActive,
  supportEmail,
  availablePlans,
}: Props) {
  const { plan } = subscription;
  const limits = (usage.limits ?? {}) as PlanLimits;
  const moduleLabels = enabledModuleKeys.length
    ? PLATFORM_MODULES.filter((m) => enabledModuleKeys.includes(m.key)).map((m) => m.label)
    : (plan.modules ?? []);

  const otherPlans = availablePlans.filter((p) => p.slug !== plan.slug);
  const mailtoSubject = encodeURIComponent(
    `Subscription help — ${subscription.status} (${plan.name})`,
  );
  const mailtoBody = encodeURIComponent(
    `Hello,\n\nOur organization needs help with our subscription.\n\nCurrent status: ${subscription.status}\nCurrent plan: ${plan.name}\n\nPlease advise on payment or plan renewal.\n\nThank you.`,
  );
  const contactHref = `mailto:${supportEmail}?subject=${mailtoSubject}&body=${mailtoBody}`;

  return (
    <div className="space-y-4">
      {!subscriptionIsActive && (
        <div
          role="alert"
          className="rounded-lg border border-amber-500/60 bg-amber-50 p-4 dark:bg-amber-950/30"
        >
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-3">
              <div>
                <p className="font-semibold text-amber-900 dark:text-amber-100">
                  Subscription inactive — {subscription.status.replace("_", " ")}
                </p>
                <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
                  {subscriptionAlertMessage(subscription.status)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" asChild>
                  <a href={contactHref}>
                    <Mail className="mr-2 h-4 w-4" />
                    Contact administrator
                  </a>
                </Button>
                {otherPlans.length > 0 && (
                  <Button size="sm" variant="outline" asChild>
                    <a href="#available-plans">View plans to subscribe</a>
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Support:{" "}
                <a href={contactHref} className="underline hover:text-foreground">
                  {supportEmail}
                </a>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              Current Plan
              <Badge variant={subscriptionIsActive ? "default" : "destructive"}>
                {subscription.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-2xl font-bold">{plan.name}</div>
            <div className="text-muted-foreground">
              {formatMoney(plan.price, plan.currency ?? "MMK")} /{" "}
              {plan.billingInterval.toLowerCase()}
            </div>
            {subscription.trialEndsAt && (
              <p className="text-sm text-muted-foreground">
                Trial ends {new Date(subscription.trialEndsAt).toLocaleDateString()}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              Current period ends{" "}
              {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
            </p>
            <div className="flex flex-wrap gap-1">
              {moduleLabels.map((label) => (
                <Badge key={label} variant="outline">
                  {label}
                </Badge>
              ))}
            </div>
            {!subscriptionIsActive ? (
              <Button asChild className="w-full">
                <a href={contactHref}>Subscribe / renew plan</a>
              </Button>
            ) : (
              <Button disabled className="w-full">
                Upgrade plan (Stripe coming soon)
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageBar label="Branches" used={usage.usage.branches} max={limits.maxBranches} />
            <UsageBar label="Users" used={usage.usage.users} max={limits.maxUsers} />
            <UsageBar label="Products" used={usage.usage.products} max={limits.maxProducts} />
            <UsageBar
              label="Warehouses"
              used={usage.usage.warehouses}
              max={limits.maxWarehouses}
            />
          </CardContent>
        </Card>
      </div>

      {!subscriptionIsActive && availablePlans.length > 0 && (
        <Card id="available-plans">
          <CardHeader>
            <CardTitle>Available plans</CardTitle>
            <p className="text-sm text-muted-foreground">
              Choose a plan and contact the administrator to complete subscription.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {availablePlans.map((p) => (
              <div
                key={p.id}
                className={`rounded-lg border p-4 space-y-2 ${
                  p.slug === plan.slug ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.slug === plan.slug && (
                    <Badge variant="secondary">Current</Badge>
                  )}
                </div>
                {p.description && (
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                )}
                <p className="text-sm font-medium">
                  {formatMoney(p.price, p.currency)} / {p.billingInterval.toLowerCase()}
                </p>
                {p.trialDays > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {p.trialDays}-day free trial
                  </p>
                )}
                <Button
                  size="sm"
                  className="w-full"
                  variant={p.slug === plan.slug ? "outline" : "default"}
                  asChild
                >
                  <a
                    href={`${contactHref}&body=${encodeURIComponent(
                      `Hello,\n\nWe would like to subscribe to the "${p.name}" plan (${formatMoney(p.price, p.currency)}/${p.billingInterval.toLowerCase()}).\n\nOrganization plan request.\n\nThank you.`,
                    )}`}
                  >
                    {p.slug === plan.slug ? "Renew this plan" : `Subscribe to ${p.name}`}
                  </a>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
