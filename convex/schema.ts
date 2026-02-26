import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.string(),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_name", ["name"])
    .index("by_is_online", ["isOnline"]),

  conversations: defineTable({
    participants: v.array(v.id("users")),
    lastMessageId: v.optional(v.id("messages")),
    lastMessageTime: v.number(),
    isGroup: v.boolean(),
    groupName: v.optional(v.string()),
    groupCreatedBy: v.optional(v.id("users")),
  }).index("by_last_message_time", ["lastMessageTime"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    createdAt: v.number(),
    isDeleted: v.boolean(),
    reactions: v.array(
      v.object({
        userId: v.id("users"),
        emoji: v.string(),
      })
    ),
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
