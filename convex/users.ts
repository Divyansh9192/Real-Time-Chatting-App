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
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Unauthenticated");
    }

    const fallbackName = identity.name ?? identity.email?.split("@")[0] ?? "Anonymous";
    const name = args.name?.trim() || fallbackName;
    const email = args.email?.trim() || identity.email || "";
    const imageUrl = args.imageUrl?.trim() || identity.pictureUrl || "";
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
    const currentEmail = (currentUser.email ?? "").trim().toLowerCase();
    const currentName = (currentUser.name ?? "").trim().toLowerCase();
    const currentImageUrl = (currentUser.imageUrl ?? "").trim();
    const users = await ctx.db.query("users").collect();
    return users
      .filter(
        (user) => {
          if (user._id === currentUser._id) {
            return false;
          }
          if (user.clerkId === currentUser.clerkId) {
            return false;
          }

          const userEmail = (user.email ?? "").trim().toLowerCase();
          if (currentEmail && userEmail && userEmail === currentEmail) {
            return false;
          }

          const userName = (user.name ?? "").trim().toLowerCase();
          const userImageUrl = (user.imageUrl ?? "").trim();
          if (
            currentName &&
            userName === currentName &&
            currentImageUrl &&
            userImageUrl === currentImageUrl
          ) {
            return false;
          }

          return true;
        }
      )
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
