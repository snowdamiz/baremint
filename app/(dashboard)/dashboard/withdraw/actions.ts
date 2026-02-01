"use server";

import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { savedAddress, withdrawal } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { buildAndSendSolTransfer } from "@/lib/solana/transfer";

async function getAuthenticatedUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    throw new Error("Not authenticated");
  }
  return session.user;
}

// ---------------------------------------------------------------------------
// Address Book
// ---------------------------------------------------------------------------

export async function getSavedAddresses() {
  const user = await getAuthenticatedUser();
  const addresses = await db.query.savedAddress.findMany({
    where: eq(savedAddress.userId, user.id),
    orderBy: (sa, { asc }) => [asc(sa.label)],
  });
  return addresses;
}

export async function saveAddress(address: string, label: string) {
  const user = await getAuthenticatedUser();

  if (!address || !label) {
    return { error: "Address and label are required" };
  }

  // Validate Solana address format (base58, 32-44 chars)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
    return { error: "Invalid Solana address" };
  }

  await db.insert(savedAddress).values({
    id: crypto.randomUUID(),
    userId: user.id,
    address,
    label,
  });

  return { success: true };
}

export async function deleteAddress(addressId: string) {
  const user = await getAuthenticatedUser();

  await db.delete(savedAddress).where(
    and(
      eq(savedAddress.id, addressId),
      eq(savedAddress.userId, user.id),
    ),
  );

  return { success: true };
}

// ---------------------------------------------------------------------------
// Withdrawal
// ---------------------------------------------------------------------------

export async function executeWithdrawal(
  toAddress: string,
  amountLamports: string,
  totpCode: string,
) {
  const user = await getAuthenticatedUser();

  // 1. Verify 2FA is enabled
  if (!user.twoFactorEnabled) {
    return { error: "Two-factor authentication must be enabled before withdrawing" };
  }

  // 2. Verify TOTP code server-side
  const verifyResult = await auth.api.verifyTOTP({
    body: { code: totpCode },
    headers: await headers(),
  });

  if (!verifyResult || "error" in verifyResult) {
    return { error: "Invalid 2FA code" };
  }

  // 3. Validate inputs
  if (!toAddress || !amountLamports) {
    return { error: "Destination address and amount are required" };
  }

  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(toAddress)) {
    return { error: "Invalid Solana address" };
  }

  const lamports = BigInt(amountLamports);
  if (lamports <= BigInt(0)) {
    return { error: "Amount must be greater than zero" };
  }

  // 4. Execute transfer
  try {
    const result = await buildAndSendSolTransfer(
      user.id,
      toAddress,
      lamports,
    );
    return {
      success: true,
      signature: result.signature,
      withdrawalId: result.withdrawalId,
    };
  } catch (error) {
    console.error("Withdrawal failed:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "Withdrawal failed. Please try again.",
    };
  }
}
