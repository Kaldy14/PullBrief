import "server-only";

import { eq } from "drizzle-orm";
import { headers as nextHeaders } from "next/headers";
import { redirect } from "next/navigation";

import { db } from "@/db";
import { tenantMembers, tenants } from "@/db/schema";
import { auth } from "@/lib/auth";

export type TenantRole = "admin" | "reviewer" | "viewer";

export type UserAccess = {
  userId: string;
  userEmail: string;
  userName: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  role: TenantRole;
};

export class UnauthorizedError extends Error {
  readonly status = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Tenant access required.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export async function getAccessFromHeaders(headers: Headers): Promise<UserAccess | null> {
  const session = await auth.api.getSession({ headers });

  if (!session) {
    return null;
  }

  const membership = await findFirstTenantMembership(session.user.id);

  if (!membership) {
    return null;
  }

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    tenantId: membership.tenant.id,
    tenantSlug: membership.tenant.slug,
    tenantName: membership.tenant.name,
    role: membership.member.role,
  };
}

export async function requireApiAccess(headers: Headers): Promise<UserAccess> {
  const session = await auth.api.getSession({ headers });

  if (!session) {
    throw new UnauthorizedError();
  }

  const membership = await findFirstTenantMembership(session.user.id);

  if (!membership) {
    throw new ForbiddenError();
  }

  return membershipToAccess({
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    membership,
  });
}

export async function requireApiAdminAccess(headers: Headers): Promise<UserAccess> {
  const access = await requireApiAccess(headers);

  if (access.role !== "admin") {
    throw new ForbiddenError("Tenant admin access required.");
  }

  return access;
}

export async function requirePageAccess(nextPath: string): Promise<UserAccess> {
  const session = await auth.api.getSession({ headers: await nextHeaders() });

  if (!session) {
    redirect(`/sign-in?next=${encodeURIComponent(nextPath)}`);
  }

  const membership = await findFirstTenantMembership(session.user.id);

  if (!membership) {
    redirect(`/sign-in?error=${encodeURIComponent("no-access")}`);
  }

  return membershipToAccess({
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    membership,
  });
}

export async function requirePageAdminAccess(nextPath: string): Promise<UserAccess> {
  const access = await requirePageAccess(nextPath);

  if (access.role !== "admin") {
    redirect("/review");
  }

  return access;
}

export async function requireServerActionAccess(): Promise<UserAccess> {
  const session = await auth.api.getSession({ headers: await nextHeaders() });

  if (!session) {
    redirect("/sign-in");
  }

  const membership = await findFirstTenantMembership(session.user.id);

  if (!membership) {
    redirect(`/sign-in?error=${encodeURIComponent("no-access")}`);
  }

  return membershipToAccess({
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    membership,
  });
}

function membershipToAccess(input: {
  userId: string;
  userEmail: string;
  userName: string;
  membership: NonNullable<Awaited<ReturnType<typeof findFirstTenantMembership>>>;
}): UserAccess {
  return {
    userId: input.userId,
    userEmail: input.userEmail,
    userName: input.userName,
    tenantId: input.membership.tenant.id,
    tenantSlug: input.membership.tenant.slug,
    tenantName: input.membership.tenant.name,
    role: input.membership.member.role,
  };
}

async function findFirstTenantMembership(userId: string) {
  const [row] = await db
    .select({
      member: tenantMembers,
      tenant: tenants,
    })
    .from(tenantMembers)
    .innerJoin(tenants, eq(tenantMembers.tenantId, tenants.id))
    .where(eq(tenantMembers.userId, userId))
    .limit(1);

  return row || null;
}
