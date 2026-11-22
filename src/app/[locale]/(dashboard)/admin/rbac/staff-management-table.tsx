"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { assignStaffRoles } from "@/app/actions/rbac";
import { toast } from "sonner";
import { ShieldAlert } from "lucide-react";
import { useTranslations } from "next-intl";

type ProfileStaff = {
  id: string;
  full_name: string | null;
  email: string | null;
  auth_user_id: string;
  role: string | null;
  assigned_roles: {
    id: string;
    name: string;
  }[];
};

type GlobalRole = {
  id: string;
  name: string;
};

export default function StaffManagementTable({
  initialStaff,
  allRoles,
}: {
  initialStaff: ProfileStaff[];
  allRoles: GlobalRole[];
}) {
  const t = useTranslations("admin.rbac.staff");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<ProfileStaff | null>(null);

  // Form State
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(
    new Set(),
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenDialog = (staff: ProfileStaff) => {
    setSelectedStaff(staff);
    // Extract base DB profile roles
    setSelectedRoleIds(new Set(staff.assigned_roles.map((r) => r.id)));
    setIsDialogOpen(true);
  };

  const toggleRole = (id: string) => {
    const next = new Set(selectedRoleIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedRoleIds(next);
  };

  const handleSave = async () => {
    if (!selectedStaff) return;
    setIsLoading(true);
    const roleIdsArray = Array.from(selectedRoleIds);
    try {
      const res = await assignStaffRoles(selectedStaff.id, roleIdsArray);
      if (res.error) throw new Error(res.error);
      toast.success(t("toastUpdated"));
      setIsDialogOpen(false);
      window.location.reload();
    } catch (error: unknown) {
      toast.error((error as Error).message || t("toastUpdateFailed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogDesc", { name: selectedStaff?.full_name || t("thisUser") })}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedStaff?.role === "admin" && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>
                  {t("adminNotice")}
                </span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>{t("rolesLabel")}</Label>
              {allRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  {t("noCustomRoles")}
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 h-48 overflow-y-auto pe-2">
                  {allRoles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={selectedRoleIds.has(role.id)}
                        onCheckedChange={() => toggleRole(role.id)}
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button disabled={isLoading} onClick={handleSave}>
              {t("updateRoles")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colStaffMember")}</TableHead>
              <TableHead>{t("colEmail")}</TableHead>
              <TableHead>{t("colBaseRole")}</TableHead>
              <TableHead>{t("colAssignedRoles")}</TableHead>
              <TableHead className="text-end">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialStaff.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell className="font-medium">
                  {staff.full_name || t("na")}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {staff.email}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={staff.role === "admin" ? "default" : "outline"}
                  >
                    {staff.role || "staff"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {staff.assigned_roles.map((r) => (
                      <Badge key={r.id} variant="secondary" className="text-xs">
                        {r.name}
                      </Badge>
                    ))}
                    {staff.assigned_roles.length === 0 &&
                      staff.role !== "admin" && (
                        <span className="text-muted-foreground text-xs italic">
                          {t("noSpecificRoles")}
                        </span>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(staff)}
                  >
                    {t("manageAccess")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
