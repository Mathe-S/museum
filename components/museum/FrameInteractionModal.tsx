"use client";

import { useEffect, useRef, useState } from "react";
import { Frame } from "@/lib/store/museum-store";
import { trpc } from "@/lib/trpc/client";
import { useMuseumStore } from "@/lib/store/museum-store";

interface FrameInteractionModalProps {
  frame: Frame | null;
  onClose: () => void;
  onNavigationPause?: (paused: boolean) => void;
}

type ModalTab = "upload" | "camera" | "generate" | "details";

export function FrameInteractionModal({
  frame,
  onClose,
  onNavigationPause,
}: FrameInteractionModalProps) {
  const [activeTab, setActiveTab] = useState<ModalTab>("upload");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiStyle, setAiStyle] = useState<
    "van-gogh" | "impressionist" | "realistic" | "abstract" | "watercolor"
  >("realistic");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);

  const updateFrame = useMuseumStore((state) => state.updateFrame);
  const deleteFrameFromStore = useMuseumStore((state) => state.deleteFrame);

  const utils = trpc.useUtils();

  // Mutations
  const uploadMutation = trpc.image.upload.useMutation();
  const generateMutation = trpc.image.generate.useMutation();
  const createFrameMutation = trpc.frame.create.useMutation();
  const deleteFrameMutation = trpc.frame.delete.useMutation();
  const generateShareLinkMutation = trpc.frame.generateShareLink.useMutation();

  // Pause navigation when modal is open
  useEffect(() => {
    if (frame) {
      onNavigationPause?.(true);
    }
    return () => {
      onNavigationPause?.(false);
    };
  }, [frame, onNavigationPause]);

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  // Cleanup camera stream
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  // Set initial description from frame
  useEffect(() => {
    if (frame?.description) {
      setDescription(frame.description);
    }
  }, [frame]);

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
    setError(null);
    setShareUrl(null);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  if (!frame) return null;

  const isEmpty = !frame.imageUrl;

  // File upload handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!validTypes.includes(file.type)) {
      setError("Invalid file type. Please upload JPEG, PNG, or WebP.");
      return;
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Convert file to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result?.toString().split(",")[1];
        if (!base64Data) {
          throw new Error("Failed to read file");
        }

        // Upload image
        const uploadResult = await uploadMutation.mutateAsync({
          filename: file.name,
          contentType: file.type,
          base64Data,
        });

        // Create/update frame with uploaded image
        const updatedFrame = await createFrameMutation.mutateAsync({
          museumId: frame.museumId,
          position: frame.position,
          side: frame.side as "left" | "right" | null,
          imageUrl: uploadResult.urls.full,
          description: description || undefined,
          themeColors: uploadResult.themeColors,
        });

        // Update store with properly typed frame
        updateFrame({
          ...updatedFrame,
          themeColors: updatedFrame.themeColors as string[] | null,
        });

        // Invalidate queries
        await utils.frame.listByMuseum.invalidate();

        setIsUploading(false);
        handleClose();
      };
      reader.onerror = () => {
        setError("Failed to read file");
        setIsUploading(false);
      };
    } catch (err) {
      console.error("Upload error:", err);
      setError(err instanceof Error ? err.message : "Failed to upload image");
      setIsUploading(false);
    }
  };

  // Camera capture handlers
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setIsCameraActive(true);
      setError(null);
    } catch (err) {
      console.error("Camera error:", err);
      setError("Failed to access camera. Please check permissions.");
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext("2d");
    if (!context) return;

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0);

    // Convert canvas to blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError("Failed to capture photo");
        return;
      }

      setIsUploading(true);
      setError(null);

      try {
        // Convert blob to base64
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onload = async () => {
          const base64Data = reader.result?.toString().split(",")[1];
          if (!base64Data) {
            throw new Error("Failed to process photo");
          }

          // Upload image
          const uploadResult = await uploadMutation.mutateAsync({
            filename: `camera-${Date.now()}.jpg`,
            contentType: "image/jpeg",
            base64Data,
          });

          // Create/update frame
          const updatedFrame = await createFrameMutation.mutateAsync({
            museumId: frame.museumId,
            position: frame.position,
            side: frame.side as "left" | "right" | null,
            imageUrl: uploadResult.urls.full,
            description: description || undefined,
            themeColors: uploadResult.themeColors,
          });

          // Update store with properly typed frame
          updateFrame({
            ...updatedFrame,
            themeColors: updatedFrame.themeColors as string[] | null,
          });

          // Invalidate queries
          await utils.frame.listByMuseum.invalidate();

          // Stop camera
          if (stream) {
            stream.getTracks().forEach((track) => track.stop());
          }
          setIsCameraActive(false);
          setIsUploading(false);
          handleClose();
        };
      } catch (err) {
        console.error("Capture error:", err);
        setError(err instanceof Error ? err.message : "Failed to capture photo");
        setIsUploading(false);
      }
    }, "image/jpeg");
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    setIsCameraActive(false);
  };

  // AI generation handler
  const handleGenerate = async () => {
    if (!aiPrompt.trim()) {
      setError("Please enter a prompt");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Generate image
      const generateResult = await generateMutation.mutateAsync({
        prompt: aiPrompt,
        style: aiStyle,
      });

      // Create/update frame with generated image
      const updatedFrame = await createFrameMutation.mutateAsync({
        museumId: frame.museumId,
        position: frame.position,
        side: frame.side as "left" | "right" | null,
        imageUrl: generateResult.urls.full,
        description: aiPrompt,
        themeColors: generateResult.themeColors,
      });

      // Update store with properly typed frame
      updateFrame({
        ...updatedFrame,
        themeColors: updatedFrame.themeColors as string[] | null,
      });

      // Invalidate queries
      await utils.frame.listByMuseum.invalidate();

      setIsGenerating(false);
      handleClose();
    } catch (err) {
      console.error("Generation error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate image");
      setIsGenerating(false);
    }
  };

  // Delete handler
  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const updatedFrame = await deleteFrameMutation.mutateAsync({
        id: frame.id,
      });

      // Update store with properly typed frame
      updateFrame({
        ...updatedFrame,
        themeColors: updatedFrame.themeColors as string[] | null,
      });

      // Invalidate queries
      await utils.frame.listByMuseum.invalidate();

      handleClose();
    } catch (err) {
      console.error("Delete error:", err);
      setError(err instanceof Error ? err.message : "Failed to delete image");
    }
  };

  // Share handler
  const handleShare = async () => {
    try {
      const result = await generateShareLinkMutation.mutateAsync({
        id: frame.id,
      });
      setShareUrl(result.shareUrl);
    } catch (err) {
      console.error("Share error:", err);
      setError(err instanceof Error ? err.message : "Failed to generate share link");
    }
  };

  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      alert("Share link copied to clipboard!");
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="relative bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-2xl font-bold z-10"
          aria-label="Close"
        >
          ×
        </button>

        {/* Modal content */}
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4 text-gray-900">
            {isEmpty ? "Add Image to Frame" : "Frame Details"}
          </h2>

          {error && (
            <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
              {error}
            </div>
          )}

          {isEmpty ? (
            // Empty frame state
            <div className="space-y-4">
              {/* Tabs */}
              <div className="flex border-b border-gray-200">
                <button
                  onClick={() => {
                    setActiveTab("upload");
                    stopCamera();
                  }}
                  className={`px-4 py-2 font-medium ${
                    activeTab === "upload"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Upload
                </button>
                <button
                  onClick={() => setActiveTab("camera")}
                  className={`px-4 py-2 font-medium ${
                    activeTab === "camera"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  Camera
                </button>
                <button
                  onClick={() => {
                    setActiveTab("generate");
                    stopCamera();
                  }}
                  className={`px-4 py-2 font-medium ${
                    activeTab === "generate"
                      ? "border-b-2 border-blue-500 text-blue-600"
                      : "text-gray-600 hover:text-gray-800"
                  }`}
                >
                  AI Generate
                </button>
              </div>

              {/* Upload tab */}
              {activeTab === "upload" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (optional)
                    </label>
                    <input
                      type="text"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Enter image description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      maxLength={1000}
                    />
                  </div>

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
                      disabled={isUploading}
                      className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                    >
                      {isUploading ? "Uploading..." : "Choose File"}
                    </button>
                    <p className="text-xs text-gray-500 mt-2">
                      Supported formats: JPEG, PNG, WebP (max 10MB)
                    </p>
                  </div>
                </div>
              )}

              {/* Camera tab */}
              {activeTab === "camera" && (
                <div className="space-y-4">
                  {!isCameraActive ? (
                    <button
                      onClick={startCamera}
                      className="w-full px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Start Camera
                    </button>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          className="w-full"
                        />
                      </div>
                      <canvas ref={canvasRef} className="hidden" />
                      <div className="flex gap-2">
                        <button
                          onClick={capturePhoto}
                          disabled={isUploading}
                          className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                        >
                          {isUploading ? "Processing..." : "Capture Photo"}
                        </button>
                        <button
                          onClick={stopCamera}
                          className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AI Generate tab */}
              {activeTab === "generate" && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Prompt
                    </label>
                    <textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      placeholder="Describe the image you want to generate..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      rows={4}
                      maxLength={1000}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Style
                    </label>
                    <select
                      value={aiStyle}
                      onChange={(e) =>
                        setAiStyle(
                          e.target.value as
                            | "van-gogh"
                            | "impressionist"
                            | "realistic"
                            | "abstract"
                            | "watercolor"
                        )
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="realistic">Realistic</option>
                      <option value="van-gogh">Van Gogh</option>
                      <option value="impressionist">Impressionist</option>
                      <option value="abstract">Abstract</option>
                      <option value="watercolor">Watercolor</option>
                    </select>
                  </div>

                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !aiPrompt.trim()}
                    className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                  >
                    {isGenerating ? "Generating..." : "Generate Image"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            // Filled frame state
            <div className="space-y-4">
              {/* Image preview */}
              {frame.imageUrl && (
                <div className="relative bg-gray-100 rounded-lg overflow-hidden">
                  <img
                    src={frame.imageUrl}
                    alt={frame.description || "Frame image"}
                    className="w-full h-64 object-contain"
                  />
                </div>
              )}

              {/* Description */}
              {frame.description && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-1">
                    Description
                  </h3>
                  <p className="text-gray-900">{frame.description}</p>
                </div>
              )}

              {/* Theme colors */}
              {frame.themeColors && frame.themeColors.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Theme Colors
                  </h3>
                  <div className="flex gap-2">
                    {frame.themeColors.map((color, index) => (
                      <div
                        key={index}
                        className="w-12 h-12 rounded-lg border border-gray-300 shadow-sm"
                        style={{ backgroundColor: color }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Share section */}
              {shareUrl && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm font-medium text-green-800 mb-2">
                    Share Link Generated
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={shareUrl}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white border border-green-300 rounded text-sm"
                    />
                    <button
                      onClick={copyShareUrl}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium text-sm transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 pt-4">
                <button
                  onClick={handleShare}
                  disabled={generateShareLinkMutation.isPending}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {generateShareLinkMutation.isPending ? "Generating..." : "Share"}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteFrameMutation.isPending}
                  className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
                >
                  {deleteFrameMutation.isPending ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
