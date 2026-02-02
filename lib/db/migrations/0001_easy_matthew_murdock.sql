CREATE TABLE "content_unlock" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"post_id" text NOT NULL,
	"tx_signature" text NOT NULL,
	"tokens_burned" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"banner_url" text,
	"social_twitter" text,
	"social_instagram" text,
	"social_youtube" text,
	"social_website" text,
	"category" text,
	"kyc_status" text DEFAULT 'none' NOT NULL,
	"kyc_applicant_id" text,
	"kyc_rejection_reason" text,
	"last_token_launch_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "creator_strike" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_profile_id" text NOT NULL,
	"moderation_action_id" text NOT NULL,
	"strike_number" integer NOT NULL,
	"consequence" text NOT NULL,
	"reason" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creator_token" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_profile_id" text NOT NULL,
	"token_name" text NOT NULL,
	"ticker_symbol" text NOT NULL,
	"description" text,
	"image_url" text,
	"mint_address" text NOT NULL,
	"bonding_curve_address" text NOT NULL,
	"vesting_address" text NOT NULL,
	"tx_signature" text NOT NULL,
	"launched_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creator_token_mint_address_unique" UNIQUE("mint_address")
);
--> statement-breakpoint
CREATE TABLE "donation" (
	"id" text PRIMARY KEY NOT NULL,
	"from_user_id" text NOT NULL,
	"to_creator_profile_id" text NOT NULL,
	"type" text NOT NULL,
	"amount" text NOT NULL,
	"mint_address" text,
	"tx_signature" text NOT NULL,
	"status" text DEFAULT 'confirmed' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"post_id" text,
	"creator_profile_id" text NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"original_key" text,
	"variants" jsonb,
	"mux_asset_id" text,
	"mux_playback_id" text,
	"mux_upload_id" text,
	"duration" integer,
	"width" integer,
	"height" integer,
	"mime_type" text,
	"file_size" integer,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "moderation_action" (
	"id" text PRIMARY KEY NOT NULL,
	"media_id" text,
	"post_id" text,
	"action" text NOT NULL,
	"reason" text,
	"confidence" text,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" text PRIMARY KEY NOT NULL,
	"creator_profile_id" text NOT NULL,
	"content" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"access_level" text DEFAULT 'public' NOT NULL,
	"token_threshold" text,
	"creator_token_id" text,
	"published_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "token_balance_cache" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_address" text NOT NULL,
	"mint_address" text NOT NULL,
	"balance" text NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"creator_token_id" text NOT NULL,
	"mint_address" text NOT NULL,
	"type" text NOT NULL,
	"sol_amount" text NOT NULL,
	"token_amount" text NOT NULL,
	"fee_amount" text NOT NULL,
	"price_per_token" text,
	"tx_signature" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	CONSTRAINT "trade_tx_signature_unique" UNIQUE("tx_signature")
);
--> statement-breakpoint
ALTER TABLE "content_unlock" ADD CONSTRAINT "content_unlock_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_unlock" ADD CONSTRAINT "content_unlock_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_profile" ADD CONSTRAINT "creator_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_strike" ADD CONSTRAINT "creator_strike_creator_profile_id_creator_profile_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_strike" ADD CONSTRAINT "creator_strike_moderation_action_id_moderation_action_id_fk" FOREIGN KEY ("moderation_action_id") REFERENCES "public"."moderation_action"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creator_token" ADD CONSTRAINT "creator_token_creator_profile_id_creator_profile_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "donation" ADD CONSTRAINT "donation_to_creator_profile_id_creator_profile_id_fk" FOREIGN KEY ("to_creator_profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_creator_profile_id_creator_profile_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "moderation_action" ADD CONSTRAINT "moderation_action_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_creator_profile_id_creator_profile_id_fk" FOREIGN KEY ("creator_profile_id") REFERENCES "public"."creator_profile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_creator_token_id_creator_token_id_fk" FOREIGN KEY ("creator_token_id") REFERENCES "public"."creator_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_creator_token_id_creator_token_id_fk" FOREIGN KEY ("creator_token_id") REFERENCES "public"."creator_token"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "content_unlock_user_post_idx" ON "content_unlock" USING btree ("user_id","post_id");--> statement-breakpoint
CREATE UNIQUE INDEX "token_balance_cache_wallet_mint_idx" ON "token_balance_cache" USING btree ("wallet_address","mint_address");