# Real-Time Chat Messaging App

Production-style live chat web app built with:

- Next.js App Router (TypeScript strict mode)
- Convex (database, backend functions, realtime subscriptions)
- Clerk (email + social auth)
- Tailwind CSS + shadcn/ui-style component layer

# Live Preview:
   - [NeonChats](https://neonchats.vercel.app)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

```bash
cp .env.local.example .env.local
```

3. Fill these values:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL`
- `CLERK_JWT_ISSUER_DOMAIN`

4. Start Convex and Next.js:

```bash
npx convex dev
npm run dev
```

5. Open `http://localhost:3000`.

## Convex Schema

Defined in `convex/schema.ts`:

- `users`: `clerkId`, `name`, `email`, `imageUrl`, `isOnline`, `lastSeen`
- `conversations`: `participants`, `lastMessageId`, `lastMessageTime`, `isGroup`, `groupName`, `groupCreatedBy`
- `messages`: `conversationId`, `senderId`, `content`, `createdAt`, `isDeleted`, `reactions`
- `typingIndicators`: `conversationId`, `userId`, `updatedAt`
- `messageReads`: `conversationId`, `userId`, `lastReadMessageId`

## Feature Coverage

- Auth-protected app routes (`/chat`, `/chat/[conversationId]`, `/users`)
- Convex user sync from Clerk
- Realtime user list + client-side search
- Direct messages + optional group conversations
- Message timestamps with day/year-aware formatting
- Empty states for conversations, messages, and search
- Desktop + mobile responsive layout behavior
- Online/offline presence + live indicators
- Typing indicators (2s active window + clear on send)
- Unread badge counts from `messageReads`
- Smart auto-scroll + floating "new messages" button
- Soft delete for own messages
- Emoji reaction toggles and grouped counts
- Loading skeletons, inline send retry, route-level error boundary

## File Structure

```text
app/
  (app)/
    chat/
      [conversationId]/page.tsx
      error.tsx
      loading.tsx
      page.tsx
    layout.tsx
    users/page.tsx
  (auth)/
    sign-in/[[...sign-in]]/page.tsx
    sign-up/[[...sign-up]]/page.tsx
  ConvexClientProvider.tsx
  globals.css
  layout.tsx
  page.tsx
components/
  chat/
    chat-client.tsx
  ui/
    avatar.tsx
    badge.tsx
    button.tsx
    dialog.tsx
    input.tsx
    skeleton.tsx
    textarea.tsx
convex/
  auth.config.ts
  conversations.ts
  messages.ts
  schema.ts
  typingIndicators.ts
  users.ts
lib/
  time.ts
  utils.ts
middleware.ts
components.json
```
