// Shared types for the application
// Will be expanded as needed in subsequent tasks

export type ThemeMode = "day" | "night";

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Frame {
  id: string;
  museumId: string;
  position: number;
  side: string | null;
  imageUrl: string | null;
  description: string | null;
  themeColors: string[] | null;
  shareToken: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Museum {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  shareToken: string | null;
  themeMode: ThemeMode;
  createdAt: Date;
  updatedAt: Date;
}
