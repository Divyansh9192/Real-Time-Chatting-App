import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    isOnline: v.optional(v.boolean()),
    lastSeen: v.optional(v.number()),
    // Legacy fields kept for local schema compatibility.
    username: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"])
    .index("by_is_online", ["isOnline"]),

  conversations: defineTable({
    participants: v.optional(v.array(v.id("users"))),
    // Legacy field kept for local schema compatibility.
    participantIds: v.optional(v.array(v.id("users"))),
    lastMessageId: v.optional(v.id("messages")),
    lastMessageTime: v.optional(v.number()),
    // Legacy field kept for local schema compatibility.
    lastMessageAt: v.optional(v.number()),
    isGroup: v.optional(v.boolean()),
    groupName: v.optional(v.string()),
    groupCreatedBy: v.optional(v.id("users")),
  }).index("by_last_message_time", ["lastMessageTime"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.optional(v.string()),
    // Legacy field kept for local schema compatibility.
    text: v.optional(v.string()),
    createdAt: v.number(),
    isDeleted: v.optional(v.boolean()),
    reactions: v.optional(
      v.array(
        v.object({
          userId: v.id("users"),
          emoji: v.string(),
        })
      )
    ),
    // Legacy field kept for local schema compatibility.
    seenBy: v.optional(v.array(v.id("users"))),
  }).index("by_conversation_created_at", ["conversationId", "createdAt"]),

  typingIndicators: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_conversation_user", ["conversationId", "userId"]),

  messageReads: defineTable({
    conversationId: v.id("conversations"),
    userId: v.id("users"),
    lastReadMessageId: v.id("messages"),
  })
    .index("by_conversation_user", ["conversationId", "userId"])
    .index("by_user", ["userId"]),
});
