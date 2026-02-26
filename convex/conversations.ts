import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listConversations = query({
  args: {},
  handler: async (ctx) => {
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

    const conversations = await ctx.db.query("conversations").collect();

    const myConversations = conversations.filter((conversation) =>
      conversation.participantIds.some(
        (participantId) => participantId === currentUser._id
      )
    );

    const lastMessages = await Promise.all(
      myConversations.map(async (conversation) => {
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .order("desc")
          .take(1);

        return {
          conversation,
          lastMessage: messages[0] ?? null,
        };
      })
    );

    return lastMessages;
  },
});

export const getOrCreateConversation = mutation({
  args: {
    otherUserId: v.id("users"),
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

    const participants = [currentUser._id, args.otherUserId];

    const existing = await ctx.db
      .query("conversations")
      .filter((q) =>
        q.eq(q.field("participantIds"), participants)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const conversationId = await ctx.db.insert("conversations", {
      participantIds: participants,
      lastMessageAt: Date.now(),
    });

    return conversationId;
  },
});

