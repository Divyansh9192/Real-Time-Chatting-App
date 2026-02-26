/* eslint-disable @typescript-eslint/no-explicit-any */
import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

async function requireCurrentUser(ctx: any) {
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
      if (
        existing.name !== name ||
        existing.email !== email ||
        existing.imageUrl !== imageUrl
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
    return currentUser;
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    const { currentUser } = await requireCurrentUser(ctx);
    const users = await ctx.db.query("users").collect();
    return users
      .filter((user) => user._id !== currentUser._id)
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
