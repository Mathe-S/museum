"use client";

import { useMuseumStore } from "@/lib/store/museum-store";
import { Users } from "lucide-react";

/**
 * VisitorCountIndicator - Displays the number of other visitors in the museum
 * Shows real-time multiplayer presence count
 */
export function VisitorCountIndicator() {
  const visitorCount = useMuseumStore((state) => state.visitorCount);

  // Don't show if no other visitors
  if (visitorCount === 0) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-blue-600/90 text-white rounded-lg shadow-lg backdrop-blur-sm">
      <Users className="w-4 h-4" />
      <span className="text-sm font-medium">
        {visitorCount} {visitorCount === 1 ? "visitor" : "visitors"}
      </span>
    </div>
  );
}
