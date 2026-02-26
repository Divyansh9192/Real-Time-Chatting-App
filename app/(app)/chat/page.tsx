"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { useEffect } from "react";
import Link from "next/link";
import { MessageCircle, Search, Plus } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";

export default function ChatPage() {
  const { user } = useUser();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const authReady = !authLoading && isAuthenticated;
  const hasConvexAuthError = !authLoading && !isAuthenticated;
  
  // Ensure current user exists in Convex
  const ensureUser = useMutation(api.users.ensureCurrentUser);
  
  // Get conversations
  const conversations = useQuery(
    api.conversations.listConversations,
    authReady ? {} : "skip"
  );

  // Get all users for finding participant details
  const users = useQuery(api.users.listUsers, authReady ? { search: "" } : "skip");

  useEffect(() => {
    if (authReady && user) {
      ensureUser({}).catch(() => {
        // User not authenticated, this is expected for non-logged-in users
      });
    }
  }, [authReady, user, ensureUser]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return "Yesterday";
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-600 rounded-lg">
              <MessageCircle className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold text-gray-800">Messages</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/users"
              className="p-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="Find users"
            >
              <Search className="w-5 h-5" />
            </Link>
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Conversations List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">Recent Conversations</h2>
          </div>
          
          {hasConvexAuthError ? (
            <div className="p-8 text-center">
              <p className="text-gray-700 font-medium mb-2">Cannot authenticate with Convex</p>
              <p className="text-sm text-gray-500">
                Check Clerk + Convex JWT settings (`CLERK_JWT_ISSUER_DOMAIN` and app ID `convex`).
              </p>
            </div>
          ) : conversations === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading conversations...</p>
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MessageCircle className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500 mb-4">No conversations yet</p>
              <Link
                href="/users"
                className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Start a conversation
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {conversations.map(({ conversation, lastMessage }) => (
                <ConversationItem
                  key={conversation._id}
                  conversation={conversation}
                  lastMessage={lastMessage}
                  users={users}
                  formatTime={formatTime}
                />
              ))}
            </div>
          )}
        </div>

        {/* Find Users Card */}
        <div className="mt-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold mb-1">Find new friends</h3>
              <p className="text-indigo-100 text-sm">Search for users and start chatting</p>
            </div>
            <Link
              href="/users"
              className="px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
            >
              Find Users
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function ConversationItem({ 
  conversation, 
  lastMessage,
  users,
  formatTime,
}: { 
  conversation: Doc<"conversations">;
  lastMessage: Doc<"messages"> | undefined;
  users: Doc<"users">[] | undefined;
  formatTime: (timestamp: number) => string;
}) {
  const otherParticipantId =
    conversation.participantIds.find((participantId) =>
      users?.some((u: Doc<"users">) => u._id === participantId)
    ) ?? conversation.participantIds[0];
  const otherUser = users?.find((u: Doc<"users">) => u._id === otherParticipantId);

  return (
    <Link
      href={`/chat/${conversation._id}`}
      className="block p-4 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
          {otherUser?.username?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-gray-800 truncate">
              {otherUser?.username || "Unknown User"}
            </h3>
            {lastMessage && (
              <span className="text-xs text-gray-400">
                {formatTime(lastMessage.createdAt)}
              </span>
            )}
          </div>
          {lastMessage && (
            <p className="text-sm text-gray-500 truncate">
              {lastMessage.text}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
