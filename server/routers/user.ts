import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

/**
 * User router - handles user profile operations
 * All routes require authentication
 */
export const userRouter = createTRPCRouter({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found in database",
      });
    }

    return user;
  }),

  /**
   * Dismiss tutorial for the current user
   */
  dismissTutorial: protectedProcedure.mutation(async ({ ctx }) => {
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found in database",
      });
    }

    const [updatedUser] = await db
      .update(users)
      .set({
        tutorialDismissed: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning();

    return updatedUser;
  }),
});
