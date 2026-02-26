import type { AuthConfig } from "convex/server";

// Configure Convex to trust Clerk-issued JWTs.
// Make sure CLERK_JWT_ISSUER_DOMAIN is set in your Convex deployment
// or in your local `.env` used by `npx convex dev`.
export default {
  providers: [
    {
      // e.g. https://your-app.clerk.accounts.dev
      domain: process.env.CLERK_JWT_ISSUER_DOMAIN!,
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
