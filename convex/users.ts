import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const ensureCurrentUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      return existing._id;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      username: identity.name ?? identity.email ?? "Anonymous",
      imageUrl: identity.pictureUrl ?? "",
      createdAt: Date.now(),
    });

    return userId;
  },
});

export const listUsers = query({
  args: {
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Unauthenticated");
    }

    const currentUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!currentUser) {
      throw new Error("User not found");
    }

    let users = await ctx.db.query("users").collect();
    users = users.filter((u) => u._id !== currentUser._id);

    if (args.search) {
      const term = args.search.toLowerCase();
      users = users.filter((u) =>
        u.username.toLowerCase().includes(term)
      );
    }

    return users;
  },
});

