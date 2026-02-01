import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { creatorProfile, creatorToken } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { buildAndSendCreateToken } from "@/lib/solana/create-token";

interface LaunchInput {
  tokenName?: string;
  tickerSymbol?: string;
  description?: string;
  imageUrl?: string;
  burnSolPrice?: number;
}

const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: LaunchInput;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tokenName, tickerSymbol, description, imageUrl, burnSolPrice } = body;

  // --- Validate inputs ---

  if (!tokenName || typeof tokenName !== "string") {
    return Response.json(
      { error: "tokenName is required" },
      { status: 400 },
    );
  }

  const trimmedName = tokenName.trim();
  if (trimmedName.length < 2 || trimmedName.length > 32) {
    return Response.json(
      { error: "tokenName must be between 2 and 32 characters" },
      { status: 400 },
    );
  }

  if (!tickerSymbol || typeof tickerSymbol !== "string") {
    return Response.json(
      { error: "tickerSymbol is required" },
      { status: 400 },
    );
  }

  const trimmedTicker = tickerSymbol.trim().toUpperCase();
  if (trimmedTicker.length < 2 || trimmedTicker.length > 10) {
    return Response.json(
      { error: "tickerSymbol must be between 2 and 10 characters" },
      { status: 400 },
    );
  }

  if (!/^[A-Z]+$/.test(trimmedTicker)) {
    return Response.json(
      { error: "tickerSymbol must contain only uppercase letters" },
      { status: 400 },
    );
  }

  if (burnSolPrice === undefined || typeof burnSolPrice !== "number" || burnSolPrice <= 0) {
    return Response.json(
      { error: "burnSolPrice must be a positive number" },
      { status: 400 },
    );
  }

  // --- Server-side checks ---

  // 1. Creator profile must exist with approved KYC
  const profile = await db.query.creatorProfile.findFirst({
    where: eq(creatorProfile.userId, session.user.id),
  });

  if (!profile) {
    return Response.json(
      { error: "Creator profile not found. Complete onboarding first." },
      { status: 403 },
    );
  }

  if (profile.kycStatus !== "approved") {
    return Response.json(
      { error: "Identity verification must be approved before launching a token" },
      { status: 403 },
    );
  }

  // 2. 90-day cooldown check
  if (profile.lastTokenLaunchAt) {
    const elapsed = Date.now() - profile.lastTokenLaunchAt.getTime();
    if (elapsed < NINETY_DAYS_MS) {
      const remainingDays = Math.ceil(
        (NINETY_DAYS_MS - elapsed) / (24 * 60 * 60 * 1000),
      );
      return Response.json(
        { error: `You must wait ${remainingDays} more day${remainingDays === 1 ? "" : "s"} before launching another token` },
        { status: 403 },
      );
    }
  }

  // --- Execute on-chain transaction ---

  // Convert burnSolPrice from SOL to lamports
  const burnSolPriceLamports = BigInt(Math.round(burnSolPrice * 1e9));

  try {
    const result = await buildAndSendCreateToken(
      session.user.id,
      burnSolPriceLamports,
    );

    // Record token in database
    await db.insert(creatorToken).values({
      id: crypto.randomUUID(),
      creatorProfileId: profile.id,
      tokenName: trimmedName,
      tickerSymbol: trimmedTicker,
      description: description?.trim() || null,
      imageUrl: imageUrl || null,
      mintAddress: result.mintAddress,
      bondingCurveAddress: result.bondingCurveAddress,
      vestingAddress: result.vestingAddress,
      txSignature: result.signature,
    });

    // Update creator profile with launch timestamp
    await db
      .update(creatorProfile)
      .set({
        lastTokenLaunchAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(creatorProfile.id, profile.id));

    return Response.json({
      success: true,
      mintAddress: result.mintAddress,
      txSignature: result.signature,
      bondingCurveAddress: result.bondingCurveAddress,
      vestingAddress: result.vestingAddress,
    });
  } catch (error) {
    console.error("Token launch failed:", error);
    return Response.json(
      {
        error: error instanceof Error
          ? error.message
          : "Token launch failed. Please try again.",
      },
      { status: 500 },
    );
  }
}
