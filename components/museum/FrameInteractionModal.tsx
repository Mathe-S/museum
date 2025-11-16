"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import * as THREE from "three";
import { Frame } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { useMuseumStore } from "@/lib/store/museum-store";
import { usePartyKitPresence } from "@/lib/hooks/usePartyKitPresence";
import { CommentThread } from "./CommentThread";
import {
  X,
  Camera,
  Trash2,
  Upload,
  ChevronDown,
  Link as LinkIcon,
  Check,
  MessageSquare,
} from "lucide-react";

interface FrameInteractionModalProps {
  frame: Frame | null;
  onClose: () => void;
  onNavigationPause?: (paused: boolean) => void;
  isPublicView?: boolean;
}

type PanelView = "main" | "camera" | "ai" | "comments";

export function FrameInteractionModal({
  frame,
  onClose,
  onNavigationPause,
  isPublicView = false,
}: FrameInteractionModalProps) {
  const [activeView, setActiveView] = useState<PanelView>("main");
  const [showCamera, setShowCamera] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState<
    "van-gogh" | "impressionist" | "realistic" | "abstract" | "watercolor"
  >("realistic");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const setFrameProcessing = useMuseumStore(
    (state) => state.setFrameProcessing
  );
  const updateFrame = useMuseumStore((state) => state.updateFrame);
  const frames = useMuseumStore((state) => state.frames);
  const setSelectedFrame = useMuseumStore((state) => state.setSelectedFrame);
  const processingFrames = useMuseumStore((state) => state.processingFrames);
  const triggerRobber = useMuseumStore((state) => state.triggerRobber);

  const utils = trpc.useUtils();

  // Mutations
  const uploadMutation = trpc.image.upload.useMutation();
  const generateMutation = trpc.image.generate.useMutation();
  const createFrameMutation = trpc.frame.create.useMutation();
  const deleteFrameMutation = trpc.frame.delete.useMutation();
  const generateFrameShareLink = trpc.frame.generateShareLink.useMutation();

  // Sort frames by position to make the dropdown ordered
  const sortedFrames = useMemo(() => {
    return [...frames].sort((a, b) => a.position - b.position);
  }, [frames]);

  // Helper to get frame display name
  const getFrameName = (f: Frame) => {
    if (f.position < 3)
      return `Front Wall - ${
        f.position === 0 ? "Left" : f.position === 1 ? "Center" : "Right"
      }`;
    if (f.position < 6) return `Left Wall - ${f.position - 2}`;
    if (f.position < 9) return `Right Wall - ${f.position - 5}`;
    return `Hallway - ${f.position}`;
  };

  // Unlock pointer when frame is selected so user can interact with UI
  useEffect(() => {
    if (frame) {
      // Add a small delay to ensure we override any lock request from the click event
      const timer = setTimeout(() => {
        document.exitPointerLock();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [frame]);

  // Count filled frames
  const filledFramesCount = useMemo(
    () => frames.filter((f) => f.imageUrl).length,
    [frames]
  );

  // Remove navigation pause logic since we want non-blocking flow
  useEffect(() => {
    // Ensure navigation is NOT paused when this component mounts/updates
    if (onNavigationPause) {
      onNavigationPause(false);
    }
  }, [onNavigationPause]);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Set initial description from frame only when frame changes
  useEffect(() => {
    setDescription(frame?.description || "");
  }, [frame?.id]);

  // Effect to handle video stream setup
  useEffect(() => {
    if (stream && videoRef.current && isCameraActive) {
      const video = videoRef.current;
      video.srcObject = stream;

      const handleLoadedMetadata = async () => {
        try {
          await video.play();
          if (!isVideoReady) {
            setIsVideoReady(true);
          }
        } catch (err) {
          console.error("Error playing video:", err);
          setError("Failed to start video playback.");
        }
      };

      const handleCanPlay = () => {
        if (!isVideoReady) {
          setIsVideoReady(true);
        }
      };

      video.addEventListener("loadedmetadata", handleLoadedMetadata);
      video.addEventListener("canplay", handleCanPlay);

      return () => {
        video.removeEventListener("loadedmetadata", handleLoadedMetadata);
        video.removeEventListener("canplay", handleCanPlay);
      };
    } else {
      if (isVideoReady) {
        // eslint-disable-next-line
        setIsVideoReady(false);
      }
    }
  }, [stream, isCameraActive, isVideoReady]);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
    setError(null);
    setActiveView("main");
    onClose();
    // Lock pointer again when closing
    const canvas = document.querySelector("canvas");
    if (canvas) {
      canvas.requestPointerLock();
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setIsCameraActive(false);
    setIsVideoReady(false);
    setShowCamera(false);
  };

  const [shareSuccess, setShareSuccess] = useState(false);

  // Get museum ID from frames (they all belong to same museum)
  const museumId = frames[0]?.museumId || "";

  // PartyKit presence for real-time comment broadcasting
  const { broadcastComment, broadcastCommentDelete } = usePartyKitPresence({
    museumId,
    enabled: !!museumId && !isPublicView,
  });

  const handleShare = async () => {
    if (!frame || !frame.imageUrl || isPublicView) return;

    try {
      const result = await generateFrameShareLink.mutateAsync({ id: frame.id });
      if (result.shareToken) {
        // Build full URL on client side to ensure we have the correct origin
        const fullUrl = `${window.location.origin}/frame/${result.shareToken}`;
        await navigator.clipboard.writeText(fullUrl);
        setShareSuccess(true);
        setTimeout(() => {
          setShareSuccess(false);
        }, 3000);
      }
    } catch (err) {
      console.error("Share error:", err);
      setError("Failed to generate share link. Please try again.");
      setTimeout(() => {
        setError(null);
      }, 3000);
    }
  };

  if (!frame) return null;

  const isEmpty = !frame.imageUrl;

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, or WebP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    // Close modal immediately and start processing
    handleClose();
    setFrameProcessing(frame.id, "uploading");

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(",")[1];
        if (!base64Data) throw new Error("Failed to read file");

        try {
          // Check if AI generation is needed (non-realistic style)
          if (aiStyle !== "realistic" && description.trim()) {
            // Generate AI art using the uploaded image as base
            const generateResult = await generateMutation.mutateAsync({
              prompt: description,
              style: aiStyle,
              baseImage: base64Data,
            });

            const updatedFrame = await createFrameMutation.mutateAsync({
              museumId: frame.museumId,
              position: frame.position,
              side: frame.side as "left" | "right" | null,
              imageUrl: generateResult.urls.full,
              description: description,
              themeColors: generateResult.themeColors,
            });

            updateFrame({
              ...updatedFrame,
              themeColors: updatedFrame.themeColors as string[] | null,
            });

            await Promise.all([
              utils.frame.listByMuseum.invalidate(),
              utils.museum.getById.invalidate(),
            ]);

            setFrameProcessing(frame.id, null);
          } else {
            // Regular upload without AI processing
            const uploadResult = await uploadMutation.mutateAsync({
              filename: file.name,
              contentType: file.type,
              base64Data,
            });

            const updatedFrame = await createFrameMutation.mutateAsync({
              museumId: frame.museumId,
              position: frame.position,
              side: frame.side as "left" | "right" | null,
              imageUrl: uploadResult.urls.full,
              description: description || undefined,
              themeColors: uploadResult.themeColors,
            });

            updateFrame({
              ...updatedFrame,
              themeColors: updatedFrame.themeColors as string[] | null,
            });

            await Promise.all([
              utils.frame.listByMuseum.invalidate(),
              utils.museum.getById.invalidate(),
            ]);

            setFrameProcessing(frame.id, null);
          }
        } catch (uploadError) {
          console.error("Upload/generation error:", uploadError);
          setFrameProcessing(frame.id, null);
        }
      };
      reader.onerror = () => {
        console.error("Failed to read file");
        setFrameProcessing(frame.id, null);
      };
    } catch (err) {
      console.error("Upload error:", err);
      setFrameProcessing(frame.id, null);
    }
  };

  // Camera capture handlers
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
      });
      setStream(stream);
      setIsCameraActive(true);
      setShowCamera(true);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Failed to access camera. Please check permissions.");
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) {
      setError("Camera not ready. Please try again.");
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera not ready. Please wait a moment and try again.");
      return;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      setError("Failed to initialize canvas.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError("Failed to capture photo");
        return;
      }

      // Close modal immediately and start processing
      stopCamera();
      handleClose();
      setFrameProcessing(frame.id, "uploading");

      try {
        // Check if AI generation is needed (non-realistic style)
        if (aiStyle !== "realistic" && description.trim()) {
          // Read the captured photo as base64 for style transfer
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onload = async () => {
            const base64Data = reader.result?.toString().split(",")[1];
            if (!base64Data) throw new Error("Failed to process photo");

            try {
              // Generate AI art using the photo as base and applying the style
              const generateResult = await generateMutation.mutateAsync({
                prompt: description,
                style: aiStyle,
                baseImage: base64Data,
              });

              const updatedFrame = await createFrameMutation.mutateAsync({
                museumId: frame.museumId,
                position: frame.position,
                side: frame.side as "left" | "right" | null,
                imageUrl: generateResult.urls.full,
                description: description,
                themeColors: generateResult.themeColors,
              });

              updateFrame({
                ...updatedFrame,
                themeColors: updatedFrame.themeColors as string[] | null,
              });

              await Promise.all([
                utils.frame.listByMuseum.invalidate(),
                utils.museum.getById.invalidate(),
              ]);

              setFrameProcessing(frame.id, null);
            } catch (err) {
              console.error("AI generation error:", err);
              setFrameProcessing(frame.id, null);
            }
          };
        } else {
          // Regular photo upload
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onload = async () => {
            const base64Data = reader.result?.toString().split(",")[1];
            if (!base64Data) throw new Error("Failed to process photo");

            const uploadResult = await uploadMutation.mutateAsync({
              filename: `camera-${Date.now()}.jpg`,
              contentType: "image/jpeg",
              base64Data,
            });

            const updatedFrame = await createFrameMutation.mutateAsync({
              museumId: frame.museumId,
              position: frame.position,
              side: frame.side as "left" | "right" | null,
              imageUrl: uploadResult.urls.full,
              description: description || undefined,
              themeColors: uploadResult.themeColors,
            });

            updateFrame({
              ...updatedFrame,
              themeColors: updatedFrame.themeColors as string[] | null,
            });

            await Promise.all([
              utils.frame.listByMuseum.invalidate(),
              utils.museum.getById.invalidate(),
            ]);

            setFrameProcessing(frame.id, null);
          };
        }
      } catch (err) {
        console.error("Capture error:", err);
        setFrameProcessing(frame.id, null);
      }
    }, "image/jpeg");
  };

  // AI generation handler
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    // Close modal immediately and start processing
    handleClose();
    setFrameProcessing(frame.id, "uploading");

    try {
      const generateResult = await generateMutation.mutateAsync({
        prompt: aiPrompt,
        style: aiStyle,
      });

      const updatedFrame = await createFrameMutation.mutateAsync({
        museumId: frame.museumId,
        position: frame.position,
        side: frame.side as "left" | "right" | null,
        imageUrl: generateResult.urls.full,
        description: aiPrompt,
        themeColors: generateResult.themeColors,
      });

      updateFrame({
        ...updatedFrame,
        themeColors: updatedFrame.themeColors as string[] | null,
      });

      await utils.frame.listByMuseum.invalidate();
      setFrameProcessing(frame.id, null);
    } catch (err) {
      console.error("Generation error:", err);
      setFrameProcessing(frame.id, null);
    }
  };

  // Calculate robber's position in front of the frame in museum space
  const calculateRobberPosition = (
    position: number,
    side: string | null
  ): [number, number, number] => {
    const MAIN_HALL_WIDTH = 40;
    const MAIN_HALL_DEPTH = 30;
    const FRAME_HEIGHT = 5;
    const HALL_SEGMENT_LENGTH = 8;
    const HALL_WIDTH = 10;
    const ROBBER_OFFSET = 2.5; // Distance in front of the frame

    // Front entrance wall: positions 0-2 (frames face inward, toward museum)
    if (position >= 0 && position < 3) {
      const x = (position - 1) * 10;
      const y = FRAME_HEIGHT - 1; // Lower robber slightly
      const z = -0.3 - ROBBER_OFFSET; // In front toward the museum interior
      return [x, y, z];
    }

    // Left wall: positions 3-5 (frames face right, toward center)
    if (position >= 3 && position < 6) {
      const wallIndex = position - 3;
      const x = -MAIN_HALL_WIDTH / 2 + 0.3 + ROBBER_OFFSET; // To the right of frame
      const y = FRAME_HEIGHT - 1;
      const z = -(wallIndex * 10 + 5);
      return [x, y, z];
    }

    // Right wall: positions 6-8 (frames face left, toward center)
    if (position >= 6 && position < 9) {
      const wallIndex = position - 6;
      const x = MAIN_HALL_WIDTH / 2 - 0.3 - ROBBER_OFFSET; // To the left of frame
      const y = FRAME_HEIGHT - 1;
      const z = -(wallIndex * 10 + 5);
      return [x, y, z];
    }

    // Extendable hall: positions 9+ (alternating left/right)
    const extendableIndex = position - 9;
    const segmentIndex = Math.floor(extendableIndex / 2);
    const isLeft = side === "left";
    const x = isLeft
      ? -HALL_WIDTH / 2 + 0.3 + ROBBER_OFFSET // Left frames face right
      : HALL_WIDTH / 2 - 0.3 - ROBBER_OFFSET; // Right frames face left
    const y = 4 - 1; // Lower robber slightly
    const z = -MAIN_HALL_DEPTH - HALL_SEGMENT_LENGTH * (segmentIndex + 0.5);
    return [x, y, z];
  };

  const handleDelete = async () => {
    if (!frame) return;

    // Close modal
    handleClose();

    // Calculate robber's position in front of the frame
    const [x, y, z] = calculateRobberPosition(frame.position, frame.side);
    const robberPosition = new THREE.Vector3(x, y, z);

    // Trigger robber animation
    triggerRobber(frame.id, robberPosition);

    // Set to deleting state immediately
    setFrameProcessing(frame.id, "deleting");

    // Wait for animation to complete (4 seconds)
    setTimeout(async () => {
      try {
        const updatedFrame = await deleteFrameMutation.mutateAsync({
          id: frame.id,
        });

        updateFrame({
          ...updatedFrame,
          themeColors: updatedFrame.themeColors as string[] | null,
        });

        await Promise.all([
          utils.frame.listByMuseum.invalidate(),
          utils.museum.getById.invalidate(),
        ]);

        setFrameProcessing(frame.id, null);
      } catch (err) {
        console.error("Delete error:", err);
        setFrameProcessing(frame.id, null);
      }
    }, 4000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-yellow-400 rounded flex items-center justify-center text-xs">
              🖼️
            </div>
            <h2 className="font-bold text-gray-800 text-sm">Museum Gallery</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex-1">
          {activeView === "main" && (
            <div className="space-y-4">
              {isPublicView && !isEmpty ? (
                /* Public view with filled frame - show image and description */
                <>
                  {/* Frame Image Preview */}
                  {frame.imageUrl && (
                    <div className="relative aspect-video w-full rounded-lg overflow-hidden bg-gray-100">
                      <img
                        src={frame.imageUrl}
                        alt={frame.description || "Artwork"}
                        className="w-full h-full object-contain"
                      />
                    </div>
                  )}

                  {/* Frame Description */}
                  {frame.description && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                        Description:
                      </label>
                      <p className="text-sm text-gray-700 leading-relaxed">
                        {frame.description}
                      </p>
                    </div>
                  )}

                  {/* View-only notice */}
                  <div className="p-3 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-lg text-center">
                    👁️ View-only mode • Editing not available
                  </div>
                </>
              ) : isPublicView ? (
                /* Public view with empty frame */
                <div className="text-center py-8">
                  <p className="text-gray-500 text-sm">This frame is empty.</p>
                </div>
              ) : (
                <>
                  {/* Frame Selection */}
                  {!isEmpty && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                        Frame:
                      </label>
                      <select
                        value={frame.id}
                        onChange={(e) => {
                          const newFrame = frames.find(
                            (f) => f.id === e.target.value
                          );
                          if (newFrame) {
                            setSelectedFrame(newFrame);
                          }
                        }}
                        className="w-full p-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-shadow"
                      >
                        {sortedFrames.map((f) => (
                          <option key={f.id} value={f.id}>
                            {getFrameName(f)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Success message for share */}
                  {shareSuccess && (
                    <div className="p-3 bg-green-50 border border-green-200 text-green-700 text-xs rounded-lg flex items-center gap-2">
                      <Check className="w-4 h-4" />
                      <span className="font-medium">
                        Frame link copied to clipboard!
                      </span>
                    </div>
                  )}

                  {/* Error messages */}
                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Artwork Description */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                      Artwork Description:
                    </label>
                    <div className="relative">
                      <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Add a description for this artwork..."
                        className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none min-h-[100px]"
                        maxLength={200}
                      />
                      <div className="absolute bottom-2 right-2 text-[10px] text-gray-400">
                        {description.length}/200
                      </div>
                    </div>
                  </div>

                  {/* Artistic Style */}
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                      Artistic Style:
                    </label>
                    <div className="relative">
                      <select
                        value={aiStyle}
                        onChange={(e) =>
                          setAiStyle(e.target.value as typeof aiStyle)
                        }
                        className="w-full p-2.5 pl-9 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      >
                        <option value="realistic">
                          Original - No transformation
                        </option>
                        <option value="van-gogh">Van Gogh</option>
                        <option value="impressionist">Impressionist</option>
                        <option value="abstract">Abstract</option>
                        <option value="watercolor">Watercolor</option>
                      </select>
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                        <Camera className="w-4 h-4" />
                      </div>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="space-y-2.5">
                    {/* Upload/Replace Image */}
                    <div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={processingFrames[frame.id] === "uploading"}
                        className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <Upload className="w-4 h-4" />
                        {processingFrames[frame.id] === "uploading"
                          ? "Uploading..."
                          : isEmpty
                          ? "Upload Image"
                          : "Replace Image"}
                      </button>
                    </div>

                    {/* Take Photo */}
                    {!showCamera ? (
                      <button
                        onClick={startCamera}
                        className="w-full py-2.5 bg-[#5B7CFA] hover:bg-[#4A69D8] active:bg-[#3D58B8] text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <Camera className="w-4 h-4" />
                        Take Photo
                      </button>
                    ) : (
                      <button
                        onClick={stopCamera}
                        className="w-full py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <X className="w-4 h-4" />
                        Close Camera
                      </button>
                    )}

                    {/* Generate with AI */}
                    <button
                      onClick={() => setActiveView("ai")}
                      className="w-full py-2.5 bg-[#10B981] hover:bg-[#0D9F7A] active:bg-[#0B8666] text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                    >
                      <div className="w-4 h-4 rounded-full bg-linear-to-r from-purple-500 to-pink-500" />
                      Generate with AI
                    </button>

                    {/* Comments Button for filled frames */}
                    {!isEmpty && (
                      <button
                        onClick={() => setActiveView("comments")}
                        className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors"
                      >
                        <MessageSquare className="w-4 h-4" />
                        View Comments
                      </button>
                    )}

                    {/* Share + Delete Row for filled frames */}
                    {!isEmpty && !isPublicView && (
                      <div className="flex gap-2">
                        <button
                          onClick={handleShare}
                          disabled={generateFrameShareLink.isPending}
                          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                        >
                          {generateFrameShareLink.isPending ? (
                            <>
                              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              Sharing...
                            </>
                          ) : (
                            <>
                              <LinkIcon className="w-4 h-4" />
                              Share Frame
                            </>
                          )}
                        </button>

                        <button
                          onClick={handleDelete}
                          disabled={processingFrames[frame.id] === "deleting"}
                          className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-lg font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
                        >
                          <Trash2 className="w-4 h-4" />
                          {processingFrames[frame.id] === "deleting"
                            ? "Deleting..."
                            : "Delete Image"}
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Camera View - Inline */}
                  {showCamera && (
                    <div className="space-y-3">
                      <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                        {!isVideoReady && (
                          <div className="absolute inset-0 flex items-center justify-center text-white">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                          </div>
                        )}
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                        />
                        <canvas ref={canvasRef} className="hidden" />
                      </div>

                      <button
                        onClick={capturePhoto}
                        disabled={
                          processingFrames[frame.id] === "uploading" ||
                          !isVideoReady
                        }
                        className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {processingFrames[frame.id] === "uploading"
                          ? "Processing..."
                          : "Capture Photo"}
                      </button>
                    </div>
                  )}

                  {/* Status Bar */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-600 font-medium">
                        <span className="font-bold text-gray-900">Images:</span>{" "}
                        {filledFramesCount} / {frames.length} frames filled
                      </p>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Camera View */}
          {activeView === "camera" && !isPublicView && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800 text-sm">Camera</h3>
                <button
                  onClick={stopCamera}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>

              <div className="relative bg-black rounded-lg overflow-hidden aspect-video">
                {!isVideoReady && (
                  <div className="absolute inset-0 flex items-center justify-center text-white">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <button
                onClick={capturePhoto}
                disabled={
                  processingFrames[frame.id] === "uploading" || !isVideoReady
                }
                className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                {processingFrames[frame.id] === "uploading"
                  ? "Processing..."
                  : "Capture Photo"}
              </button>
            </div>
          )}

          {/* AI View */}
          {activeView === "ai" && !isPublicView && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-gray-800 text-sm">
                  AI Generation
                </h3>
                <button
                  onClick={() => setActiveView("main")}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Back
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                  Prompt
                </label>
                <textarea
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Describe what you want to see..."
                  className="w-full p-3 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">
                  Selected Style
                </label>
                <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-900 capitalize">
                  {aiStyle.replace("-", " ")}
                </div>
                <p className="text-[10px] text-gray-500 mt-1">
                  Change style in the main menu
                </p>
              </div>

              <button
                onClick={handleGenerate}
                disabled={
                  processingFrames[frame.id] === "uploading" || !aiPrompt.trim()
                }
                className="w-full py-2.5 bg-[#E9424F] hover:bg-[#D33642] text-white rounded-lg font-medium text-sm transition-colors"
              >
                {processingFrames[frame.id] === "uploading"
                  ? "Generating..."
                  : "Generate with Luvre"}
              </button>
            </div>
          )}

          {/* Comments View */}
          {activeView === "comments" && !isEmpty && (
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3 pb-3 border-b border-gray-200">
                <h3 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Comments
                </h3>
                <button
                  onClick={() => setActiveView("main")}
                  className="text-xs text-gray-500 hover:text-gray-800"
                >
                  Back
                </button>
              </div>

              {/* CommentThread takes full height */}
              <div className="flex-1 min-h-0 -mx-4 -mb-4">
                <CommentThread
                  frameId={frame.id}
                  onBroadcastComment={
                    !isPublicView
                      ? (text, authorName, authorPicture) => {
                          broadcastComment(
                            frame.id,
                            text,
                            authorName,
                            authorPicture
                          );
                        }
                      : undefined
                  }
                  onBroadcastCommentDelete={
                    !isPublicView
                      ? (commentId) => {
                          broadcastCommentDelete(frame.id, commentId);
                        }
                      : undefined
                  }
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
