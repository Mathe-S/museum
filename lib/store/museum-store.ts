import { create } from "zustand";

// Types
export interface Museum {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  shareToken: string | null;
  themeMode: "day" | "night";
  createdAt: Date;
  updatedAt: Date;
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

export interface Visitor {
  id: string;
  name: string;
  position: { x: number; y: number; z: number };
  rotationY: number;
  lastUpdate: number;
}

interface MuseumStore {
  // Current museum data
  currentMuseum: Museum | null;
  frames: Frame[];

  // UI state
  isLoading: boolean;
  selectedFrame: Frame | null;
  showProfileOverlay: boolean;
  showTutorial: boolean;
  themeMode: "day" | "night";
  moveSpeed: number;
  shouldResetCamera: boolean;

  // Multiplayer state
  visitors: Map<string, Visitor>;
  visitorCount: number;

  // Actions
  setCurrentMuseum: (museum: Museum | null) => void;
  setFrames: (frames: Frame[]) => void;
  updateFrame: (frame: Frame) => void;
  deleteFrame: (frameId: string) => void;
  toggleTheme: () => void;
  setSelectedFrame: (frame: Frame | null) => void;
  setShowProfileOverlay: (show: boolean) => void;
  setShowTutorial: (show: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setMoveSpeed: (speed: number) => void;
  setShouldResetCamera: (reset: boolean) => void;

  // Multiplayer actions
  addVisitor: (visitor: Visitor) => void;
  updateVisitor: (
    visitorId: string,
    position: { x: number; y: number; z: number },
    rotation: number
  ) => void;
  removeVisitor: (visitorId: string) => void;
  setVisitorCount: (count: number) => void;
}

export const useMuseumStore = create<MuseumStore>((set) => ({
  // Initial state
  currentMuseum: null,
  frames: [],
  isLoading: false,
  selectedFrame: null,
  showProfileOverlay: false,
  showTutorial: false,
  themeMode: "day",
  moveSpeed: 10.0, // Increased from 5.0 to 10.0 for faster movement
  shouldResetCamera: false,
  visitors: new Map(),
  visitorCount: 0,

  // Actions
  setCurrentMuseum: (museum) => set({ currentMuseum: museum }),
  setFrames: (frames) => set({ frames }),
  updateFrame: (frame) =>
    set((state) => ({
      frames: state.frames.map((f) => (f.id === frame.id ? frame : f)),
    })),
  deleteFrame: (frameId) =>
    set((state) => ({
      frames: state.frames.filter((f) => f.id !== frameId),
    })),
  toggleTheme: () =>
    set((state) => ({
      themeMode: state.themeMode === "day" ? "night" : "day",
    })),
  setSelectedFrame: (frame) => set({ selectedFrame: frame }),
  setShowProfileOverlay: (show) => set({ showProfileOverlay: show }),
  setShowTutorial: (show) => set({ showTutorial: show }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setMoveSpeed: (speed) => set({ moveSpeed: speed }),
  setShouldResetCamera: (reset) => set({ shouldResetCamera: reset }),

  // Multiplayer actions
  addVisitor: (visitor) =>
    set((state) => {
      const newVisitors = new Map(state.visitors);
      newVisitors.set(visitor.id, visitor);
      return { visitors: newVisitors, visitorCount: newVisitors.size };
    }),
  updateVisitor: (visitorId, position, rotation) =>
    set((state) => {
      const newVisitors = new Map(state.visitors);
      const visitor = newVisitors.get(visitorId);
      if (visitor) {
        newVisitors.set(visitorId, {
          ...visitor,
          position,
          rotationY: rotation,
          lastUpdate: Date.now(),
        });
      }
      return { visitors: newVisitors };
    }),
  removeVisitor: (visitorId) =>
    set((state) => {
      const newVisitors = new Map(state.visitors);
      newVisitors.delete(visitorId);
      return { visitors: newVisitors, visitorCount: newVisitors.size };
    }),
  setVisitorCount: (count) => set({ visitorCount: count }),
}));
