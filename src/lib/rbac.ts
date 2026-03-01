import { prisma } from "@/lib/prisma";

export async function hasPermission(
  profileId: string,
  permissionName: string,
): Promise<boolean> {
  const result = await prisma.role_permissions.findFirst({
    where: {
      roles: {
        profile_roles: {
          some: { profile_id: profileId },
        },
      },
      permissions: {
        name: permissionName,
      },
    },
  });

  return !!result;
}

export async function getUserPermissions(profileId: string): Promise<string[]> {
  const permissions = await prisma.permissions.findMany({
    where: {
      role_permissions: {
        some: {
          roles: {
            profile_roles: {
              some: { profile_id: profileId },
            },
          },
        },
      },
    },
    select: { name: true },
  });

  return permissions.map((p: { name: string }) => p.name);
}

export async function getUserRoles(profileId: string): Promise<string[]> {
  const roles = await prisma.roles.findMany({
    where: {
      profile_roles: {
        some: { profile_id: profileId },
      },
    },
    select: { name: true },
  });

  return roles.map((r: { name: string }) => r.name);
}
