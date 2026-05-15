import { randomUUID } from "node:crypto";

import { config } from "dotenv";
import { eq } from "drizzle-orm";

config({ path: ".env.local" });
config({ path: ".env" });

process.env.PULLBRIEF_AUTH_SEEDING = "1";

async function main() {
  const email = requiredEnv("PULLBRIEF_SEED_EMAIL").toLowerCase();
  const password = requiredEnv("PULLBRIEF_SEED_PASSWORD");
  const name = process.env.PULLBRIEF_SEED_NAME?.trim() || email;
  const tenantName = process.env.PULLBRIEF_SEED_TENANT_NAME?.trim() || "PullBrief Internal";
  const tenantSlug = slugify(process.env.PULLBRIEF_SEED_TENANT_SLUG?.trim() || tenantName);
  const role = roleValue(process.env.PULLBRIEF_SEED_ROLE?.trim() || "admin");

  if (password.length < 8) {
    throw new Error("PULLBRIEF_SEED_PASSWORD must be at least 8 characters.");
  }

  const [{ auth }, { db }, schema] = await Promise.all([
    import("../src/lib/auth"),
    import("../src/db"),
    import("../src/db/schema"),
  ]);

  async function findUserByEmail(value: string) {
    const [row] = await db
      .select()
      .from(schema.user)
      .where(eq(schema.user.email, value))
      .limit(1);

    return row || null;
  }

  let user = await findUserByEmail(email);

  if (!user) {
    await auth.api.signUpEmail({
      body: {
        email,
        password,
        name,
      },
    });
    user = await findUserByEmail(email);
  }

  if (!user) {
    throw new Error(`Failed to create user ${email}.`);
  }

  await db
    .update(schema.user)
    .set({
      name,
      emailVerified: true,
      updatedAt: new Date(),
    })
    .where(eq(schema.user.id, user.id));

  const [tenant] = await db
    .insert(schema.tenants)
    .values({
      id: randomUUID(),
      name: tenantName,
      slug: tenantSlug,
    })
    .onConflictDoUpdate({
      target: schema.tenants.slug,
      set: {
        name: tenantName,
        updatedAt: new Date(),
      },
    })
    .returning();

  await db
    .insert(schema.tenantMembers)
    .values({
      id: randomUUID(),
      tenantId: tenant.id,
      userId: user.id,
      role,
    })
    .onConflictDoUpdate({
      target: [schema.tenantMembers.tenantId, schema.tenantMembers.userId],
      set: {
        role,
        updatedAt: new Date(),
      },
    });

  console.log(`Seeded ${email} as ${role} in tenant ${tenant.slug}.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is required.`);
  }

  return value;
}

function slugify(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) {
    throw new Error("Tenant slug must contain at least one letter or number.");
  }

  return slug;
}

function roleValue(value: string): "admin" | "reviewer" | "viewer" {
  if (value === "admin" || value === "reviewer" || value === "viewer") {
    return value;
  }

  throw new Error("PULLBRIEF_SEED_ROLE must be admin, reviewer, or viewer.");
}
