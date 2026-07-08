"use client";

import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { getMyPatientRecord, updateMyProfile } from "@/app/actions/patient";
import { createSupabaseClient } from "@/lib/supabase/client";
import {
  patientProfileUpdateSchema,
  passwordChangeSchema,
  type PatientProfileUpdateData,
  type PasswordChangeData,
} from "@/types/patient.types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function PatientProfilePage() {
  const queryClient = useQueryClient();
  const supabase = createSupabaseClient();

  const { data: record } = useQuery({
    queryKey: ["my-patient-record"],
    queryFn: () => getMyPatientRecord(),
  });

  const profileForm = useForm<PatientProfileUpdateData>({
    resolver: zodResolver(patientProfileUpdateSchema),
    defaultValues: { phone: "" },
  });

  useEffect(() => {
    if (record?.profile?.phone) {
      profileForm.reset({ phone: record.profile.phone });
    }
  }, [record?.profile?.phone, profileForm]);

  const profileMutation = useMutation({
    mutationFn: (data: PatientProfileUpdateData) => updateMyProfile(data),
    onSuccess: (result) => {
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["my-patient-record"] });
    },
    onError: () => toast.error("Failed to update profile."),
  });

  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onChangePassword = async (data: PasswordChangeData) => {
    const { error } = await supabase.auth.updateUser({ password: data.password });
    if (error) {
      toast.error(error.message || "Failed to update password.");
      return;
    }
    toast.success("Password updated.");
    passwordForm.reset();
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">My Profile</h1>
        <p className="text-muted-foreground">
          Update your contact number and password.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={profileForm.handleSubmit((d) => profileMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input value={record?.profile?.full_name ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={record?.profile?.email ?? ""} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" {...profileForm.register("phone")} placeholder="+1 234 567 890" />
                {profileForm.formState.errors.phone && (
                  <p className="text-xs text-destructive">
                    {profileForm.formState.errors.phone.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={profileMutation.isPending}>
                {profileMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={passwordForm.handleSubmit(onChangePassword)}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("password")}
                />
                {passwordForm.formState.errors.password && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.password.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  {...passwordForm.register("confirmPassword")}
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
              <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
                {passwordForm.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update Password
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
