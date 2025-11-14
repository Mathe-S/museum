"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { useMuseumStore } from "@/lib/store/museum-store";

interface MuseumSelectorUIProps {
  onClose: () => void;
  onSelect: (museumId: string) => void;
}

export function MuseumSelectorUI({ onClose, onSelect }: MuseumSelectorUIProps) {
  const { data: museums, isLoading } = trpc.museum.list.useQuery();
  const currentMuseum = useMuseumStore((state) => state.currentMuseum);
  const [selectedMuseumId, setSelectedMuseumId] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const handleSelect = async (museumId: string) => {
    if (museumId === currentMuseum?.id) {
      onClose();
      return;
    }

    setSelectedMuseumId(museumId);
    setIsTransitioning(true);

    // Wait for fade-to-black transition
    await new Promise((resolve) => setTimeout(resolve, 1000));

    onSelect(museumId);
  };

  return (
    <>
      {/* Fade-to-black transition overlay */}
      {isTransitioning && (
        <div
          className="fixed inset-0 bg-black z-50 transition-opacity duration-1000"
          style={{ opacity: 1 }}
        />
      )}

      {/* Museum selector modal */}
      <div className="fixed inset-0 z-40 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal content */}
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-4 text-white">
            <h2 className="text-2xl font-bold">Select Museum</h2>
            <p className="text-sm opacity-90 mt-1">
              Choose a museum to travel to
            </p>
          </div>

          {/* Museum list */}
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
              </div>
            ) : museums && museums.length > 0 ? (
              <div className="grid gap-3">
                {museums.map((museum) => {
                  const isCurrent = museum.id === currentMuseum?.id;
                  const isSelected = museum.id === selectedMuseumId;

                  return (
                    <button
                      key={museum.id}
                      onClick={() => handleSelect(museum.id)}
                      disabled={isCurrent || isTransitioning}
                      className={`
                        relative p-4 rounded-xl border-2 text-left transition-all
                        ${
                          isCurrent
                            ? "border-green-500 bg-green-50 cursor-default"
                            : isSelected
                            ? "border-blue-500 bg-blue-50"
                            : "border-gray-200 hover:border-blue-400 hover:bg-blue-50"
                        }
                        ${isTransitioning && !isSelected ? "opacity-50" : ""}
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">
                            {museum.name}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-sm text-gray-600">
                              {museum.themeMode === "day" ? "☀️ Day" : "🌙 Night"}
                            </span>
                            <span className="text-sm text-gray-600">
                              {museum.isPublic ? "🌐 Public" : "🔒 Private"}
                            </span>
                          </div>
                        </div>
                        {isCurrent && (
                          <span className="px-3 py-1 bg-green-500 text-white text-sm font-medium rounded-full">
                            Current
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  You don't have any other museums yet.
                </p>
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          {museums && museums.length > 0 && (
            <div className="border-t px-6 py-4 bg-gray-50">
              <button
                onClick={onClose}
                disabled={isTransitioning}
                className="w-full px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
