// Google Gemini Image API client configuration
// Uses Google's Gemini 2.5 Flash Image model for AI-powered image generation

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY environment variable is not set");
}

export interface ImageGenerationParams {
  prompt: string;
  style?: string;
  baseImage?: string; // base64 encoded image for style transfer
}

export interface ImageGenerationResult {
  imageData: Buffer;
}

// Style preset mappings to Imagen parameters
const STYLE_PRESETS: Record<string, string> = {
  "van-gogh":
    "in the style of Vincent van Gogh, post-impressionist painting with bold brushstrokes and vibrant colors",
  impressionist:
    "impressionist painting style with soft brushwork, light effects, and vivid colors",
  realistic: "photorealistic, highly detailed",
  abstract: "abstract art style with geometric shapes and bold colors",
  watercolor: "watercolor painting style with soft washes and delicate details",
};

/**
 * Generate an image using Google Imagen API
 * @param params - Generation parameters including prompt and optional style
 * @returns Buffer containing the generated image data
 */
export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  // Build the full prompt with style if provided
  let fullPrompt = params.prompt;
  if (params.baseImage) {
    // For image-to-image: explicitly instruct to use the provided image
    if (params.style && STYLE_PRESETS[params.style]) {
      fullPrompt = `Transform this image: ${params.prompt}, apply ${
        STYLE_PRESETS[params.style]
      }. Keep the main subject and composition from the original image.`;
    } else {
      fullPrompt = `Transform this image based on: ${params.prompt}. Keep the main elements from the original image.`;
    }
  } else {
    // For text-to-image: use style preset normally
    if (params.style && STYLE_PRESETS[params.style]) {
      fullPrompt = `${params.prompt}, ${STYLE_PRESETS[params.style]}`;
    }
  }

  try {
    // Gemini API endpoint for image generation
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent`;

    // Build requestParts array - include base image if provided for style transfer
    const requestParts: Array<{
      text?: string;
      inlineData?: { mimeType: string; data: string };
    }> = [];

    if (params.baseImage) {
      // For image-to-image, add the base image first
      requestParts.push({
        inlineData: {
          mimeType: "image/jpeg",
          data: params.baseImage,
        },
      });
    }

    // Add the text prompt
    requestParts.push({ text: fullPrompt });

    const requestBody = {
      contents: [
        {
          parts: requestParts,
        },
      ],
      generationConfig: {
        responseModalities: ["IMAGE"],
        // Use 1:1 aspect ratio (default) for smaller, more cost-effective images
        imageConfig: {
          aspectRatio: "1:1",
        },
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", errorText);

      // Handle rate limiting
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }

      // Handle quota errors
      if (response.status === 403) {
        throw new Error(
          "API quota exceeded or access denied. Please check your API configuration."
        );
      }

      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const result = await response.json();

    // Extract the base64 image data from Gemini response
    if (!result.candidates || result.candidates.length === 0) {
      throw new Error("No image generated");
    }

    const candidate = result.candidates[0];
    const parts = candidate.content?.parts || [];

    // Find the part with inline image data
    const imagePart = parts.find((part: any) => part.inlineData);

    if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
      throw new Error("No image data in response");
    }

    const base64Image = imagePart.inlineData.data;

    // Convert base64 to buffer
    const imageData = Buffer.from(base64Image, "base64");

    return {
      imageData,
    };
  } catch (error) {
    console.error("Error generating image with Imagen:", error);

    // Re-throw with more context
    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Failed to generate image");
  }
}
