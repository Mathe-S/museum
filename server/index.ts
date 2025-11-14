import { createTRPCRouter } from "./trpc";
import { museumRouter } from "./routers/museum";
import { frameRouter } from "./routers/frame";
import { imageRouter } from "./routers/image";
import { publicRouter } from "./routers/public";
import { userRouter } from "./routers/user";

/**
 * Root tRPC router
 * Add individual routers here as they are created
 */
export const appRouter = createTRPCRouter({
  museum: museumRouter,
  frame: frameRouter,
  image: imageRouter,
  public: publicRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;
