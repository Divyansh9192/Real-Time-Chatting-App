import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";

type Ctx = QueryCtx | MutationCtx;

async function requireCurrentUser(ctx: Ctx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Unauthenticated");
  }

  const currentUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  if (!currentUser) {
    throw new ConvexError("User not found");
  }

  return { currentUser, identity };
}

function normalizeUser<T extends { name?: string; username?: string; email?: string; imageUrl?: string; isOnline?: boolean; lastSeen?: number; createdAt?: number }>(
  user: T
) {
  return {
    ...user,
    name: user.name ?? user.username ?? "Anonymous",
    email: user.email ?? "",
    imageUrl: user.imageUrl ?? "",
    isOnline: user.isOnline ?? false,
    lastSeen: user.lastSeen ?? user.createdAt ?? Date.now(),
  };
}

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const name = identity.name ?? identity.email?.split("@")[0] ?? "Anonymous";
    const email = identity.email ?? "";
    const imageUrl = identity.pictureUrl ?? "";
    const now = Date.now();

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      const normalizedExisting = normalizeUser(existing);
      if (
        normalizedExisting.name !== name ||
        normalizedExisting.email !== email ||
        normalizedExisting.imageUrl !== imageUrl ||
        existing.isOnline === undefined ||
        existing.lastSeen === undefined
      ) {
        await ctx.db.patch(existing._id, {
          name,
          email,
          imageUrl,
          lastSeen: now,
        });
      }
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: identity.subject,
      name,
      email,
      imageUrl,
      isOnline: true,
      lastSeen: now,
    });
  },
});

export const me = query({
  args: {},
  handler: async (ctx) => {
    const { currentUser } = await requireCurrentUser(ctx);
    return normalizeUser(currentUser);
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const { currentUser } = await requireCurrentUser(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user._id !== currentUser._id)
      .map((user) => normalizeUser(user))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const setPresence = mutation({
  args: {
    isOnline: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { currentUser } = await requireCurrentUser(ctx);
    const now = Date.now();
    await ctx.db.patch(currentUser._id, {
      isOnline: args.isOnline,
      lastSeen: now,
    });
    return { ok: true };
  },
});
