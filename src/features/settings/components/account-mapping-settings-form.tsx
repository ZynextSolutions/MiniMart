"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ACCOUNT_MAPPING_FIELD_LABELS,
  ACCOUNT_MAPPING_KEYS,
  type AccountMapping,
} from "@/platform/onboarding/default-account-mapping";
import {
  resetAccountMappingAction,
  updateAccountMappingAction,
} from "@/features/settings/actions/account-mapping.actions";

type AccountOption = {
  id: string;
  code: string;
  name: string;
  type: string;
};

interface AccountMappingSettingsFormProps {
  initialMapping: AccountMapping;
  accounts: AccountOption[];
}

export function AccountMappingSettingsForm({
  initialMapping,
  accounts,
}: AccountMappingSettingsFormProps) {
  const [mapping, setMapping] = useState<AccountMapping>(initialMapping);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  function updateField(key: keyof AccountMapping, code: string) {
    setMapping((current) => ({ ...current, [key]: code }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const result = await updateAccountMappingAction(mapping);
    setSubmitting(false);

    if (result.success) {
      toast.success("Account mapping saved");
      setMapping(result.mapping);
      return;
    }

    toast.error(result.error ?? "Failed to save account mapping");
  }

  async function handleReset() {
    setResetting(true);
    const result = await resetAccountMappingAction();
    setResetting(false);

    if (result.success) {
      toast.success("Account mapping reset to defaults");
      setMapping(result.mapping);
      return;
    }

    toast.error(result.error ?? "Failed to reset account mapping");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Map POS and purchasing transactions to chart-of-account codes. All mapped accounts must
        exist and be active.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {ACCOUNT_MAPPING_KEYS.map((key) => {
          const meta = ACCOUNT_MAPPING_FIELD_LABELS[key];
          return (
            <div key={key} className="space-y-2">
              <Label htmlFor={key}>{meta.label}</Label>
              <Select
                value={mapping[key]}
                onValueChange={(value) => updateField(key, value)}
              >
                <SelectTrigger id={key}>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.code}>
                      {account.code} — {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">{meta.description}</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save mapping"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={resetting}
          onClick={handleReset}
        >
          {resetting ? "Resetting..." : "Reset to defaults"}
        </Button>
      </div>
    </form>
  );
}
