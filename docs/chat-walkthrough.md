# Realtime Chat – Video Walkthrough Script

Use this outline as a short script when recording your presentation.

## 1. Intro (10–15 seconds)

- “This is a realtime one-to-one chat app built with Next.js, Convex, and Clerk.”
- “Users can sign up, find other users, and exchange messages that stream in live.”

## 2. Tech stack overview (20–30 seconds)

- “On the frontend I’m using the Next.js App Router with TypeScript and Tailwind for styling.”
- “Authentication is powered by Clerk, which gives me hosted sign-in and sign-up pages and handles sessions.”
- “Convex is my backend and database; it stores users, conversations, and messages and exposes them through realtime queries.”

## 3. Data model in Convex (30–40 seconds)

- Show `convex/schema.ts` and explain:
  - “`users` links each record to a Clerk user id, plus a display name and avatar.”
  - “`conversations` holds the participant user ids and a `lastMessageAt` timestamp.”
  - “`messages` stores each message with its conversation id, sender, text, and timestamps.”
- Mention that Convex automatically keeps React queries in sync when these tables change.

## 4. Auth and providers (20–30 seconds)

- Open `app/layout.tsx`:
  - “At the root I wrap everything in `ClerkProvider` and `ConvexProviderWithClerk` so components can access auth and Convex.”
- Open `middleware.ts`:
  - “The middleware protects app routes so chat pages require authentication, while sign-in and sign-up stay public.”
- Open `app/(auth)/sign-in` / `sign-up`:
  - “These use Clerk’s prebuilt components for a quick, polished auth experience.”

## 5. Realtime backend functions (30–40 seconds)

- Open `convex/users.ts`:
  - “`ensureCurrentUser` runs when a user hits the app to make sure they have a row in the `users` table.”
  - “`listUsers` returns everyone except the current user, with optional search.”
- Open `convex/conversations.ts`:
  - “`listConversations` returns all conversations for the current user plus their latest message.”
  - “`getOrCreateConversation` either finds or creates a one-to-one conversation with another user.”
- Open `convex/messages.ts`:
  - “`listMessages` streams messages for a conversation in ascending order.”
  - “`sendMessage` validates the sender is a participant, writes the new message, and updates `lastMessageAt`.”

## 6. Frontend chat experience (40–60 seconds)

- Open `app/page.tsx`:
  - “The landing page branches on auth: signed-out users see sign-in and sign-up buttons, signed-in users get a shortcut into chat.”
- Open `app/(app)/chat/page.tsx`:
  - “Here I call `api.conversations.listConversations` using Convex’s `useQuery` hook, so the list automatically updates when new messages arrive.”
  - “There’s also a link to the Users page for starting new conversations.”
- Open `app/(app)/users/page.tsx`:
  - “This page calls `api.users.listUsers` and lets you search by name; clicking a user runs `getOrCreateConversation` and navigates into the chat.”
- Open `app/(app)/chat/[conversationId]/page.tsx`:
  - “The conversation view subscribes to `listMessages`, scrolls to the bottom when new messages arrive, and uses `sendMessage` when you hit Enter or click Send.”
  - “Because Convex queries are realtime, both participants see new messages instantly without any manual polling.”

## 7. Wrap-up (10–15 seconds)

- “In summary, Next.js and Tailwind handle the UI, Clerk handles auth, and Convex gives me a realtime backend with very little boilerplate.”
- “Together they create a clean developer experience for building live chat features like this one.”

