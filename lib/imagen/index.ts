// Google Imagen API client configuration
// Uses Google's Vertex AI Imagen API for AI-powered image generation

if (!process.env.GOOGLE_IMAGEN_API_KEY) {
  console.warn("GOOGLE_IMAGEN_API_KEY environment variable is not set");
}

export interface ImageGenerationParams {
  prompt: string;
  style?: string;
}

export interface ImageGenerationResult {
  imageData: Buffer;
}

// Style preset mappings to Imagen parameters
const STYLE_PRESETS: Record<string, string> = {
  "van-gogh": "in the style of Vincent van Gogh, post-impressionist painting with bold brushstrokes and vibrant colors",
  "impressionist": "impressionist painting style with soft brushwork, light effects, and vivid colors",
  "realistic": "photorealistic, highly detailed",
  "abstract": "abstract art style with geometric shapes and bold colors",
  "watercolor": "watercolor painting style with soft washes and delicate details",
};

/**
 * Generate an image using Google Imagen API
 * @param params - Generation parameters including prompt and optional style
 * @returns Buffer containing the generated image data
 */
export async function generateImage(
  params: ImageGenerationParams
): Promise<ImageGenerationResult> {
  const apiKey = process.env.GOOGLE_IMAGEN_API_KEY;
  
  if (!apiKey) {
    throw new Error("GOOGLE_IMAGEN_API_KEY is not configured");
  }

  // Build the full prompt with style if provided
  let fullPrompt = params.prompt;
  if (params.style && STYLE_PRESETS[params.style]) {
    fullPrompt = `${params.prompt}, ${STYLE_PRESETS[params.style]}`;
  }

  try {
    // Google Vertex AI Imagen API endpoint
    const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
    const location = "us-central1"; // Default location for Imagen
    
    if (!projectId) {
      throw new Error("GOOGLE_CLOUD_PROJECT_ID is not configured");
    }

    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/imagegeneration@006:predict`;

    const requestBody = {
      instances: [
        {
          prompt: fullPrompt,
        },
      ],
      parameters: {
        sampleCount: 1,
        aspectRatio: "1:1", // Square images for frames
        safetyFilterLevel: "block_some",
        personGeneration: "allow_adult",
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Imagen API error:", errorText);
      
      // Handle rate limiting
      if (response.status === 429) {
        throw new Error("Rate limit exceeded. Please try again later.");
      }
      
      // Handle quota errors
      if (response.status === 403) {
        throw new Error("API quota exceeded or access denied. Please check your API configuration.");
      }
      
      throw new Error(`Image generation failed: ${response.statusText}`);
    }

    const result = await response.json();
    
    // Extract the base64 image data from the response
    if (!result.predictions || result.predictions.length === 0) {
      throw new Error("No image generated");
    }

    const prediction = result.predictions[0];
    const base64Image = prediction.bytesBase64Encoded || prediction.image?.bytesBase64Encoded;
    
    if (!base64Image) {
      throw new Error("No image data in response");
    }

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
