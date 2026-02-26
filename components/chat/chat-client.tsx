"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageCircle, Plus, Search, Send, Trash2, Users } from "lucide-react";
import { UserButton, useUser } from "@clerk/nextjs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLastSeen, formatMessageTimestamp } from "@/lib/time";
import { cn } from "@/lib/utils";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢"] as const;
type MessageReaction = { userId: Id<"users">; emoji: string };

interface ChatClientProps {
  conversationId?: string;
}

type DisplayIdentity = {
  name?: string | null;
  emailHandle?: string | null;
  userId?: Id<"users"> | string | null;
};

function normalizeDisplayName(name?: string | null) {
  const normalized = name?.trim();
  return normalized || "Unknown User";
}

function getUserIdSuffix(userId?: Id<"users"> | string | null) {
  if (!userId) {
    return "user";
  }
  const raw = String(userId);
  return raw.slice(-4);
}

function buildDisplayLabel(identity: DisplayIdentity, duplicateNames: Set<string>) {
  const name = normalizeDisplayName(identity.name);
  const duplicateKey = name.toLowerCase();
  if (!duplicateNames.has(duplicateKey)) {
    return name;
  }

  const emailHandle = identity.emailHandle?.trim().toLowerCase();
  if (emailHandle) {
    return `${name}`;
  }

  return `${name} (${getUserIdSuffix(identity.userId)})`;
}

