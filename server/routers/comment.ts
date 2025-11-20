import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { eq, desc } from "drizzle-orm";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "../trpc";
import { db } from "@/lib/db";
import { comments, frames, users } from "@/lib/db/schema";

/**
 * Simple in-memory rate limiter for comment creation
 * Limits to 1 comment per 5 seconds per user/session
 */
const commentRateLimitMap = new Map<string, number>();
const COMMENT_RATE_LIMIT_MS = 5000; // 5 seconds

/**
 * Rate limiting middleware for comment creation
 */
const commentRateLimitMiddleware = publicProcedure.use(
  async ({ ctx, next }) => {
    const identifier = ctx.userId || `anon-${Date.now()}-${Math.random()}`;
    const now = Date.now();
    const lastComment = commentRateLimitMap.get(identifier);

    if (lastComment && now - lastComment < COMMENT_RATE_LIMIT_MS) {
      const remainingMs = COMMENT_RATE_LIMIT_MS - (now - lastComment);
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: `Please wait ${Math.ceil(
          remainingMs / 1000
        )} seconds before commenting again.`,
      });
    }

    commentRateLimitMap.set(identifier, now);

    // Clean up old entries periodically
    if (commentRateLimitMap.size > 1000) {
      for (const [key, timestamp] of commentRateLimitMap.entries()) {
        if (now - timestamp > COMMENT_RATE_LIMIT_MS * 2) {
          commentRateLimitMap.delete(key);
        }
      }
    }

    return next();
  }
);

/**
 * Comment router - handles comment CRUD operations
 * Supports both authenticated users and anonymous guests
 */
export const commentRouter = createTRPCRouter({
  /**
   * List all comments for a specific frame
   * Public query - no authentication required
   */
  listByFrame: publicProcedure
    .input(
      z.object({
        frameId: z.string(),
      })
    )
    .query(async ({ input }) => {
      // Fetch comments for the frame, ordered by creation time (newest first)
      const frameComments = await db.query.comments.findMany({
        where: eq(comments.frameId, input.frameId),
        orderBy: [desc(comments.createdAt)],
        with: {
          user: {
            columns: {
              id: true,
              email: true,
              profilePicUrl: true,
            },
          },
        },
      });

      return frameComments;
    }),

  /**
   * Create a new comment
   * Public procedure with rate limiting - authentication optional
   * Authenticated users get their name/picture, guests get "Anonymous Visitor"
   */
  create: commentRateLimitMiddleware
    .input(
      z.object({
        frameId: z.string(),
        content: z
          .string()
          .min(1)
          .max(500, "Comment must be 500 characters or less"),
        authorName: z.string().optional(), // For guests
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Check if frame exists
      const frame = await db.query.frames.findFirst({
        where: eq(frames.id, input.frameId),
      });

      if (!frame) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Frame not found",
        });
      }

      // Determine author details
      let authorName = "Anonymous Visitor";
      let authorProfilePic: string | null = null;
      let userId: string | null = null;

      if (ctx.userId) {
        // Authenticated user - fetch their details
        const user = await db.query.users.findFirst({
          where: eq(users.clerkId, ctx.userId),
        });

        if (user) {
          userId = user.id;
          authorName = user.email.split("@")[0] || "Museum Visitor"; // Use email prefix as display name
          authorProfilePic = user.profilePicUrl;
        }
      } else if (input.authorName) {
        // Guest provided a name
        authorName = input.authorName.substring(0, 50); // Limit guest names
      }

      // Create comment
      const [newComment] = await db
        .insert(comments)
        .values({
          frameId: input.frameId,
          userId,
          authorName,
          authorProfilePic,
          content: input.content,
        })
        .returning();

      return newComment;
    }),

  /**
   * Delete a comment
   * Protected procedure - only comment owner or museum owner can delete
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

      // Get comment with frame and museum info
      const comment = await db.query.comments.findFirst({
        where: eq(comments.id, input.id),
        with: {
          frame: {
            with: {
              museum: true,
            },
          },
        },
      });

      if (!comment) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Comment not found",
        });
      }

      // Check if user is comment owner or museum owner
      const isCommentOwner = comment.userId === user.id;
      const isMuseumOwner = comment.frame.museum.userId === user.id;

      if (!isCommentOwner && !isMuseumOwner) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to delete this comment",
        });
      }

      // Delete comment
      await db.delete(comments).where(eq(comments.id, input.id));

      return { success: true, id: input.id };
    }),
});
