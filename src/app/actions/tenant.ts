"use server";

import { getTenantInfo } from "@/lib/auth";

export async function fetchTenantInfoAction() {
  return getTenantInfo();
}
