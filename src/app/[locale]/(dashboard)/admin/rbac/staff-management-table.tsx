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
      toast.success("Staff roles updated successfully");
      setIsDialogOpen(false);
      window.location.reload();
    } catch (error: unknown) {
      toast.error((error as Error).message || "Failed to update staff roles");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign Custom Roles</DialogTitle>
            <DialogDescription>
              Assign clinic-specific custom roles to{" "}
              {selectedStaff?.full_name || "this user"}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {selectedStaff?.role === "admin" && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-3 rounded-md text-sm">
                <ShieldAlert className="h-4 w-4" />
                <span>
                  This user is an Admin. They already have access to everything,
                  regardless of assigned custom roles.
                </span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Roles</Label>
              {allRoles.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  No custom roles have been created yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 mt-2 h-48 overflow-y-auto pr-2">
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
              Update Roles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Staff Member</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Base System Role</TableHead>
              <TableHead>Assigned Roles</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialStaff.map((staff) => (
              <TableRow key={staff.id}>
                <TableCell className="font-medium">
                  {staff.full_name || "N/A"}
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
                          No specific roles
                        </span>
                      )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenDialog(staff)}
                  >
                    Manage Access
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
