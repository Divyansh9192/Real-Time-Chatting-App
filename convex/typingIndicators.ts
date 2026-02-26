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
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .unique();

  if (!currentUser) {
    throw new ConvexError("User not found");
  }

  return currentUser;
}

async function requireConversationMembership(ctx: any, conversationId: any, currentUserId: any) {
  const conversation = await ctx.db.get(conversationId);
  if (!conversation) {
    throw new ConvexError("Conversation not found");
  }
  const participants = conversation.participants ?? conversation.participantIds ?? [];
  if (!participants.includes(currentUserId)) {
    throw new ConvexError("Unauthorized");
  }
  return conversation;
}

export const upsert = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await requireConversationMembership(ctx, args.conversationId, currentUser._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q: any) =>
        q.eq("conversationId", args.conversationId).eq("userId", currentUser._id)
      )
      .unique();

    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("typingIndicators", {
      conversationId: args.conversationId,
      userId: currentUser._id,
      updatedAt: now,
    });
  },
});

export const clear = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await requireConversationMembership(ctx, args.conversationId, currentUser._id);

    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q: any) =>
        q.eq("conversationId", args.conversationId).eq("userId", currentUser._id)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
    return { ok: true };
  },
});

export const listForConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await requireConversationMembership(ctx, args.conversationId, currentUser._id);

    const rows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const others = rows.filter((row: any) => row.userId !== currentUser._id);
    const userDocs = await Promise.all(
      others.map((row: any) => ctx.db.get(row.userId))
    );
    const userMap = new Map(
      userDocs.filter(Boolean).map((user: any) => [user._id, user])
    );

    return others.map((row: any) => ({
      ...row,
      userName: userMap.get(row.userId)?.name ?? userMap.get(row.userId)?.username ?? "Someone",
    }));
  },
});
