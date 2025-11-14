import { initTRPC, TRPCError } from "@trpc/server";
import { auth } from "@clerk/nextjs/server";
import superjson from "superjson";
import { ZodError } from "zod";

/**
 * Create tRPC context with Clerk authentication
 */
export async function createTRPCContext() {
  const authResult = await auth();
  
  // Get user email from session claims if available
  const userEmail = authResult.sessionClaims?.email as string | undefined;

  return {
    userId: authResult.userId,
    userEmail,
    auth: authResult,
  };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with context and transformer
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Export reusable router and procedure helpers
 */
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;

/**
 * Public procedure - accessible without authentication
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires authentication
 * Throws UNAUTHORIZED error if user is not authenticated
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "You must be logged in to access this resource",
    });
  }

  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId, // Type-safe userId (non-nullable)
    },
  });
});
