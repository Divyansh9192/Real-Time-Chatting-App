import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    username: v.string(),
    imageUrl: v.string(),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  conversations: defineTable({
    participantIds: v.array(v.id("users")),
    lastMessageAt: v.number(),
  }).index("by_participant", ["participantIds"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    text: v.string(),
    createdAt: v.number(),
    seenBy: v.array(v.id("users")),
  }).index("by_conversation", ["conversationId", "createdAt"]),
});

