import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
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
