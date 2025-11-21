import React, { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface FrameImagePreviewProps {
  imageUrl: string;
  description: string;
}

export function FrameImagePreview({ imageUrl, description }: FrameImagePreviewProps) {
  const [src, setSrc] = useState<string | null>(null);

  const { data: signedUrlData } = trpc.image.getSignedUrl.useQuery(
    { filename: imageUrl },
    {
      enabled: !!imageUrl && !imageUrl.startsWith("http"),
      staleTime: 1000 * 60 * 55,
    }
  );

  useEffect(() => {
    if (imageUrl.startsWith("http")) {
      setSrc(imageUrl);
    } else if (signedUrlData) {
      setSrc(signedUrlData.url);
    }
  }, [imageUrl, signedUrlData]);

  if (!src) {
    return (
      <div className="relative bg-gray-100 rounded-lg overflow-hidden h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400"></div>
      </div>
    );
  }

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden">
      <img
        src={src}
        alt={description}
        className="w-full h-64 object-contain"
      />
    </div>
  );
}

