import { createTRPCRouter } from "./trpc";
import { museumRouter } from "./routers/museum";

/**
 * Root tRPC router
 * Add individual routers here as they are created
 */
export const appRouter = createTRPCRouter({
  museum: museumRouter,
});

export type AppRouter = typeof appRouter;
