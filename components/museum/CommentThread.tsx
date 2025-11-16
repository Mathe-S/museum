"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc/client";
import { useUser } from "@clerk/nextjs";
import { Trash2, Send, Loader2 } from "lucide-react";

/**
 * Format timestamp as relative time (e.g., "2 minutes ago")
 */
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? "s" : ""} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? "s" : ""} ago`;

  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? "s" : ""} ago`;
}

interface CommentThreadProps {
  frameId: string;
  onBroadcastComment?: (
    text: string,
    authorName: string,
    authorPicture?: string
  ) => void;
  onBroadcastCommentDelete?: (commentId: string) => void;
}

/**
 * CommentThread component - Displays and manages comments for a frame
 * Features:
 * - Real-time comment updates via PartyKit
 * - Optimistic UI updates
 * - Character counter (500 max)
 * - Delete permissions (owner or museum owner)
 * - Guest support
 */
export function CommentThread({
  frameId,
  onBroadcastComment,
  onBroadcastCommentDelete,
}: CommentThreadProps) {
  const { user } = useUser();
  const [commentText, setCommentText] = useState("");
  const [guestName, setGuestName] = useState("");
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useContext();

  // Fetch comments
  const { data: comments, isLoading } = trpc.comment.listByFrame.useQuery({
    frameId,
  });

  // Create comment mutation with optimistic updates
  const createCommentMutation = trpc.comment.create.useMutation({
    onMutate: async (newComment) => {
      // Cancel outgoing refetches
      await utils.comment.listByFrame.cancel({ frameId });

      // Snapshot previous value
      const previousComments = utils.comment.listByFrame.getData({ frameId });

      // Optimistically update
      const tempId = "temp-" + Date.now().toString();
      const optimisticComment = {
        id: tempId,
        frameId,
        userId: user?.id || null,
        authorName: user
          ? user.fullName || user.username || "User"
          : guestName || "Anonymous Visitor",
        authorProfilePic: user?.imageUrl || null,
        content: newComment.content,
        createdAt: new Date(),
        user: null, // Add user property to match type
      };

      utils.comment.listByFrame.setData({ frameId }, (old) => {
        if (!old) return [optimisticComment];
        return [optimisticComment, ...old];
      });

      return { previousComments };
    },
    onError: (err, newComment, context) => {
      // Rollback on error
      if (context?.previousComments) {
        utils.comment.listByFrame.setData(
          { frameId },
          context.previousComments
        );
      }
    },
    onSuccess: (data) => {
      // Broadcast to PartyKit
      if (onBroadcastComment && data) {
        onBroadcastComment(
          data.content,
          data.authorName,
          data.authorProfilePic || undefined
        );
      }
    },
    onSettled: () => {
      // Refetch to get server data
      utils.comment.listByFrame.invalidate({ frameId });
    },
  });

  // Delete comment mutation
  const deleteCommentMutation = trpc.comment.delete.useMutation({
    onMutate: async (variables) => {
      await utils.comment.listByFrame.cancel({ frameId });
      const previousComments = utils.comment.listByFrame.getData({ frameId });

      // Optimistically remove comment
      utils.comment.listByFrame.setData({ frameId }, (old) => {
        if (!old) return [];
        return old.filter((c) => c.id !== variables.id);
      });

      return { previousComments };
    },
    onError: (err, variables, context) => {
      if (context?.previousComments) {
        utils.comment.listByFrame.setData(
          { frameId },
          context.previousComments
        );
      }
    },
    onSuccess: (data) => {
      // Broadcast deletion to PartyKit
      if (onBroadcastCommentDelete && data) {
        onBroadcastCommentDelete(data.id);
      }
    },
    onSettled: () => {
      utils.comment.listByFrame.invalidate({ frameId });
    },
  });

  // Listen for PartyKit comment events
  useEffect(() => {
    const handleCommentNew = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.frameId === frameId) {
        // Invalidate to refetch and include the new comment
        utils.comment.listByFrame.invalidate({ frameId });
      }
    };

    const handleCommentDeleted = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail.frameId === frameId) {
        // Invalidate to refetch without the deleted comment
        utils.comment.listByFrame.invalidate({ frameId });
      }
    };

    window.addEventListener("partykit-comment-new", handleCommentNew);
    window.addEventListener("partykit-comment-deleted", handleCommentDeleted);

    return () => {
      window.removeEventListener("partykit-comment-new", handleCommentNew);
      window.removeEventListener(
        "partykit-comment-deleted",
        handleCommentDeleted
      );
    };
  }, [frameId, utils]);

  // Auto-scroll to bottom when new comments arrive
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments?.length]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!commentText.trim() || commentText.length > 500) return;
    if (!user && !guestName.trim()) return;

    try {
      await createCommentMutation.mutateAsync({
        frameId,
        content: commentText.trim(),
        authorName: !user ? guestName.trim() : undefined,
      });

      setCommentText("");
    } catch (error) {
      console.error("Failed to create comment:", error);
    }
  };

  const handleDelete = async (commentId: string) => {
    try {
      await deleteCommentMutation.mutateAsync({ id: commentId });
    } catch (error) {
      console.error("Failed to delete comment:", error);
    }
  };

  const canDeleteComment = (comment: { userId: string | null; id: string }) => {
    if (!user) return false;
    // User can delete their own comments or if they own the museum
    // Museum ownership check would require frame/museum data
    return comment.userId === user.id;
  };

  const characterCount = commentText.length;
  const isOverLimit = characterCount > 500;
  const isSubmitDisabled =
    !commentText.trim() ||
    isOverLimit ||
    (!user && !guestName.trim()) ||
    createCommentMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : comments && comments.length > 0 ? (
          <>
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {comment.authorProfilePic ? (
                    <img
                      src={comment.authorProfilePic}
                      alt={comment.authorName}
                      className="w-8 h-8 rounded-full bg-gray-200"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm font-medium text-gray-600">
                      {comment.authorName.charAt(0).toUpperCase()}
                    </div>
                  )}
                </div>

                {/* Comment Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900">
                          {comment.authorName}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatTimeAgo(new Date(comment.createdAt))}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1 break-words">
                        {comment.content}
                      </p>
                    </div>

                    {/* Delete Button */}
                    {canDeleteComment(comment) && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        className="flex-shrink-0 p-1 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="Delete comment"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={commentsEndRef} />
          </>
        ) : (
          <div className="flex items-center justify-center h-32">
            <p className="text-sm text-gray-500">
              No comments yet. Be the first to comment!
            </p>
          </div>
        )}
      </div>

      {/* Comment Input */}
      <div className="border-t border-gray-200 p-4 bg-gray-50">
        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Guest Name Input */}
          {!user && (
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Your name (optional)"
              maxLength={50}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}

          {/* Comment Text Input */}
          <div className="relative">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment..."
              rows={3}
              maxLength={550} // Allow typing a bit over to show error
              className={
                isOverLimit
                  ? "w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                  : "w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              }
            />

            {/* Character Counter */}
            <div
              className={
                isOverLimit
                  ? "absolute bottom-2 right-2 text-xs text-red-600 font-medium"
                  : "absolute bottom-2 right-2 text-xs text-gray-400"
              }
            >
              {characterCount}/500
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-between items-center">
            {createCommentMutation.isError && (
              <p className="text-xs text-red-600">
                {createCommentMutation.error?.message ||
                  "Failed to post comment"}
              </p>
            )}
            <div className="flex-1" />
            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createCommentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Comment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
