import { mutation, query, MutationCtx, QueryCtx } from "./_generated/server";
import { ConvexError, v } from "convex/values";
import { Doc, Id } from "./_generated/dataModel";

type Ctx = QueryCtx | MutationCtx;

async function requireCurrentUser(ctx: Ctx): Promise<Doc<"users">> {
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

  return currentUser;
}

function getConversationParticipants(conversation: Doc<"conversations">) {
  return conversation.participants ?? conversation.participantIds ?? [];
}

function getConversationLastMessageTime(conversation: Doc<"conversations">) {
  return conversation.lastMessageTime ?? conversation.lastMessageAt ?? 0;
}

function isGroupConversation(conversation: Doc<"conversations">) {
  return conversation.isGroup ?? false;
}

export const listForSidebar = query({
  args: {},
  handler: async (ctx) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversations = await ctx.db.query("conversations").collect();
    const myConversations = conversations.filter((conversation) =>
      getConversationParticipants(conversation).includes(currentUser._id)
    );

    const readRows = await ctx.db
      .query("messageReads")
      .withIndex("by_user", (q) => q.eq("userId", currentUser._id))
      .collect();
    const readByConversation = new Map<Id<"conversations">, Doc<"messageReads">>(
      readRows.map((row) => [row.conversationId, row])
    );

    const rows = await Promise.all(
      myConversations.map(async (conversation) => {
        const participants = getConversationParticipants(conversation);
        const isGroup = isGroupConversation(conversation);
        const participantUsers = await Promise.all(
          participants.map((participantId) => ctx.db.get(participantId))
        );
        const safeParticipants = participantUsers.filter(
          (user): user is Doc<"users"> => user !== null
        );

        let lastMessage: Doc<"messages"> | null = null;
        if (conversation.lastMessageId) {
          lastMessage = await ctx.db.get(conversation.lastMessageId);
        }
        if (!lastMessage) {
          const latest = await ctx.db
            .query("messages")
            .withIndex("by_conversation_created_at", (q) =>
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
          .withIndex("by_conversation_created_at", (q) =>
            q.eq("conversationId", conversation._id)
          )
          .collect();
        const unreadCount = allMessages.filter(
          (message) =>
            message.senderId !== currentUser._id &&
            message.createdAt > lastReadCreatedAt
        ).length;

        const otherUser = safeParticipants.find(
          (user) => user._id !== currentUser._id
        );
        const title = isGroup
          ? conversation.groupName ?? "Untitled Group"
          : otherUser?.name ?? "Unknown User";
        const avatarUrl = isGroup ? "" : otherUser?.imageUrl ?? "";

        return {
          conversationId: conversation._id,
          isGroup,
          title,
          avatarUrl,
          memberCount: safeParticipants.length,
          isOnline: isGroup ? false : Boolean(otherUser?.isOnline),
          lastSeen: isGroup ? null : otherUser?.lastSeen ?? null,
          lastMessagePreview: lastMessage
            ? (lastMessage.isDeleted ?? false)
              ? "This message was deleted"
              : lastMessage.content ?? lastMessage.text ?? ""
            : "",
          lastMessageTime: lastMessage?.createdAt ?? getConversationLastMessageTime(conversation),
          unreadCount,
          participants: safeParticipants.map((user) => ({
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

    const participants = getConversationParticipants(conversation);
    if (!participants.includes(currentUser._id)) {
      throw new ConvexError("Unauthorized");
    }

    const participantUsers = await Promise.all(
      participants.map((participantId) => ctx.db.get(participantId))
    );

    return {
      ...conversation,
      participants: participantUsers.filter(
        (participant): participant is Doc<"users"> => participant !== null
      ),
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
      (conversation) =>
        !isGroupConversation(conversation) &&
        getConversationParticipants(conversation).length === 2 &&
        getConversationParticipants(conversation).includes(currentUser._id) &&
        getConversationParticipants(conversation).includes(args.otherUserId)
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
      new Set<Id<"users">>([...args.memberIds, currentUser._id])
    );
    if (uniqueMembers.length < 2) {
      throw new ConvexError("A group needs at least 2 members including you");
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

export const deleteConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
  },
  handler: async (ctx, args) => {
    const currentUser = await requireCurrentUser(ctx);
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new ConvexError("Conversation not found");
    }

    const participants = getConversationParticipants(conversation);
    if (!participants.includes(currentUser._id)) {
      throw new ConvexError("Unauthorized");
    }

    const typingRows = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const readRows = await ctx.db
      .query("messageReads")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    const messageRows = await ctx.db
      .query("messages")
      .withIndex("by_conversation_created_at", (q) =>
        q.eq("conversationId", args.conversationId)
      )
      .collect();

    for (const row of typingRows) {
      await ctx.db.delete(row._id);
    }

    for (const row of readRows) {
      await ctx.db.delete(row._id);
    }

    for (const row of messageRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.delete(conversation._id);

    return {
      deletedConversationId: conversation._id,
      deletedMessageCount: messageRows.length,
      deletedReadCount: readRows.length,
      deletedTypingCount: typingRows.length,
    };
  },
});
