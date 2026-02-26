# Realtime Chat – Next.js + Convex + Clerk

Realtime one-to-one messaging web app built with:

- **Next.js App Router** (TypeScript)
- **Convex** for data storage and realtime queries
- **Clerk** for authentication and user management
- **Tailwind CSS** for styling

## Architecture

- **Frontend**: Next.js app in `web/` using the App Router under `app/`.
- **Auth**: Clerk wraps the app in `app/layout.tsx`, with sign-in/up routes in `app/(auth)/`.
- **Backend**: Convex functions in `convex/` for users, conversations, and messages.
- **Realtime**: React components use `convex/react` hooks to subscribe to Convex queries in real time.

### Data model

Defined in `convex/schema.ts`:

- `users`: Clerk-linked users (Clerk id, username, avatar, timestamps).
- `conversations`: One-to-one conversations with participant user ids.
- `messages`: Messages linked to a conversation and sender, with timestamps and `seenBy`.

## Key paths

- `app/layout.tsx`: Wraps the app with `ClerkProvider` and `ConvexProviderWithClerk`.
- `middleware.ts`: Protects app routes with Clerk.
- `app/page.tsx`: Landing page with sign-in / open chat actions.
- `app/(auth)/sign-in/[[...sign-in]]/page.tsx`, `app/(auth)/sign-up/[[...sign-up]]/page.tsx`: Clerk auth UIs.
- `app/(app)/layout.tsx`: Auth-protected layout using `SignedIn` / `SignedOut`.
- `app/(app)/chat/page.tsx`: Conversation list and “Find users” entry point.
- `app/(app)/chat/[conversationId]/page.tsx`: Realtime chat view for a conversation.
- `app/(app)/users/page.tsx`: User directory to search and start conversations.
- `convex/users.ts`: Ensures the current Clerk user exists, lists users.
- `convex/conversations.ts`: Lists conversations, creates/fetches a one-to-one conversation.
- `convex/messages.ts`: Lists messages for a conversation, sends messages.

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CONVEX_URL` (from your Convex deployment or `npx convex dev`)

## Running locally

From the `web` directory:

```bash
npm install

# In one terminal: run Convex dev (after logging in once via CLI)
npx convex dev

# In another terminal: run Next.js
npm run dev
```

Then open `http://localhost:3000` in your browser.

## Video-style walkthrough script

See `docs/chat-walkthrough.md` for a short script you can follow while recording a presentation:

- High-level stack overview.
- Auth flow with Clerk.
- Convex data model and realtime queries.
- Frontend chat UI and how it connects to Convex.

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
