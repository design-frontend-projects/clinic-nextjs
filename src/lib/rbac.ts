import { prisma } from "@/lib/prisma";
import { getTenantInfo } from "@/lib/auth";

export async function hasPermission(permissionName: string): Promise<boolean> {
  const tenant = await getTenantInfo();

  if (!tenant) return false;
  if (tenant.role === "admin") return true;

  const result = await prisma.role_permissions.findFirst({
    where: {
      roles: {
        profile_roles: {
          some: { profile_id: tenant.profileId },
        },
      },
      permissions: {
        name: permissionName,
      },
    },
  });

  return !!result;
}

export async function getUserPermissions(): Promise<string[]> {
  const tenant = await getTenantInfo();
  if (!tenant) return [];
  // Admins practically have all, but this function might be used to get explicit assigned permissions
  // if you want to strictly return specific UI toggles, or just return an indicator.
  // For now, we fetch what's explicitly mapped.

  const permissions = await prisma.permissions.findMany({
    where: {
      role_permissions: {
        some: {
          roles: {
            profile_roles: {
              some: { profile_id: tenant.profileId },
            },
          },
        },
      },
    },
    select: { name: true },
  });

  return permissions.map((p: { name: string }) => p.name);
}

export async function getUserRoles(): Promise<string[]> {
  const tenant = await getTenantInfo();
  if (!tenant) return [];

  const roles = await prisma.roles.findMany({
    where: {
      profile_roles: {
        some: { profile_id: tenant.profileId },
      },
    },
    select: { name: true },
  });

  return roles.map((r: { name: string }) => r.name);
}
