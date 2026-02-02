import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ──────────────────────────────────────────────
// Better Auth tables
// ──────────────────────────────────────────────

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const twoFactor = pgTable("two_factor", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  secret: text("secret"),
  backupCodes: text("backup_codes"),
});

// ──────────────────────────────────────────────
// Custom Baremint tables
// ──────────────────────────────────────────────

export const wallet = pgTable("wallet", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id)
    .unique(),
  publicKey: text("public_key").notNull().unique(),
  encryptedPrivateKey: text("encrypted_private_key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const savedAddress = pgTable("saved_address", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  address: text("address").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const withdrawal = pgTable("withdrawal", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  fromAddress: text("from_address").notNull(),
  toAddress: text("to_address").notNull(),
  amountLamports: text("amount_lamports").notNull(),
  networkFeeLamports: text("network_fee_lamports"),
  txSignature: text("tx_signature"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

// ──────────────────────────────────────────────
// Creator tables (Phase 3)
// ──────────────────────────────────────────────

export const creatorProfile = pgTable("creator_profile", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id)
    .unique(),
  displayName: text("display_name").notNull(),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  bannerUrl: text("banner_url"),
  socialTwitter: text("social_twitter"),
  socialInstagram: text("social_instagram"),
  socialYoutube: text("social_youtube"),
  socialWebsite: text("social_website"),
  kycStatus: text("kyc_status").notNull().default("none"), // none | pending | approved | rejected
  kycApplicantId: text("kyc_applicant_id"),
  kycRejectionReason: text("kyc_rejection_reason"),
  lastTokenLaunchAt: timestamp("last_token_launch_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const creatorToken = pgTable("creator_token", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  tokenName: text("token_name").notNull(),
  tickerSymbol: text("ticker_symbol").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  mintAddress: text("mint_address").notNull().unique(),
  bondingCurveAddress: text("bonding_curve_address").notNull(),
  vestingAddress: text("vesting_address").notNull(),
  txSignature: text("tx_signature").notNull(),
  launchedAt: timestamp("launched_at").notNull().defaultNow(),
});

// ──────────────────────────────────────────────
// Content tables (Phase 4)
// ──────────────────────────────────────────────

export const post = pgTable("post", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  content: text("content"),
  status: text("status").notNull().default("draft"), // draft | processing | published | under_review | removed
  accessLevel: text("access_level").notNull().default("public"), // public | hold_gated | burn_gated
  tokenThreshold: text("token_threshold"), // raw token amount as string (BigInt), required when gated
  creatorTokenId: text("creator_token_id").references(() => creatorToken.id), // FK to token that gates this post
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const media = pgTable("media", {
  id: text("id").primaryKey(),
  postId: text("post_id").references(() => post.id),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  type: text("type").notNull(), // image | video
  status: text("status").notNull().default("uploading"), // uploading | scanning | processing | ready | flagged | failed
  originalKey: text("original_key"),
  variants: jsonb("variants"), // { sm: url, md: url, lg: url }
  muxAssetId: text("mux_asset_id"),
  muxPlaybackId: text("mux_playback_id"),
  muxUploadId: text("mux_upload_id"),
  duration: integer("duration"), // seconds, video only
  width: integer("width"),
  height: integer("height"),
  mimeType: text("mime_type"),
  fileSize: integer("file_size"), // bytes
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const moderationAction = pgTable("moderation_action", {
  id: text("id").primaryKey(),
  mediaId: text("media_id").references(() => media.id),
  postId: text("post_id").references(() => post.id),
  action: text("action").notNull(), // flag_csam | approve | reject | remove
  reason: text("reason"), // hash_match | classifier | manual
  confidence: text("confidence"), // CSAM classifier score as string
  reviewedBy: text("reviewed_by").references(() => user.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const creatorStrike = pgTable("creator_strike", {
  id: text("id").primaryKey(),
  creatorProfileId: text("creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  moderationActionId: text("moderation_action_id")
    .notNull()
    .references(() => moderationAction.id),
  strikeNumber: integer("strike_number").notNull(), // 1, 2, or 3
  consequence: text("consequence").notNull(), // warning | restriction | suspension
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ──────────────────────────────────────────────
// Token gating tables (Phase 5)
// ──────────────────────────────────────────────

// ──────────────────────────────────────────────
// Token Trading tables (Phase 6)
// ──────────────────────────────────────────────

export const trade = pgTable("trade", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id),
  creatorTokenId: text("creator_token_id")
    .notNull()
    .references(() => creatorToken.id),
  mintAddress: text("mint_address").notNull(),
  type: text("type").notNull(), // "buy" | "sell"
  solAmount: text("sol_amount").notNull(), // lamports as string
  tokenAmount: text("token_amount").notNull(), // raw token amount as string
  feeAmount: text("fee_amount").notNull(), // total fee in lamports as string
  pricePerToken: text("price_per_token"), // SOL per token ratio as string
  txSignature: text("tx_signature").notNull().unique(),
  status: text("status").notNull().default("pending"), // pending | confirmed | failed
  createdAt: timestamp("created_at").notNull().defaultNow(),
  confirmedAt: timestamp("confirmed_at"),
});

// ──────────────────────────────────────────────
// Burn-to-Unlock tables (Phase 7)
// ──────────────────────────────────────────────

export const contentUnlock = pgTable(
  "content_unlock",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id),
    postId: text("post_id")
      .notNull()
      .references(() => post.id),
    txSignature: text("tx_signature").notNull(),
    tokensBurned: text("tokens_burned").notNull(), // BigInt string
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("content_unlock_user_post_idx").on(table.userId, table.postId),
  ],
);

// ──────────────────────────────────────────────
// Donation tables (Phase 8)
// ──────────────────────────────────────────────

export const donation = pgTable("donation", {
  id: text("id").primaryKey(),
  fromUserId: text("from_user_id")
    .notNull()
    .references(() => user.id),
  toCreatorProfileId: text("to_creator_profile_id")
    .notNull()
    .references(() => creatorProfile.id),
  type: text("type").notNull(), // "sol" | "token"
  amount: text("amount").notNull(), // lamports (SOL) or raw token amount as BigInt string
  mintAddress: text("mint_address"), // null for SOL tips, mint address for token tips
  txSignature: text("tx_signature").notNull(),
  status: text("status").notNull().default("confirmed"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tokenBalanceCache = pgTable(
  "token_balance_cache",
  {
    id: text("id").primaryKey(),
    walletAddress: text("wallet_address").notNull(),
    mintAddress: text("mint_address").notNull(),
    balance: text("balance").notNull(), // raw token amount as string (BigInt)
    checkedAt: timestamp("checked_at").notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("token_balance_cache_wallet_mint_idx").on(
      table.walletAddress,
      table.mintAddress,
    ),
  ],
);
