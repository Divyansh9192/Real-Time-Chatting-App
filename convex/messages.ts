import { mutation, query } from "./_generated/server";
import { ConvexError, v } from "convex/values";

const ALLOWED_REACTIONS = ["👍", "❤️", "😂", "😮", "😢"] as const;

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
  if (!conversation.participants.includes(currentUserId)) {
    throw new ConvexError("Unauthorized");
  }
  return conversation;
}

async function upsertReadPointer(ctx: any, conversationId: any, userId: any, messageId: any) {
  const existing = await ctx.db
    .query("messageReads")
    .withIndex("by_conversation_user", (q: any) =>
      q.eq("conversationId", conversationId).eq("userId", userId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, {
      lastReadMessageId: messageId,
    });
  } else {
    await ctx.db.insert("messageReads", {
      conversationId,
      userId,
      lastReadMessageId: messageId,
    });
  }
}

export const listByConversation = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await requireConversationMembership(ctx, args.conversationId, currentUser._id);

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("asc")
      .collect();

    const senderIds = Array.from(new Set(messages.map((message: any) => message.senderId)));
    const senders = await Promise.all(senderIds.map((senderId) => ctx.db.get(senderId)));
    const senderMap = new Map(senders.filter(Boolean).map((sender: any) => [sender._id, sender]));

    return messages.map((message: any) => {
      const sender = senderMap.get(message.senderId);
      return {
        ...message,
        senderName: sender?.name ?? "Unknown User",
        senderImageUrl: sender?.imageUrl ?? "",
        isOwnMessage: message.senderId === currentUser._id,
      };
    });
  },
});

export const send = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await requireConversationMembership(
      ctx,
      args.conversationId,
      currentUser._id
    );

    const content = args.content.trim();
    if (!content) {
      throw new ConvexError("Message cannot be empty");
    }

    const now = Date.now();
    const messageId = await ctx.db.insert("messages", {
      conversationId: conversation._id,
      senderId: currentUser._id,
      content,
      createdAt: now,
      isDeleted: false,
      reactions: [],
    });

    await ctx.db.patch(conversation._id, {
      lastMessageId: messageId,
      lastMessageTime: now,
    });

    await upsertReadPointer(ctx, conversation._id, currentUser._id, messageId);

    const typingRow = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation_user", (q: any) =>
        q.eq("conversationId", conversation._id).eq("userId", currentUser._id)
      )
      .unique();
    if (typingRow) {
      await ctx.db.delete(typingRow._id);
    }

    return messageId;
  },
});

export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    await requireConversationMembership(ctx, args.conversationId, currentUser._id);

    const latest = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q: any) =>
        q.eq("conversationId", args.conversationId)
      )
      .order("desc")
      .take(1);

    if (!latest[0]) {
      return null;
    }

    await upsertReadPointer(ctx, args.conversationId, currentUser._id, latest[0]._id);
    return latest[0]._id;
  },
});

export const softDelete = mutation({
  args: {
    messageId: v.id("messages"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError("Message not found");
    }

    await requireConversationMembership(ctx, message.conversationId, currentUser._id);

    if (message.senderId !== currentUser._id) {
      throw new ConvexError("You can only delete your own messages");
    }

    await ctx.db.patch(message._id, {
      isDeleted: true,
      content: "",
      reactions: [],
    });
    return { ok: true };
  },
});

export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new ConvexError("Message not found");
    }

    if (!ALLOWED_REACTIONS.includes(args.emoji as (typeof ALLOWED_REACTIONS)[number])) {
      throw new ConvexError("Invalid emoji reaction");
    }

    await requireConversationMembership(ctx, message.conversationId, currentUser._id);
    if (message.isDeleted) {
      return message.reactions;
    }

    const hasReaction = message.reactions.some(
      (reaction: any) =>
        reaction.userId === currentUser._id && reaction.emoji === args.emoji
    );

    const reactions = hasReaction
      ? message.reactions.filter(
          (reaction: any) =>
            !(reaction.userId === currentUser._id && reaction.emoji === args.emoji)
        )
      : [...message.reactions, { userId: currentUser._id, emoji: args.emoji }];

    await ctx.db.patch(message._id, { reactions });
    return reactions;
  },
});
