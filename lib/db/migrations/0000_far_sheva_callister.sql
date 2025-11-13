CREATE TABLE "comments" (
	"id" text PRIMARY KEY NOT NULL,
	"frame_id" text NOT NULL,
	"user_id" text,
	"author_name" text NOT NULL,
	"author_profile_pic" text,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "frames" (
	"id" text PRIMARY KEY NOT NULL,
	"museum_id" text NOT NULL,
	"position" integer NOT NULL,
	"side" text,
	"image_url" text,
	"description" text,
	"theme_colors" jsonb,
	"share_token" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "frames_share_token_unique" UNIQUE("share_token"),
	CONSTRAINT "frames_museum_position_unique" UNIQUE("museum_id","position")
);
--> statement-breakpoint
CREATE TABLE "museums" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'My Museum' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"share_token" text,
	"theme_mode" text DEFAULT 'day' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "museums_share_token_unique" UNIQUE("share_token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"clerk_id" text NOT NULL,
	"email" text NOT NULL,
	"profile_pic_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_frame_id_frames_id_fk" FOREIGN KEY ("frame_id") REFERENCES "public"."frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "frames" ADD CONSTRAINT "frames_museum_id_museums_id_fk" FOREIGN KEY ("museum_id") REFERENCES "public"."museums"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "museums" ADD CONSTRAINT "museums_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_frame_id_idx" ON "comments" USING btree ("frame_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "frames_museum_id_idx" ON "frames" USING btree ("museum_id");--> statement-breakpoint
CREATE INDEX "frames_share_token_idx" ON "frames" USING btree ("share_token");--> statement-breakpoint
CREATE INDEX "museums_user_id_idx" ON "museums" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "museums_share_token_idx" ON "museums" USING btree ("share_token");