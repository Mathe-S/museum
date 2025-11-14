"use client";

import { useMuseumStore } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { useUser } from "@clerk/nextjs";
import { useState } from "react";
import { X, Copy, Check, Plus, ExternalLink } from "lucide-react";

export function ProfileOverlay() {
  const showProfileOverlay = useMuseumStore(
    (state) => state.showProfileOverlay
  );
  const setShowProfileOverlay = useMuseumStore(
    (state) => state.setShowProfileOverlay
  );
  const currentMuseum = useMuseumStore((state) => state.currentMuseum);
  const setCurrentMuseum = useMuseumStore((state) => state.setCurrentMuseum);
  const moveSpeed = useMuseumStore((state) => state.moveSpeed);
  const setMoveSpeed = useMuseumStore((state) => state.setMoveSpeed);

  const { user } = useUser();
  const utils = trpc.useUtils();

  const [copiedShareLink, setCopiedShareLink] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);

  // Fetch user's museums
  const { data: museums, isLoading: museumsLoading } =
    trpc.museum.list.useQuery(undefined, {
      enabled: showProfileOverlay,
    });

  // Update museum mutation with optimistic updates
  const updateMuseum = trpc.museum.update.useMutation({
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await utils.museum.list.cancel();
      await utils.museum.getById.cancel();

      // Snapshot previous values
      const previousMuseums = utils.museum.list.getData();
      const previousMuseum = currentMuseum;

      // Optimistically update the UI
      if (currentMuseum && variables.id === currentMuseum.id) {
        const updatedMuseum = {
          ...currentMuseum,
          ...variables,
        };
        setCurrentMuseum(updatedMuseum);

        // Update the list
        if (previousMuseums) {
          utils.museum.list.setData(
            undefined,
            previousMuseums.map((m) =>
              m.id === variables.id ? { ...m, ...variables } : m
            )
          );
        }
      }

      return { previousMuseums, previousMuseum };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousMuseum) {
        setCurrentMuseum(context.previousMuseum);
      }
      if (context?.previousMuseums) {
        utils.museum.list.setData(undefined, context.previousMuseums);
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      utils.museum.list.invalidate();
    },
  });

  // Generate share link mutation
  const generateShareLink = trpc.museum.generateShareLink.useMutation({
    onSuccess: (data) => {
      setShareLink(data.shareUrl);
    },
  });

  // Create museum mutation with optimistic updates
  const createMuseum = trpc.museum.create.useMutation({
    onMutate: async (variables) => {
      await utils.museum.list.cancel();

      const previousMuseums = utils.museum.list.getData();

      // Optimistically add new museum to the list
      const optimisticMuseum = {
        id: `temp-${Date.now()}`,
        userId: user?.id || "",
        name: variables.name || "My Museum",
        isPublic: false,
        shareToken: null,
        themeMode: variables.themeMode || "day",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (previousMuseums) {
        utils.museum.list.setData(undefined, [
          optimisticMuseum,
          ...previousMuseums,
        ]);
      }

      return { previousMuseums };
    },
    onError: (err, variables, context) => {
      if (context?.previousMuseums) {
        utils.museum.list.setData(undefined, context.previousMuseums);
      }
    },
    onSuccess: (data) => {
      // Switch to the newly created museum
      setCurrentMuseum({
        ...data,
        themeMode: data.themeMode as "day" | "night",
      });
    },
    onSettled: () => {
      utils.museum.list.invalidate();
    },
  });

  const handleTogglePublic = () => {
    if (!currentMuseum) return;

    updateMuseum.mutate({
      id: currentMuseum.id,
      isPublic: !currentMuseum.isPublic,
    });
  };

  const handleGenerateShareLink = () => {
    if (!currentMuseum) return;

    generateShareLink.mutate({
      id: currentMuseum.id,
    });
  };

  const handleCopyShareLink = async () => {
    const linkToCopy =
      shareLink ||
      (currentMuseum?.shareToken
        ? `${window.location.origin}/museum/${currentMuseum.shareToken}`
        : null);

    if (linkToCopy) {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedShareLink(true);
      setTimeout(() => setCopiedShareLink(false), 2000);
    }
  };

  const handleCreateMuseum = () => {
    createMuseum.mutate({
      name: "My Museum",
      themeMode: "day",
    });
  };

  const handleSwitchMuseum = (museumId: string) => {
    const museum = museums?.find((m) => m.id === museumId);
    if (museum) {
      setCurrentMuseum({
        ...museum,
        themeMode: museum.themeMode as "day" | "night",
      });
      setShowProfileOverlay(false);
    }
  };

  if (!showProfileOverlay) return null;

  const displayShareLink =
    shareLink ||
    (currentMuseum?.shareToken
      ? `${window.location.origin}/museum/${currentMuseum.shareToken}`
      : null);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={() => setShowProfileOverlay(false)}
      />

      {/* Overlay Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Profile</h2>
          <button
            onClick={() => setShowProfileOverlay(false)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Section */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt={user.fullName || "User"}
                className="w-16 h-16 rounded-full"
              />
            )}
            <div>
              <h3 className="font-semibold text-lg text-gray-900">
                {user?.fullName || user?.username || "User"}
              </h3>
              <p className="text-sm text-gray-600">
                {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          </div>
        </div>

        {/* Settings Section */}
        <div className="p-6 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Settings</h3>
          
          {/* Move Speed Control */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm text-gray-700 font-medium">
                Movement Speed
              </label>
              <span className="text-sm text-gray-600 font-mono">
                {moveSpeed.toFixed(1)}x
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.5"
              value={moveSpeed}
              onChange={(e) => setMoveSpeed(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Slow (1x)</span>
              <span>Fast (15x)</span>
            </div>
          </div>
        </div>

        {/* Current Museum Section */}
        {currentMuseum && (
          <div className="p-6 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">
              Current Museum
            </h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium text-gray-900 mb-3">
                {currentMuseum.name}
              </p>

              {/* Public/Private Toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-700">Public Access</span>
                <button
                  onClick={handleTogglePublic}
                  disabled={updateMuseum.isPending}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    currentMuseum.isPublic ? "bg-blue-600" : "bg-gray-300"
                  } ${updateMuseum.isPending ? "opacity-50" : ""}`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      currentMuseum.isPublic ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>

              {/* Share Link Section */}
              {currentMuseum.isPublic && (
                <div className="space-y-2">
                  {!displayShareLink ? (
                    <button
                      onClick={handleGenerateShareLink}
                      disabled={generateShareLink.isPending}
                      className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Generate Share Link
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 p-2 bg-white border border-gray-300 rounded-lg">
                        <input
                          type="text"
                          value={displayShareLink}
                          readOnly
                          className="flex-1 text-sm text-gray-700 bg-transparent outline-none"
                        />
                        <button
                          onClick={handleCopyShareLink}
                          className="p-2 hover:bg-gray-100 rounded transition-colors"
                        >
                          {copiedShareLink ? (
                            <Check className="w-4 h-4 text-green-600" />
                          ) : (
                            <Copy className="w-4 h-4 text-gray-600" />
                          )}
                        </button>
                      </div>
                      {copiedShareLink && (
                        <p className="text-xs text-green-600">
                          Link copied to clipboard!
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Museums List Section */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Your Museums</h3>
            <button
              onClick={handleCreateMuseum}
              disabled={createMuseum.isPending}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Create New
            </button>
          </div>

          {museumsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-16 bg-gray-100 rounded-lg animate-pulse"
                />
              ))}
            </div>
          ) : museums && museums.length > 0 ? (
            <div className="space-y-2">
              {museums.map((museum) => (
                <button
                  key={museum.id}
                  onClick={() => handleSwitchMuseum(museum.id)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    currentMuseum?.id === museum.id
                      ? "border-blue-600 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-gray-900">
                        {museum.name}
                      </p>
                      <p className="text-xs text-gray-600 mt-1">
                        {museum.isPublic ? "Public" : "Private"} •{" "}
                        {museum.themeMode === "day" ? "☀️ Day" : "🌙 Night"}
                      </p>
                    </div>
                    {currentMuseum?.id === museum.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="text-sm">No museums yet</p>
              <p className="text-xs mt-1">Create your first museum above</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
