import crypto from "node:crypto";
import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins";
import { nextCookies } from "better-auth/next-js";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import { wallet } from "./db/schema";
import {
  generateWalletKeypair,
  encryptPrivateKey,
  getEncryptionKey,
} from "./solana/keypair";

export const auth = betterAuth({
  appName: "Baremint",
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    twitter: {
      clientId: process.env.TWITTER_CLIENT_ID!,
      clientSecret: process.env.TWITTER_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const { publicKey, privateKeyBytes } = generateWalletKeypair();
            const encryptionKey = getEncryptionKey();
            const encryptedPrivateKey = encryptPrivateKey(
              privateKeyBytes,
              encryptionKey,
            );

            await db.insert(wallet).values({
              id: crypto.randomUUID(),
              userId: user.id,
              publicKey,
              encryptedPrivateKey,
            });
          } catch (error) {
            // Log but don't block user creation -- wallet can be retried
            console.error("Failed to create wallet for user:", user.id, error);
          }
        },
      },
    },
  },
  plugins: [
    twoFactor({
      issuer: "Baremint",
      totpOptions: {
        digits: 6,
        period: 30,
      },
      backupCodeOptions: {
        amount: 10,
        length: 10,
      },
    }),
    nextCookies(), // MUST be last plugin
  ],
});
