import { Storage } from "@google-cloud/storage";

if (!process.env.GOOGLE_CLOUD_STORAGE_BUCKET) {
  throw new Error("GOOGLE_CLOUD_STORAGE_BUCKET environment variable is not set");
}

if (!process.env.GOOGLE_CLOUD_PROJECT_ID) {
  throw new Error("GOOGLE_CLOUD_PROJECT_ID environment variable is not set");
}

// Initialize Google Cloud Storage
let credentials;
if (process.env.GOOGLE_CLOUD_CREDENTIALS) {
  try {
    credentials = JSON.parse(process.env.GOOGLE_CLOUD_CREDENTIALS);
  } catch (error) {
    throw new Error("Invalid GOOGLE_CLOUD_CREDENTIALS JSON format");
  }
}

export const storage = new Storage({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  credentials,
});

export const bucket = storage.bucket(process.env.GOOGLE_CLOUD_STORAGE_BUCKET);
