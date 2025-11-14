import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  unique,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createId } from "@paralleldrive/cuid2";

export const users = pgTable("users", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull().unique(),
  profilePicUrl: text("profile_pic_url"),
  tutorialDismissed: boolean("tutorial_dismissed").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const museums = pgTable(
  "museums",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull().default("My Museum"),
    isPublic: boolean("is_public").notNull().default(false),
    shareToken: text("share_token").unique(),
    themeMode: text("theme_mode").notNull().default("day"), // "day" or "night"
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("museums_user_id_idx").on(table.userId),
    shareTokenIdx: index("museums_share_token_idx").on(table.shareToken),
  })
);

export const frames = pgTable(
  "frames",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    museumId: text("museum_id")
      .notNull()
      .references(() => museums.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 0-8 for main hall, 9+ for extendable hall
    side: text("side"), // "left" or "right" for extendable hall frames
    imageUrl: text("image_url"),
    description: text("description"),
    themeColors: jsonb("theme_colors"), // Array of hex colors extracted from image
    shareToken: text("share_token").unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    museumIdIdx: index("frames_museum_id_idx").on(table.museumId),
    shareTokenIdx: index("frames_share_token_idx").on(table.shareToken),
    museumPositionUnique: unique("frames_museum_position_unique").on(
      table.museumId,
      table.position
    ),
  })
);

export const comments = pgTable(
  "comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    frameId: text("frame_id")
      .notNull()
      .references(() => frames.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }), // Nullable for guest comments
    authorName: text("author_name").notNull(), // "Anonymous Visitor" or user name
    authorProfilePic: text("author_profile_pic"), // Null for guests
    content: text("content").notNull(), // Max 500 chars validated in app
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    frameIdIdx: index("comments_frame_id_idx").on(table.frameId),
    userIdIdx: index("comments_user_id_idx").on(table.userId),
    createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  museums: many(museums),
  comments: many(comments),
}));

export const museumsRelations = relations(museums, ({ one, many }) => ({
  user: one(users, {
    fields: [museums.userId],
    references: [users.id],
  }),
  frames: many(frames),
}));

export const framesRelations = relations(frames, ({ one, many }) => ({
  museum: one(museums, {
    fields: [frames.museumId],
    references: [museums.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  frame: one(frames, {
    fields: [comments.frameId],
    references: [frames.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
}));
