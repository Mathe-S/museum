import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { users, museums, frames } from "@/lib/db/schema";

/**
 * Helper function to ensure user exists in database
 * Creates user and default museum if they don't exist
 */
async function ensureUserExists(clerkId: string, email?: string) {
  let user = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkId),
  });

  if (!user) {
    // Create user
    [user] = await db
      .insert(users)
      .values({
        clerkId,
        email: email || `${clerkId}@temp.com`, // Fallback email
      })
      .returning();

    // Create default museum for new user
    const [museum] = await db
      .insert(museums)
      .values({
        userId: user.id,
        name: "My Museum",
        themeMode: "day",
      })
      .returning();

    // Create 9 frames for Main Hall (positions 0-8)
    const mainHallFrames = Array.from({ length: 9 }, (_, i) => ({
      museumId: museum.id,
      position: i,
      side: null,
    }));

    // Create 1 frame for Extendable Hall (position 9, left side)
    const extendableHallFrame = {
      museumId: museum.id,
      position: 9,
      side: "left",
    };

    await db.insert(frames).values([...mainHallFrames, extendableHallFrame]);
  }

  return user;
}

/**
 * User router - handles user profile operations
 * All routes require authentication
 */
export const userRouter = createTRPCRouter({
  /**
   * Get current user profile
   */
  getProfile: protectedProcedure.query(async ({ ctx }) => {
    // Ensure user exists in database (creates user + default museum if needed)
    const user = await ensureUserExists(ctx.userId, ctx.userEmail);
    return user;
  }),

  /**
   * Dismiss tutorial for the current user
   */
  dismissTutorial: protectedProcedure.mutation(async ({ ctx }) => {
    // Ensure user exists in database
    const user = await ensureUserExists(ctx.userId, ctx.userEmail);

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
