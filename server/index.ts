import { createTRPCRouter } from "./trpc";

/**
 * Root tRPC router
 * Add individual routers here as they are created
 */
export const appRouter = createTRPCRouter({
  // Routers will be added here as they are implemented
  // Example: museum: museumRouter,
});

export type AppRouter = typeof appRouter;
