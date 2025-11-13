import { createTRPCRouter } from "./trpc";
import { museumRouter } from "./routers/museum";
import { frameRouter } from "./routers/frame";
import { imageRouter } from "./routers/image";

/**
 * Root tRPC router
 * Add individual routers here as they are created
 */
export const appRouter = createTRPCRouter({
  museum: museumRouter,
  frame: frameRouter,
  image: imageRouter,
});

export type AppRouter = typeof appRouter;
