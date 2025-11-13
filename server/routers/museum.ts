import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, and } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";
import { createTRPCRouter, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { museums, frames, users } from "@/lib/db/schema";

/**
 * Museum router - handles museum CRUD operations
 * All routes require authentication
 */
export const museumRouter = createTRPCRouter({
  /**
   * List all museums for the authenticated user
   */
  list: protectedProcedure.query(async ({ ctx }) => {
    // First, ensure user exists in database
    const user = await db.query.users.findFirst({
      where: eq(users.clerkId, ctx.userId),
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found in database",
      });
    }

    const userMuseums = await db.query.museums.findMany({
      where: eq(museums.userId, user.id),
      orderBy: (museums, { desc }) => [desc(museums.createdAt)],
    });

    return userMuseums;
  }),

  /**
   * Create a new museum with default structure
   * Creates Main Hall with 9 empty frames and Extendable Hall with 1 frame
   */
  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100).optional().default("My Museum"),
        themeMode: z.enum(["day", "night"]).optional().default("day"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Create museum
      const [museum] = await db
        .insert(museums)
        .values({
          userId: user.id,
          name: input.name,
          themeMode: input.themeMode,
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

      return museum;
    }),

  /**
   * Get museum by ID with all frames
   */
  getById: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      const museum = await db.query.museums.findFirst({
        where: and(eq(museums.id, input.id), eq(museums.userId, user.id)),
        with: {
          frames: {
            orderBy: (frames, { asc }) => [asc(frames.position)],
          },
        },
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      return museum;
    }),

  /**
   * Update museum name and public status
   */
  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).max(100).optional(),
        isPublic: z.boolean().optional(),
        themeMode: z.enum(["day", "night"]).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Verify ownership
      const museum = await db.query.museums.findFirst({
        where: and(eq(museums.id, input.id), eq(museums.userId, user.id)),
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      // Build update object with only provided fields
      const updateData: {
        name?: string;
        isPublic?: boolean;
        themeMode?: string;
        updatedAt: Date;
      } = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) {
        updateData.name = input.name;
      }
      if (input.isPublic !== undefined) {
        updateData.isPublic = input.isPublic;
      }
      if (input.themeMode !== undefined) {
        updateData.themeMode = input.themeMode;
      }

      const [updatedMuseum] = await db
        .update(museums)
        .set(updateData)
        .where(eq(museums.id, input.id))
        .returning();

      return updatedMuseum;
    }),

  /**
   * Soft delete museum (for now, hard delete - can be changed to soft delete later)
   */
  delete: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Verify ownership
      const museum = await db.query.museums.findFirst({
        where: and(eq(museums.id, input.id), eq(museums.userId, user.id)),
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      // Delete museum (cascade will delete frames and comments)
      await db.delete(museums).where(eq(museums.id, input.id));

      return { success: true };
    }),

  /**
   * Generate unique share link for museum
   */
  generateShareLink: protectedProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // First, ensure user exists in database
      const user = await db.query.users.findFirst({
        where: eq(users.clerkId, ctx.userId),
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found in database",
        });
      }

      // Verify ownership
      const museum = await db.query.museums.findFirst({
        where: and(eq(museums.id, input.id), eq(museums.userId, user.id)),
      });

      if (!museum) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Museum not found or you don't have access",
        });
      }

      // Generate new share token if one doesn't exist
      const shareToken = museum.shareToken || createId();

      const [updatedMuseum] = await db
        .update(museums)
        .set({
          shareToken,
          updatedAt: new Date(),
        })
        .where(eq(museums.id, input.id))
        .returning();

      return {
        shareToken: updatedMuseum.shareToken,
        shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || ""}/museum/${updatedMuseum.shareToken}`,
      };
    }),
});
