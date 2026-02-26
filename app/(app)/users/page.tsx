"use client";

import { useQuery, useMutation, useConvexAuth } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Search, MessageCircle, User } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";

export default function UsersPage() {
  const router = useRouter();
  const { user } = useUser();
  const { isLoading: authLoading, isAuthenticated } = useConvexAuth();
  const authReady = !authLoading && isAuthenticated;
  const hasConvexAuthError = !authLoading && !isAuthenticated;
  const [searchTerm, setSearchTerm] = useState("");

  // Ensure user exists
  const ensureUser = useMutation(api.users.ensureCurrentUser);
  
  // Get all users with optional search
  const users = useQuery(
    api.users.listUsers,
    authReady ? { search: searchTerm } : "skip"
  );

  // Create or get conversation
  const createConversation = useMutation(api.conversations.getOrCreateConversation);

  useEffect(() => {
    if (authReady && user) {
      ensureUser({}).catch(() => {
        // User not authenticated
      });
    }
  }, [authReady, user, ensureUser]);

  const handleStartChat = async (otherUserId: Id<"users">) => {
    try {
      const conversationId = await createConversation({ otherUserId });
      router.push(`/chat/${conversationId}`);
    } catch (error) {
      console.error("Failed to start conversation:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link
            href="/chat"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          
          <div className="flex-1">
            <h1 className="text-xl font-bold text-gray-800">Find Users</h1>
          </div>

          <UserButton afterSignOutUrl="/" />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Search Bar */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search users by name..."
              className="w-full pl-12 pr-4 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent shadow-sm"
            />
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-800">
              {searchTerm ? `Results for "${searchTerm}"` : "All Users"}
            </h2>
          </div>

          {hasConvexAuthError ? (
            <div className="p-8 text-center">
              <p className="text-gray-700 font-medium mb-2">Cannot authenticate with Convex</p>
              <p className="text-sm text-gray-500">
                Check Clerk + Convex JWT settings (`CLERK_JWT_ISSUER_DOMAIN` and app ID `convex`).
              </p>
            </div>
          ) : users === undefined ? (
            <div className="p-8 text-center">
              <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-500">
                {searchTerm ? "No users found" : "No other users yet"}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {users.map((u: Doc<"users">) => (
                <div
                  key={u._id}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                      {u.username?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">{u.username}</h3>
                      <p className="text-sm text-gray-500">
                        Joined {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleStartChat(u._id)}
                    className="p-3 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                    title="Start conversation"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
