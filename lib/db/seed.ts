import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, museums, frames, comments } from "./schema";
import { createId } from "@paralleldrive/cuid2";

const seed = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set");
  }

  console.log("⏳ Seeding database...");

  const connection = postgres(process.env.DATABASE_URL);
  const db = drizzle(connection, { schema: { users, museums, frames, comments } });

  // Create test users
  const testUser1Id = createId();
  const testUser2Id = createId();

  await db.insert(users).values([
    {
      id: testUser1Id,
      clerkId: "user_test_1",
      email: "alice@example.com",
      profilePicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
    },
    {
      id: testUser2Id,
      clerkId: "user_test_2",
      email: "bob@example.com",
      profilePicUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
    },
  ]);

  console.log("✅ Created test users");

  // Create test museums
  const museum1Id = createId();
  const museum2Id = createId();
  const museum3Id = createId();

  await db.insert(museums).values([
    {
      id: museum1Id,
      userId: testUser1Id,
      name: "Alice's Art Gallery",
      isPublic: true,
      shareToken: createId(),
      themeMode: "day",
    },
    {
      id: museum2Id,
      userId: testUser1Id,
      name: "Private Collection",
      isPublic: false,
      shareToken: null,
      themeMode: "night",
    },
    {
      id: museum3Id,
      userId: testUser2Id,
      name: "Bob's Modern Art",
      isPublic: true,
      shareToken: createId(),
      themeMode: "day",
    },
  ]);

  console.log("✅ Created test museums");

  // Create test frames for museum 1 (Main Hall - 9 frames)
  const mainHallFrames = Array.from({ length: 9 }, (_, i) => ({
    id: createId(),
    museumId: museum1Id,
    position: i,
    side: null,
    imageUrl: i < 5 ? `https://picsum.photos/seed/${i}/800/600` : null,
    description: i < 5 ? `Artwork ${i + 1} - A beautiful piece` : null,
    themeColors: i < 5 ? ["#FF6B6B", "#4ECDC4", "#45B7D1"] : null,
    shareToken: i < 5 ? createId() : null,
  }));

  // Create test frames for extendable hall (alternating left-right)
  const extendableFrames = [
    {
      id: createId(),
      museumId: museum1Id,
      position: 9,
      side: "left",
      imageUrl: "https://picsum.photos/seed/9/800/600",
      description: "Extendable Hall - First piece",
      themeColors: ["#95E1D3", "#F38181", "#EAFFD0"],
      shareToken: createId(),
    },
    {
      id: createId(),
      museumId: museum1Id,
      position: 10,
      side: "right",
      imageUrl: null,
      description: null,
      themeColors: null,
      shareToken: null,
    },
  ];

  await db.insert(frames).values([...mainHallFrames, ...extendableFrames]);

  console.log("✅ Created test frames");

  // Create test frames for museum 3
  const museum3Frames = Array.from({ length: 5 }, (_, i) => ({
    id: createId(),
    museumId: museum3Id,
    position: i,
    side: null,
    imageUrl: `https://picsum.photos/seed/bob${i}/800/600`,
    description: `Bob's artwork ${i + 1}`,
    themeColors: ["#667EEA", "#764BA2", "#F093FB"],
    shareToken: createId(),
  }));

  await db.insert(frames).values(museum3Frames);

  console.log("✅ Created frames for Bob's museum");

  // Create test comments
  const filledFrameIds = [...mainHallFrames, ...extendableFrames]
    .filter((f) => f.imageUrl)
    .map((f) => f.id);

  const testComments = [
    {
      id: createId(),
      frameId: filledFrameIds[0],
      userId: testUser2Id,
      authorName: "Bob",
      authorProfilePic: "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
      content: "This is absolutely stunning! Love the colors.",
    },
    {
      id: createId(),
      frameId: filledFrameIds[0],
      userId: null,
      authorName: "Anonymous Visitor",
      authorProfilePic: null,
      content: "Beautiful work! Where can I see more?",
    },
    {
      id: createId(),
      frameId: filledFrameIds[1],
      userId: testUser1Id,
      authorName: "Alice",
      authorProfilePic: "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
      content: "Thank you all for the kind words!",
    },
    {
      id: createId(),
      frameId: filledFrameIds[2],
      userId: null,
      authorName: "Anonymous Visitor",
      authorProfilePic: null,
      content: "The composition is perfect 👌",
    },
  ];

  await db.insert(comments).values(testComments);

  console.log("✅ Created test comments");

  await connection.end();

  console.log("🎉 Seeding completed successfully!");
  console.log("\nTest Data Summary:");
  console.log("- 2 users (Alice & Bob)");
  console.log("- 3 museums (2 for Alice, 1 for Bob)");
  console.log("- 16 frames (11 in Alice's gallery, 5 in Bob's)");
  console.log("- 4 comments");
  console.log("\nYou can now test the application with this data!");

  process.exit(0);
};

seed().catch((err) => {
  console.error("❌ Seeding failed");
  console.error(err);
  process.exit(1);
});
