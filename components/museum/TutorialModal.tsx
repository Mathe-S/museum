"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { X, Gamepad2, Frame, Sparkles, Building2, Share2 } from "lucide-react";

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [isMobile, setIsMobile] = useState(false);
  const dismissTutorialMutation = trpc.user.dismissTutorial.useMutation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || "ontouchstart" in window);
    };
    checkMobile();
  }, []);

  const handleDismiss = async () => {
    // Store dismissal in localStorage immediately for instant feedback
    localStorage.setItem("tutorialDismissed", "true");

    // Update database in background
    try {
      await dismissTutorialMutation.mutateAsync();
    } catch (error) {
      console.error("Failed to update tutorial dismissal in database:", error);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gray-900 text-white px-6 py-5 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-semibold mb-1">Welcome to Your 3D Museum</h2>
            <p className="text-gray-300 text-sm">
              Quick guide to get you started
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="space-y-5">
            {/* Navigation Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-900">
                <Gamepad2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Navigation</h3>
              </div>
              <div className="pl-7 space-y-2 text-sm text-gray-700">
                {isMobile ? (
                  <>
                    <p>
                      <span className="font-medium text-gray-900">Move:</span> Use the virtual
                      joystick in the bottom-left corner
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Look around:</span> Drag your
                      finger across the screen
                    </p>
                  </>
                ) : (
                  <>
                    <p>
                      <span className="font-medium text-gray-900">Move:</span> Use{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        W
                      </kbd>{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        A
                      </kbd>{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        S
                      </kbd>{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        D
                      </kbd>{" "}
                      keys
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Look around:</span> Move your
                      mouse (click to lock pointer)
                    </p>
                    <p>
                      <span className="font-medium text-gray-900">Unlock pointer:</span> Press{" "}
                      <kbd className="px-1.5 py-0.5 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                        ESC
                      </kbd>
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Frame Interaction Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-900">
                <Frame className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Frame Interaction</h3>
              </div>
              <div className="pl-7 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium text-gray-900">Empty frames:</span> Click to upload
                  images from your device or camera
                </p>
                <p>
                  <span className="font-medium text-gray-900">Filled frames:</span> Click to view
                  details, edit, delete, or share
                </p>
                <p>
                  <span className="font-medium text-gray-900">Hover indicators:</span> Look at a
                  frame to see interaction hints
                </p>
              </div>
            </div>

            {/* AI Generation Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-900">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">AI Image Generation</h3>
              </div>
              <div className="pl-7 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium text-gray-900">Create art with AI:</span> Click an
                  empty frame and choose "Generate with AI"
                </p>
                <p>
                  <span className="font-medium text-gray-900">Style presets:</span> Choose from
                  Van Gogh, Impressionist, and more
                </p>
                <p>
                  <span className="font-medium text-gray-900">Custom prompts:</span> Describe what
                  you want to see and let AI create it
                </p>
              </div>
            </div>

            {/* Museum Features Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-900">
                <Building2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Museum Features</h3>
              </div>
              <div className="pl-7 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium text-gray-900">Main Hall:</span> 9 large frames in a
                  3×3 grid
                </p>
                <p>
                  <span className="font-medium text-gray-900">Extendable Hall:</span> Automatically
                  grows as you add more frames
                </p>
                <p>
                  <span className="font-medium text-gray-900">Portal:</span> Switch between your
                  museums at the end of the hall
                </p>
                <p>
                  <span className="font-medium text-gray-900">Theme toggle:</span> Switch between
                  day and night modes
                </p>
              </div>
            </div>

            {/* Sharing Section */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-900">
                <Share2 className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold">Sharing</h3>
              </div>
              <div className="pl-7 space-y-2 text-sm text-gray-700">
                <p>
                  <span className="font-medium text-gray-900">Make public:</span> Toggle your
                  museum to public in the Profile menu
                </p>
                <p>
                  <span className="font-medium text-gray-900">Share links:</span> Generate unique
                  links for your entire museum or individual frames
                </p>
                <p>
                  <span className="font-medium text-gray-900">Guest access:</span> Visitors can
                  explore without signing in
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
          <button
            onClick={handleDismiss}
            className="w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            Got it, let's explore
          </button>
        </div>
      </div>
    </div>
  );
}
