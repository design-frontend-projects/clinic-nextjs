"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { subscriptionSchema, type SubscriptionFormData } from "@/types/onboarding.types";

type SubscriptionSetupStepProps = {
  defaultValues?: Partial<SubscriptionFormData>;
  onSubmit: (data: SubscriptionFormData) => void;
  loading?: boolean;
};

// Mock plans for now. Eventually fetch from DB.
const plans = [
  {
    id: "basic",
    name: "Basic",
    price: "$29/mo",
    features: ["1 Branch", "Up to 3 Staff Users", "Basic Reporting"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99/mo",
    features: ["Multiple Branches", "Unlimited Staff Users", "Advanced Reporting", "API Access"],
  },
];

export function SubscriptionSetupStep({
  defaultValues,
  onSubmit,
  loading,
}: SubscriptionSetupStepProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SubscriptionFormData>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      plan_id: defaultValues?.plan_id ?? "basic",
    },
  });

  const selectedPlanId = watch("plan_id");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <RadioGroup
          defaultValue={selectedPlanId}
          onValueChange={(val: string) => setValue("plan_id", val)}
          className="grid gap-4"
        >
          {plans.map((plan) => (
            <Label
              key={plan.id}
              className={`flex cursor-pointer flex-col rounded-lg border p-4 hover:bg-accent ${
                selectedPlanId === plan.id ? "border-primary bg-primary/5" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <RadioGroupItem value={plan.id} id={plan.id} />
                  <span className="font-semibold text-foreground">{plan.name}</span>
                </div>
                <span className="font-bold text-primary">{plan.price}</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground ml-7">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </Label>
          ))}
        </RadioGroup>
        {errors.plan_id && (
          <p className="text-xs text-destructive">{errors.plan_id.message}</p>
        )}
      </div>

      <div className="pt-2">
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ArrowRight className="mr-2 h-4 w-4" />
          )}
          Continue to Setup
        </Button>
      </div>
    </form>
  );
}
