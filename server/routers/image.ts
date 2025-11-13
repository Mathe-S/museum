import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Storage } from "@google-cloud/storage";
import { createId } from "@paralleldrive/cuid2";
import sharp from "sharp";
import { createTRPCRouter, protectedProcedure } from "../trpc";

// Lazy initialization of Google Cloud Storage
let storage: Storage | null = null;
let bucket: ReturnType<Storage["bucket"]> | null = null;

function getStorage() {
  if (!storage) {
    storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      credentials: process.env.GOOGLE_CLOUD_CREDENTIALS
        ? JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS)
        : undefined,
    });
  }
  return storage;
}

function getBucket() {
  if (!bucket) {
    const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET;
    if (!bucketName) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Google Cloud Storage bucket not configured.",
      });
    }
    bucket = getStorage().bucket(bucketName);
  }
  return bucket;
}

// Supported image types
const SUPPORTED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Extract dominant colors from image buffer
 */
async function extractThemeColors(imageBuffer: Buffer): Promise<string[]> {
  try {
    // Use sharp to get image stats and extract colors
    const { dominant } = await sharp(imageBuffer).stats();
    
    // Convert RGB to hex
    const toHex = (r: number, g: number, b: number) =>
      `#${[r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")}`;
    
    // Return dominant color
    return [toHex(dominant.r, dominant.g, dominant.b)];
  } catch (error) {
    console.error("Error extracting theme colors:", error);
    return ["#808080"]; // Default gray
  }
}

/**
 * Upload image buffer to Google Cloud Storage
 */
async function uploadToGCS(
  buffer: Buffer,
  filename: string,
  contentType: string
): Promise<string> {
  const bucketInstance = getBucket();
  const file = bucketInstance.file(filename);

  await file.save(buffer, {
    metadata: {
      contentType,
    },
    public: false, // Use signed URLs for access
  });

  const bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || "";
  return `gs://${bucketName}/${filename}`;
}

/**
 * Image router - handles image upload, optimization, and signed URL generation
 */
export const imageRouter = createTRPCRouter({
  /**
   * Upload and process image
   * - Validates file type and size
   * - Compresses and converts to WebP
   * - Generates multiple sizes (thumbnail, medium, full)
   * - Extracts theme colors
   * - Uploads to Google Cloud Storage
   */
  upload: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        contentType: z.string(),
        base64Data: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // Validate content type
      if (!SUPPORTED_MIME_TYPES.includes(input.contentType)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Unsupported file type. Only JPEG, PNG, and WebP are allowed.",
        });
      }

      // Decode base64 data
      const buffer = Buffer.from(input.base64Data, "base64");

      // Validate file size
      if (buffer.length > MAX_FILE_SIZE) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "File size exceeds 10MB limit.",
        });
      }

      // Generate unique ID for this image set
      const imageId = createId();

      try {
        // Process image with sharp
        const image = sharp(buffer);
        const metadata = await image.metadata();

        // Generate multiple sizes
        const sizes = {
          thumbnail: { width: 256, height: 256 },
          medium: { width: 1024, height: 1024 },
          full: { width: 2048, height: 2048 },
        };

        const uploadPromises: Promise<string>[] = [];
        const urls: Record<string, string> = {};

        for (const [sizeName, dimensions] of Object.entries(sizes)) {
          // Resize and convert to WebP
          const processedBuffer = await image
            .resize(dimensions.width, dimensions.height, {
              fit: "inside",
              withoutEnlargement: true,
            })
            .webp({ quality: 85 })
            .toBuffer();

          const filename = `images/${imageId}/${sizeName}.webp`;
          const uploadPromise = uploadToGCS(
            processedBuffer,
            filename,
            "image/webp"
          );
          uploadPromises.push(uploadPromise);
          urls[sizeName] = filename;
        }

        // Wait for all uploads to complete
        await Promise.all(uploadPromises);

        // Extract theme colors from the medium size
        const mediumBuffer = await image
          .resize(1024, 1024, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .toBuffer();

        const themeColors = await extractThemeColors(mediumBuffer);

        return {
          imageId,
          urls: {
            thumbnail: urls.thumbnail,
            medium: urls.medium,
            full: urls.full,
          },
          themeColors,
          metadata: {
            width: metadata.width,
            height: metadata.height,
            format: metadata.format,
          },
        };
      } catch (error) {
        console.error("Error processing image:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to process and upload image.",
        });
      }
    }),

  /**
   * Get signed URL for accessing an image
   * Returns a URL that expires after the specified duration
   */
  getSignedUrl: protectedProcedure
    .input(
      z.object({
        filename: z.string(),
        expiresIn: z.number().min(60).max(86400).optional().default(3600), // 1 hour default, max 24 hours
      })
    )
    .query(async ({ input }) => {
      try {
        const bucketInstance = getBucket();
        const file = bucketInstance.file(input.filename);

        // Check if file exists
        const [exists] = await file.exists();
        if (!exists) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Image not found.",
          });
        }

        // Generate signed URL
        const [signedUrl] = await file.getSignedUrl({
          action: "read",
          expires: Date.now() + input.expiresIn * 1000,
        });

        return {
          url: signedUrl,
          expiresAt: new Date(Date.now() + input.expiresIn * 1000),
        };
      } catch (error) {
        console.error("Error generating signed URL:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to generate signed URL.",
        });
      }
    }),
});
