import { supabase } from "@/lib/supabaseClient";

type OrganizationRecord = {
  id: string;
  name: string;
  subscription_status: string;
};

export type ActiveGymOrganization = {
  organizationId: string;
  organizationName: string;
  subscriptionStatus: string;
  role: string | null;
  membershipCreatedAt: string;
};

export async function getActiveGymOrganization(
  userId: string
): Promise<ActiveGymOrganization | null> {
  const { data: memberships, error } = await supabase
    .from("organization_users")
    .select(`
      organization_id,
      role,
      created_at,
      organizations (
        id,
        name,
        subscription_status
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const activeMembership = (memberships ?? []).find((membership) => {
    const organization = Array.isArray(membership.organizations)
      ? membership.organizations[0]
      : membership.organizations;

    return organization?.subscription_status === "active";
  });

  if (!activeMembership) {
    return null;
  }

  const organization = (
    Array.isArray(activeMembership.organizations)
      ? activeMembership.organizations[0]
      : activeMembership.organizations
  ) as OrganizationRecord | null;

  if (!organization) {
    return null;
  }

  return {
    organizationId: activeMembership.organization_id,
    organizationName: organization.name,
    subscriptionStatus: organization.subscription_status,
    role: activeMembership.role ?? null,
    membershipCreatedAt: activeMembership.created_at,
  };
}