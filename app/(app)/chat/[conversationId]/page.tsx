"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Send, User } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { Id, Doc } from "@/convex/_generated/dataModel";

export default function ChatViewPage() {
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { user } = useUser();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const authReady = !authLoading && isAuthenticated;
  const hasConvexAuthError = !authLoading && !isAuthenticated;
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Ensure user exists
  const ensureUser = useMutation(api.users.ensureCurrentUser);
  
  // Get messages for this conversation
  const messages = useQuery(
    api.messages.listMessages,
    authReady
      ? { conversationId: conversationId as Id<"conversations"> }
      : "skip"
  );

  // Get all users to find the other participant
  const allUsers = useQuery(api.users.listUsers, authReady ? { search: "" } : "skip");
  
  // Get conversation details
  const conversations = useQuery(
    api.conversations.listConversations,
    authReady ? {} : "skip"
  );
  const conversation = conversations?.find(
    (c) => c.conversation._id === conversationId
  )?.conversation;

  // Send message mutation
  const sendMessage = useMutation(api.messages.sendMessage);

  useEffect(() => {
    if (authReady && user) {
      ensureUser({}).catch(() => {
        // User not authenticated
      });
    }
  }, [authReady, user, ensureUser]);

  useEffect(() => {
    // Scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    try {
      await sendMessage({
        conversationId: conversationId as Id<"conversations">,
        text: messageText.trim(),
      });
      setMessageText("");
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  };

  // Find the other user in the conversation
  const otherUserId = conversation?.participantIds?.find((id) =>
    allUsers?.some((u: Doc<"users">) => u._id === id)
  );
  const currentUserId = conversation?.participantIds?.find((id) => id !== otherUserId);
  const otherUser = allUsers?.find((u: Doc<"users">) => u._id === otherUserId);

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (hasConvexAuthError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center max-w-md px-6">
          <p className="text-gray-700 font-medium mb-2">Cannot authenticate with Convex</p>
          <p className="text-sm text-gray-500 mb-4">
            Check Clerk + Convex JWT settings (`CLERK_JWT_ISSUER_DOMAIN` and app ID `convex`).
          </p>
          <Link
            href="/chat"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Back to chat
          </Link>
        </div>
      </div>
    );
  }

  if (!authReady || conversations === undefined) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Conversation not found</p>
          <Link
            href="/chat"
            className="text-indigo-600 hover:text-indigo-700 font-medium"
          >
            Back to chat
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/chat"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          
          <div className="flex items-center gap-3 flex-1">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
              {otherUser?.username?.[0]?.toUpperCase() || <User className="w-5 h-5" />}
            </div>
            <div>
              <h1 className="font-semibold text-gray-800">
                {otherUser?.username || "Unknown User"}
              </h1>
              <p className="text-xs text-gray-500">Click to view profile</p>
            </div>
          </div>

          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages?.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No messages yet. Start the conversation!</p>
            </div>
          ) : (
            messages?.map((message: Doc<"messages">) => {
              const isOwnMessage = message.senderId === currentUserId;
              
              return (
                <div
                  key={message._id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] px-4 py-3 rounded-2xl ${
                      isOwnMessage
                        ? 'bg-indigo-600 text-white rounded-br-md'
                        : 'bg-white text-gray-800 rounded-bl-md shadow-sm'
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    <p className={`text-xs mt-1 ${
                      isOwnMessage ? 'text-indigo-200' : 'text-gray-400'
                    }`}>
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Message Input */}
      <footer className="bg-white border-t border-gray-100 p-4">
        <form
          onSubmit={handleSendMessage}
          className="max-w-4xl mx-auto flex items-center gap-3"
        >
          <input
            type="text"
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-4 py-3 bg-gray-100 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
          />
          <button
            type="submit"
            disabled={!messageText.trim()}
            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </footer>
    </div>
  );
}
