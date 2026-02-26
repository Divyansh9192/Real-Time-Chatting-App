import { ChatClient } from "@/components/chat/chat-client";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  return <ChatClient conversationId={conversationId} />;
}