export function ChatClient({ conversationId }: ChatClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const selectedConversationId = conversationId as Id<"conversations"> | undefined;
  const me = useQuery(api.users.me, {});
  const users = useQuery(api.users.listUsers, {});
  const conversations = useQuery(api.conversations.listForSidebar, {});
  const selectedConversationSummary = useMemo(() => {
    if (!conversations || !selectedConversationId) {
      return null;
    }
    return (
      conversations.find((row) => row.conversationId === selectedConversationId) ??
      null
    );
  }, [conversations, selectedConversationId]);
  const isGroupConversation = Boolean(selectedConversationSummary?.isGroup);
  const messages = useQuery(
    api.messages.listByConversation,
    selectedConversationId && selectedConversationSummary
      ? { conversationId: selectedConversationId }
      : "skip"
  );
  const typingRows = useQuery(
    api.typingIndicators.listForConversation,
    selectedConversationId && selectedConversationSummary
      ? { conversationId: selectedConversationId }
      : "skip"
  );

  const ensureCurrentUser = useMutation(api.users.ensureCurrentUser);
  const setPresence = useMutation(api.users.setPresence);
  const getOrCreateDirect = useMutation(api.conversations.getOrCreateDirect);
  const createGroup = useMutation(api.conversations.createGroup);
  const sendMessage = useMutation(api.messages.send);
  const markAsRead = useMutation(api.messages.markAsRead);
  const softDelete = useMutation(api.messages.softDelete);
  const toggleReaction = useMutation(api.messages.toggleReaction);
  const upsertTyping = useMutation(api.typingIndicators.upsert);
  const clearTyping = useMutation(api.typingIndicators.clear);
  const deleteConversation = useMutation(api.conversations.deleteConversation);

  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isDeletingConversation, setIsDeletingConversation] = useState(false);
  const [showJumpToLatest, setShowJumpToLatest] = useState(false);
  const [isNearBottom, setIsNearBottom] = useState(true);
  const [clockMs, setClockMs] = useState(Date.now());
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupMemberIds, setGroupMemberIds] = useState<Array<Id<"users">>>([]);
  const [groupError, setGroupError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef(0);
  const lastTypingPingRef = useRef(0);

  const clerkName =
    user?.fullName?.trim() ||
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    undefined;
  const clerkEmail =
    user?.primaryEmailAddress?.emailAddress ||
    user?.emailAddresses?.[0]?.emailAddress ||
    undefined;
  const clerkImageUrl = user?.imageUrl || undefined;

  const pingTyping = () => {
    if (!selectedConversationId) {
      return;
    }
    const now = Date.now();
    if (now - lastTypingPingRef.current > 300) {
      lastTypingPingRef.current = now;
      upsertTyping({ conversationId: selectedConversationId }).catch(() => undefined);
    }
  };

  useEffect(() => {
    ensureCurrentUser({
      name: clerkName,
      email: clerkEmail,
      imageUrl: clerkImageUrl,
    }).catch(() => undefined);
    setPresence({ isOnline: true }).catch(() => undefined);

    const handleVisibility = () => {
      const isVisible = document.visibilityState === "visible";
      setPresence({ isOnline: isVisible }).catch(() => undefined);
    };
    const handleBeforeUnload = () => {
      setPresence({ isOnline: false }).catch(() => undefined);
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("beforeunload", handleBeforeUnload);
    const heartbeat = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setPresence({ isOnline: true }).catch(() => undefined);
      }
    }, 15000);

    return () => {
      window.clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      setPresence({ isOnline: false }).catch(() => undefined);
    };
  }, [ensureCurrentUser, setPresence, clerkName, clerkEmail, clerkImageUrl]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockMs(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const pending =
      typeof window !== "undefined"
        ? window.sessionStorage.getItem("chat_delete_success")
        : null;
    if (!pending) {
      return;
    }
    setBannerMessage(pending);
    window.sessionStorage.removeItem("chat_delete_success");
    const timeout = window.setTimeout(() => setBannerMessage(null), 4000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!selectedConversationId || conversations === undefined) {
      return;
    }
    if (!selectedConversationSummary) {
      router.replace("/chat");
    }
  }, [selectedConversationId, conversations, selectedConversationSummary, router]);

  const filteredUsers = useMemo(() => {
    if (!users) {
      return [];
    }
    const term = search.trim().toLowerCase();
    if (!term) {
      return users;
    }
    return users.filter((user) => user.name.toLowerCase().includes(term));
  }, [users, search]);

  const activeTypers = useMemo(() => {
    if (!typingRows) {
      return [];
    }

    const freshRows = typingRows.filter((row) => clockMs - row.updatedAt < 2000);
    const dedupedByUser = new Map(
      freshRows.map((row) => [String(row.userId), row])
    );
    return Array.from(dedupedByUser.values());
  }, [typingRows, clockMs]);

  const duplicateGroupNameKeys = useMemo(() => {
    if (!isGroupConversation) {
      return new Set<string>();
    }

    const counts = new Map<string, number>();
    const addName = (name?: string | null) => {
      const key = normalizeDisplayName(name).toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    };

    selectedConversationSummary?.participants?.forEach((participant) => {
      addName(participant.name);
    });
    messages?.forEach((entry) => {
      addName(entry.senderName);
    });
    typingRows?.forEach((row) => {
      addName(row.userName);
    });

    return new Set(
      Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => key)
    );
  }, [isGroupConversation, selectedConversationSummary, messages, typingRows]);

  const typingIndicatorText = useMemo(() => {
    if (activeTypers.length === 0) {
      return "";
    }

    const labels = activeTypers.map((row) =>
      buildDisplayLabel(
        {
          name: row.userName,
          emailHandle: row.userEmailHandle,
          userId: row.userId,
        },
        duplicateGroupNameKeys
      )
    );

    if (labels.length === 1) {
      return `${labels[0]} is typing...`;
    }
    if (!isGroupConversation) {
      return `${labels[0]} is typing...`;
    }
    if (labels.length === 2) {
      return `${labels[0]}, ${labels[1]} are typing...`;
    }
    return `${labels[0]}, ${labels[1]} +${labels.length - 2} more are typing...`;
  }, [activeTypers, duplicateGroupNameKeys, isGroupConversation]);

  const handleOpenConversation = (id: Id<"conversations">) => {
    router.push(`/chat/${id}`);
  };

  const handleOpenOrCreateDirect = async (userId: Id<"users">) => {
    const id = await getOrCreateDirect({ otherUserId: userId });
    router.push(`/chat/${id}`);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    scroller.scrollTo({
      top: scroller.scrollHeight,
      behavior,
    });
    setShowJumpToLatest(false);
  };

  useEffect(() => {
    previousMessageCountRef.current = 0;
    setShowJumpToLatest(false);
    if (selectedConversationId) {
      requestAnimationFrame(() => scrollToBottom("auto"));
    }
  }, [selectedConversationId]);

  useEffect(() => {
    if (!messages) {
      return;
    }

    const hasNewMessages = messages.length > previousMessageCountRef.current;
    if (hasNewMessages) {
      if (isNearBottom) {
        requestAnimationFrame(() => scrollToBottom("smooth"));
      } else {
        setShowJumpToLatest(true);
      }
    }
    previousMessageCountRef.current = messages.length;
  }, [messages, isNearBottom]);

  const latestMessageId = messages?.[messages.length - 1]?._id;
  useEffect(() => {
    if (!selectedConversationId || !latestMessageId) {
      return;
    }
    markAsRead({ conversationId: selectedConversationId }).catch(() => undefined);
  }, [markAsRead, selectedConversationId, latestMessageId]);

  const handleScroll = () => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }
    const distanceFromBottom =
      scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
    const nearBottom = distanceFromBottom < 120;
    setIsNearBottom(nearBottom);
    if (nearBottom) {
      setShowJumpToLatest(false);
      if (selectedConversationId) {
        markAsRead({ conversationId: selectedConversationId }).catch(() => undefined);
      }
    }
  };

  const handleMessageChange = (value: string) => {
    setMessage(value);
    if (!selectedConversationId) {
      return;
    }

    if (!value.trim()) {
      clearTyping({ conversationId: selectedConversationId }).catch(() => undefined);
      return;
    }

    pingTyping();
  };

  const submitMessage = async (content: string) => {
    if (!selectedConversationId) {
      return;
    }
    const trimmed = content.trim();
    if (!trimmed) {
      return;
    }

    setIsSending(true);
    setSendError(null);
    try {
      await sendMessage({
        conversationId: selectedConversationId,
        content: trimmed,
      });
      setMessage("");
      clearTyping({ conversationId: selectedConversationId }).catch(() => undefined);
    } catch {
      setSendError(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (event: FormEvent) => {
    event.preventDefault();
    await submitMessage(message);
  };

  const handleToggleGroupMember = (memberId: Id<"users">) => {
    setGroupMemberIds((current) =>
      current.includes(memberId)
        ? current.filter((id) => id !== memberId)
        : [...current, memberId]
    );
  };

  const handleCreateGroup = async () => {
    setGroupError(null);
    try {
      const conversationId = await createGroup({
        groupName,
        memberIds: groupMemberIds,
      });
      setGroupName("");
      setGroupMemberIds([]);
      setIsGroupDialogOpen(false);
      router.push(`/chat/${conversationId}`);
    } catch {
      setGroupError("Group creation failed. Pick at least one person and try again.");
    }
  };

  const handleDeleteConversation = async () => {
    if (!selectedConversationId || isDeletingConversation) {
      return;
    }

    setDeleteError(null);
    setIsDeletingConversation(true);
    try {
      await clearTyping({ conversationId: selectedConversationId }).catch(() => undefined);
      await deleteConversation({ conversationId: selectedConversationId });

      setMessage("");
      setSendError(null);
      setShowJumpToLatest(false);
      setIsNearBottom(true);
      setIsDeleteDialogOpen(false);

      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          "chat_delete_success",
          "Chat deleted for everyone."
        );
      }
      router.replace("/chat");
    } catch {
      setDeleteError("Failed to delete this chat. Please try again.");
    } finally {
      setIsDeletingConversation(false);
    }
  };

  const conversationPanelVisible = Boolean(selectedConversationId);

  return (
    <div className="h-screen bg-slate-100 md:flex">
      <aside
        className={cn(
          "h-full w-full border-r border-slate-200 bg-white md:block md:w-[300px] md:min-w-[300px]",
          conversationPanelVisible && "hidden md:block"
        )}
      >
        <div className="border-b border-slate-200 px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-sky-600" />
              <p className="text-base font-semibold text-slate-900">NeonChats</p>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
            <Avatar
              src={me?.imageUrl}
              alt={me?.name ?? "Me"}
              fallback={(me?.name ?? "ME").slice(0, 2).toUpperCase()}
              className="h-8 w-8 text-xs"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-800">
                {me?.name ?? "Loading..."}
              </p>
              <p className="truncate text-xs text-slate-500">{me?.email ?? ""}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-3">
          {bannerMessage && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              {bannerMessage}
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search users..."
              className="pl-9"
            />
          </div>

          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setIsGroupDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Group
          </Button>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Conversations
            </p>
            <div className="max-h-[36vh] space-y-1 overflow-y-auto">
              {!conversations ? (
                <>
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                  <Skeleton className="h-14 w-full" />
                </>
              ) : conversations.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  Start a conversation by selecting a user →
                </p>
              ) : (
                conversations.map((item) => (
                  <button
                    key={item.conversationId}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50",
                      selectedConversationId === item.conversationId && "bg-slate-100"
                    )}
                    onClick={() => handleOpenConversation(item.conversationId)}
                  >
                    <div className="relative">
                      <Avatar
                        src={item.avatarUrl}
                        alt={item.title}
                        fallback={item.title.slice(0, 2).toUpperCase()}
                        className="h-9 w-9"
                      />
                      {!item.isGroup && item.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {item.title}
                        </p>
                        {item.lastMessageTime > 0 && (
                          <span className="text-[11px] text-slate-400">
                            {formatMessageTimestamp(item.lastMessageTime)}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {item.lastMessagePreview || "No messages yet"}
                      </p>
                    </div>
                    {item.unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-semibold text-white">
                        {item.unreadCount}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </section>

          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              People
            </p>
            <div className="max-h-[30vh] space-y-1 overflow-y-auto">
              {!users ? (
                <>
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </>
              ) : filteredUsers.length === 0 ? (
                <p className="rounded-md border border-dashed border-slate-300 p-3 text-sm text-slate-500">
                  No users found for &quot;{search}&quot;
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <button
                    key={user._id}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-slate-50"
                    onClick={() => handleOpenOrCreateDirect(user._id)}
                  >
                    <div className="relative">
                      <Avatar
                        src={user.imageUrl}
                        alt={user.name}
                        fallback={user.name.slice(0, 2).toUpperCase()}
                        className="h-8 w-8 text-xs"
                      />
                      {user.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-800">{user.name}</p>
                      <p className="truncate text-xs text-slate-500">
                        {user.isOnline ? "Online" : formatLastSeen(user.lastSeen)}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </aside>

      <section
        className={cn(
          "hidden h-full flex-1 flex-col md:flex",
          conversationPanelVisible && "flex"
        )}
      >
        {!selectedConversationId ? (
          <div className="flex h-full items-center justify-center p-6">
            <div className="max-w-sm rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
              <MessageCircle className="mx-auto mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm text-slate-600">
                Start a conversation by selecting a user →
              </p>
            </div>
          </div>
        ) : !messages || !selectedConversationSummary ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="h-8 w-40 animate-pulse rounded bg-slate-200" />
            </div>
            <div className="flex flex-1 items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" />
            </div>
          </div>
        ) : (
          <>
            <header className="border-b border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={() => router.push("/chat")}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                  <div className="relative">
                    <Avatar
                      src={selectedConversationSummary.avatarUrl}
                      alt={selectedConversationSummary.title}
                      fallback={selectedConversationSummary.title.slice(0, 2).toUpperCase()}
                      className="h-10 w-10"
                    />
                    {!selectedConversationSummary.isGroup &&
                      selectedConversationSummary.isOnline && (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                      )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {selectedConversationSummary.title}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {selectedConversationSummary.isGroup
                        ? `${selectedConversationSummary.memberCount} members`
                        : selectedConversationSummary.isOnline
                          ? "Online"
                          : formatLastSeen(selectedConversationSummary.lastSeen)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setDeleteError(null);
                      setIsDeleteDialogOpen(true);
                    }}
                    disabled={isDeletingConversation}
                    title="Delete chat"
                  >
                    <Trash2 className="h-4 w-4 text-rose-600" />
                  </Button>
                  <UserButton afterSignOutUrl="/" />
                </div>
              </div>
            </header>

            <div
              ref={scrollerRef}
              className="relative flex-1 overflow-y-auto bg-slate-50 px-4 py-4"
              onScroll={handleScroll}
            >
              {messages.length === 0 ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-sm text-slate-500">No messages yet. Say hello! 👋</p>
                </div>
              ) : (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3">
                  {messages.map((entry) => {
                    const groupedReactions = REACTIONS.map((emoji) => {
                      const usersForEmoji = (entry.reactions as MessageReaction[]).filter(
                        (reaction) => reaction.emoji === emoji
                      );
                      return {
                        emoji,
                        count: usersForEmoji.length,
                        reactedByMe: usersForEmoji.some(
                          (reaction) => reaction.userId === me?._id
                        ),
                      };
                    }).filter((group) => group.count > 0);
                    const senderLabel = buildDisplayLabel(
                      {
                        name: entry.senderName,
                        emailHandle: entry.senderEmailHandle,
                        userId: entry.senderId,
                      },
                      duplicateGroupNameKeys
                    );

                    return (
                      <div
                        key={entry._id}
                        className={cn(
                          "group flex",
                          entry.isOwnMessage ? "justify-end" : "justify-start"
                        )}
                      >
                        <div
                          className={cn(
                            "flex w-full items-end gap-2",
                            entry.isOwnMessage ? "flex-row-reverse" : "flex-row"
                          )}
                        >
                          {isGroupConversation && (
                            <Avatar
                              src={entry.senderImageUrl}
                              alt={senderLabel}
                              fallback={senderLabel.slice(0, 2).toUpperCase()}
                              className="h-7 w-7 shrink-0 text-[10px]"
                            />
                          )}
                          <div className="relative w-fit min-w-[8rem] max-w-[80%]">
                            {!entry.isDeleted && (
                              <div className="pointer-events-none absolute -top-8 right-0 z-10 flex gap-1 rounded-md border border-slate-200 bg-white p-1 opacity-0 shadow transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
                                {REACTIONS.map((emoji) => (
                                  <button
                                    key={`${entry._id}-${emoji}`}
                                    className="rounded px-1.5 py-0.5 text-sm hover:bg-slate-100"
                                    onClick={() =>
                                      toggleReaction({ messageId: entry._id, emoji })
                                    }
                                  >
                                    {emoji}
                                  </button>
                                ))}
                                {entry.isOwnMessage && (
                                  <button
                                    className="rounded p-1 text-rose-600 hover:bg-rose-50"
                                    onClick={() => softDelete({ messageId: entry._id })}
                                    title="Delete message"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            )}

                            <div
                              className={cn(
                                "rounded-2xl px-3 py-2 text-sm shadow-sm",
                                entry.isOwnMessage
                                  ? "rounded-br-md bg-sky-600 text-white"
                                  : "rounded-bl-md bg-white text-slate-800"
                              )}
                            >
                              {isGroupConversation && (
                                <p
                                  className={cn(
                                    "mb-1 text-[11px] font-medium",
                                    entry.isOwnMessage ? "text-sky-100" : "text-slate-500"
                                  )}
                                >
                                  {senderLabel}
                                </p>
                              )}
                              {entry.isDeleted ? (
                                <p className="italic text-slate-400">This message was deleted</p>
                              ) : (
                                <p className="whitespace-pre-wrap break-words">
                                  {entry.content}
                                </p>
                              )}
                              <p
                                className={cn(
                                  "mt-1 whitespace-nowrap text-[11px]",
                                  entry.isOwnMessage ? "text-sky-100" : "text-slate-400"
                                )}
                              >
                                {formatMessageTimestamp(entry.createdAt)}
                              </p>
                            </div>

                            {groupedReactions.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {groupedReactions.map((group) => (
                                  <button
                                    key={`${entry._id}-count-${group.emoji}`}
                                    className={cn(
                                      "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs",
                                      group.reactedByMe
                                        ? "border-sky-300 bg-sky-50 text-sky-700"
                                        : "border-slate-200 bg-white text-slate-600"
                                    )}
                                    onClick={() =>
                                      toggleReaction({
                                        messageId: entry._id,
                                        emoji: group.emoji,
                                      })
                                    }
                                  >
                                    <span>{group.emoji}</span>
                                    <span>{group.count}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {showJumpToLatest && (
                <button
                  onClick={() => scrollToBottom("smooth")}
                  className="fixed bottom-24 right-4 rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-sky-700 md:right-8"
                >
                  ↓ New messages
                </button>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white px-4 py-3">
              {deleteError && (
                <div className="mx-auto mb-2 w-full max-w-3xl rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {deleteError}
                </div>
              )}
              {activeTypers.length > 0 && (
                <div className="mx-auto mb-2 flex w-full max-w-3xl items-center gap-2 text-xs text-slate-500">
                  <span>{typingIndicatorText}</span>
                  <span className="inline-flex gap-1">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.2s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400 [animation-delay:-0.1s]" />
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-slate-400" />
                  </span>
                </div>
              )}
              {sendError && (
                <div className="mb-2 flex items-center justify-between rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  <span>Message failed to send.</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-rose-700 hover:bg-rose-100"
                    onClick={() => submitMessage(sendError)}
                  >
                    Retry
                  </Button>
                </div>
              )}
              <form onSubmit={handleSend} className="mx-auto flex w-full max-w-3xl gap-2">
                <Input
                  value={message}
                  onChange={(event) => handleMessageChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (
                      event.key.length === 1 ||
                      event.key === "Backspace" ||
                      event.key === "Delete"
                    ) {
                      pingTyping();
                    }
                  }}
                  onBlur={() => {
                    if (selectedConversationId) {
                      clearTyping({ conversationId: selectedConversationId }).catch(
                        () => undefined
                      );
                    }
                  }}
                  placeholder="Type a message"
                />
                <Button type="submit" disabled={isSending || !message.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </footer>
          </>
        )}
      </section>

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => {
          if (!isDeletingConversation) {
            setIsDeleteDialogOpen(false);
          }
        }}
        title="Delete this chat for everyone?"
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            This permanently deletes the full conversation thread for all
            participants. This action cannot be undone.
          </p>
          {deleteError && (
            <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              disabled={isDeletingConversation}
              onClick={() => setIsDeleteDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!selectedConversationId || isDeletingConversation}
              onClick={handleDeleteConversation}
            >
              {isDeletingConversation ? "Deleting..." : "Delete chat"}
            </Button>
          </div>
        </div>
      </Dialog>

      <Dialog
        open={isGroupDialogOpen}
        onClose={() => setIsGroupDialogOpen(false)}
        title="Create Group"
      >
        <div className="space-y-3">
          <Input
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            placeholder="Group name"
          />
          <div className="max-h-56 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-2">
            {!users ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : users.length === 0 ? (
              <p className="text-sm text-slate-500">No users available</p>
            ) : (
              users.map((user) => {
                const selected = groupMemberIds.includes(user._id);
                return (
                  <button
                    key={`group-member-${user._id}`}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md border px-2 py-2 text-left text-sm",
                      selected
                        ? "border-sky-300 bg-sky-50 text-sky-700"
                        : "border-slate-200 bg-white text-slate-700"
                    )}
                    onClick={() => handleToggleGroupMember(user._id)}
                  >
                    <span className="flex items-center gap-2">
                      <Avatar
                        src={user.imageUrl}
                        alt={user.name}
                        fallback={user.name.slice(0, 2).toUpperCase()}
                        className="h-7 w-7 text-[10px]"
                      />
                      {user.name}
                    </span>
                    {selected && <Badge>Selected</Badge>}
                  </button>
                );
              })
            )}
          </div>
          {groupError && <p className="text-xs text-rose-600">{groupError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsGroupDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={!groupName.trim() || groupMemberIds.length < 1}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Create Group
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
