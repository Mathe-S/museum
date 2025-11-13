import { createTRPCRouter } from "./trpc";
import { museumRouter } from "./routers/museum";
import { frameRouter } from "./routers/frame";

/**
 * Root tRPC router
 * Add individual routers here as they are created
 */
export const appRouter = createTRPCRouter({
  museum: museumRouter,
  frame: frameRouter,
});

export type AppRouter = typeof appRouter;
