"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ShieldCheck, Settings2 } from "lucide-react";

import { getPatientInsurances } from "@/app/actions/insurance";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  PatientInsuranceDialog,
  PolicySummary,
} from "@/components/insurance/patient-insurance-dialog";

interface PatientInsurancePanelProps {
  patientId: string;
  patientName: string;
  emptyLabel: string;
  manageLabel: string;
}

/**
 * Compact read view of a patient's insurance policies (company details,
 * deduction rule, remaining visits) with a manage dialog. Used inside the
 * doctor consultation tabs.
 */
export function PatientInsurancePanel({
  patientId,
  patientName,
  emptyLabel,
  manageLabel,
}: PatientInsurancePanelProps) {
  const [manageOpen, setManageOpen] = useState(false);

  const { data: policies = [] } = useQuery({
    queryKey: ["patient-insurances", patientId],
    queryFn: () => getPatientInsurances(patientId),
  });

  return (
    <div className="space-y-4">
      {policies.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {emptyLabel}
        </p>
      ) : (
        policies.map((policy) => (
          <div
            key={policy.id}
            className="border-b border-border/20 last:border-0 pb-3 last:pb-0 text-sm space-y-1"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <p className="font-semibold text-foreground text-xs">
                  {policy.provider_name}
                </p>
              </div>
              <Badge
                variant={policy.is_eligible ? "default" : "outline"}
                className="text-[10px]"
              >
                {policy.is_eligible ? "Eligible" : "Not eligible"}
              </Badge>
            </div>
            <PolicySummary policy={policy} />
            <p className="text-xs text-muted-foreground">
              {policy.policy_number
                ? `Policy #${policy.policy_number}`
                : "No policy number"}
              {policy.valid_to
                ? ` · expires ${format(new Date(policy.valid_to), "MMM d, yyyy")}`
                : ""}
            </p>
            {(policy.contact_phone || policy.contact_email) && (
              <p className="text-[10px] text-muted-foreground">
                {[policy.contact_phone, policy.contact_email]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          </div>
        ))
      )}

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setManageOpen(true)}
      >
        <Settings2 className="mr-2 h-3.5 w-3.5" />
        {manageLabel}
      </Button>

      {manageOpen && (
        <PatientInsuranceDialog
          patientId={patientId}
          patientName={patientName}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
    </div>
  );
}
