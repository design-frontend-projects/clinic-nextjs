import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  getClinicRoles,
  getAllPermissions,
  getClinicStaff,
} from "@/app/actions/rbac";
import RoleManagementTable from "./role-management-table";
import StaffManagementTable from "./staff-management-table";
import { requireTenantInfo } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function RBACPage() {
  const tenant = await requireTenantInfo();
  if (tenant.role !== "admin") {
    redirect("/dashboard");
  }

  const roles = await getClinicRoles();
  const permissions = await getAllPermissions();
  const staff = await getClinicStaff();

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Access Control</h2>
      </div>

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          <TabsTrigger value="staff">Staff Assignment</TabsTrigger>
        </TabsList>
        <TabsContent value="roles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Roles</CardTitle>
              <CardDescription>
                Manage roles and their associated permissions for your clinic.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleManagementTable
                initialRoles={roles}
                allPermissions={permissions}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Staff Members</CardTitle>
              <CardDescription>
                Assign roles to your staff members to control their access.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StaffManagementTable initialStaff={staff} allRoles={roles} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
