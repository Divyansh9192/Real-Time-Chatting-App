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

export const listForSidebar = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversations = await ctx.db.query("conversations").collect();
    const myConversations = conversations.filter((conversation: any) =>
      conversation.participants.includes(currentUser._id)
    );

    const readRows = await ctx.db
      .query("messageReads")
      .withIndex("by_user", (q: any) => q.eq("userId", currentUser._id))
      .collect();
    const readByConversation = new Map(
      readRows.map((row: any) => [row.conversationId, row])
    );

    const rows = await Promise.all(
      myConversations.map(async (conversation: any) => {
        const participantUsers = await Promise.all(
          conversation.participants.map((participantId: any) =>
            ctx.db.get(participantId)
          )
        );
        const safeParticipants = participantUsers.filter(Boolean);

        let lastMessage = conversation.lastMessageId
          ? await ctx.db.get(conversation.lastMessageId)
          : null;
        if (!lastMessage) {
          const latest = await ctx.db
            .query("messages")
            .withIndex("by_conversation_created_at", (q: any) =>
              q.eq("conversationId", conversation._id)
            )
            .order("desc")
            .take(1);
          lastMessage = latest[0] ?? null;
        }

        const readRow = readByConversation.get(conversation._id);
        let lastReadCreatedAt = 0;
        if (readRow) {
          const readMessage = await ctx.db.get(readRow.lastReadMessageId);
          if (readMessage) {
            lastReadCreatedAt = readMessage.createdAt;
          }
        }

        const allMessages = await ctx.db
          .query("messages")
          .withIndex("by_conversation_created_at", (q: any) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();
        const unreadCount = allMessages.filter(
          (message: any) =>
            message.senderId !== currentUser._id &&
            message.createdAt > lastReadCreatedAt
        ).length;

        const otherUser = safeParticipants.find(
          (user: any) => user._id !== currentUser._id
        );
        const title = conversation.isGroup
          ? conversation.groupName ?? "Untitled Group"
          : otherUser?.name ?? "Unknown User";
        const avatarUrl = conversation.isGroup ? "" : (otherUser?.imageUrl ?? "");

        return {
          conversationId: conversation._id,
          isGroup: conversation.isGroup,
          title,
          avatarUrl,
          memberCount: safeParticipants.length,
          isOnline: conversation.isGroup ? false : Boolean(otherUser?.isOnline),
          lastSeen: conversation.isGroup ? null : (otherUser?.lastSeen ?? null),
          lastMessagePreview: lastMessage
            ? lastMessage.isDeleted
              ? "This message was deleted"
              : lastMessage.content
            : "",
          lastMessageTime:
            lastMessage?.createdAt ?? conversation.lastMessageTime ?? 0,
          unreadCount,
          participants: safeParticipants.map((user: any) => ({
            _id: user._id,
            name: user.name,
            imageUrl: user.imageUrl,
            isOnline: user.isOnline,
            lastSeen: user.lastSeen,
          })),
        };
      })
    );

    rows.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
    return rows;
  },
});

export const getById = query({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError("Conversation not found");
    }

    if (!conversation.participants.includes(currentUser._id)) {
      throw new ConvexError("Unauthorized");
    }

    const participants = await Promise.all(
      conversation.participants.map((participantId: any) => ctx.db.get(participantId))
    );

    return {
      ...conversation,
      participants: participants.filter(Boolean),
    };
  },
});

export const getOrCreateDirect = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);

    if (args.otherUserId === currentUser._id) {
      throw new ConvexError("Cannot create a conversation with yourself");
    }

    const allConversations = await ctx.db.query("conversations").collect();
    const existing = allConversations.find(
      (conversation: any) =>
        !conversation.isGroup &&
        conversation.participants.length === 2 &&
        conversation.participants.includes(currentUser._id) &&
        conversation.participants.includes(args.otherUserId)
    );

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("conversations", {
      participants: [currentUser._id, args.otherUserId],
      lastMessageTime: Date.now(),
      isGroup: false,
    });
  },
});

export const createGroup = mutation({
  args: {
    groupName: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const trimmedName = args.groupName.trim();
    if (!trimmedName) {
      throw new ConvexError("Group name is required");
    }

    const uniqueMembers = Array.from(
      new Set([...args.memberIds, currentUser._id])
    );
    if (uniqueMembers.length < 3) {
      throw new ConvexError("A group needs at least 3 members including you");
    }

    return await ctx.db.insert("conversations", {
      participants: uniqueMembers,
      lastMessageTime: Date.now(),
      isGroup: true,
      groupName: trimmedName,
      groupCreatedBy: currentUser._id,
    });
  },
});
