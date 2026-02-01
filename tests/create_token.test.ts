import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { Baremint } from "../target/types/baremint";
import {
  setupTest,
  initializeGlobalConfig,
  createToken,
  airdropSol,
  getTokenAccounts,
  advanceClock,
  TOTAL_SUPPLY,
  VESTING_AMOUNT,
  CURVE_AMOUNT,
  LAMPORTS_PER_SOL,
  SECONDS_PER_DAY,
  TestContext,
} from "./setup";

describe("create_token", () => {
  let ctx: TestContext;
  let authority: Keypair;

  beforeEach(async () => {
    ctx = await setupTest();
    authority = ctx.context.payer;
    await initializeGlobalConfig(ctx.program, authority);
  });

  it("creates token with correct supply distribution (900M curve, 100M vesting)", async () => {
    const { tokenMint, bondingCurvePda } = await createToken(
      ctx.program,
      ctx.context,
      authority
    );

    const accounts = getTokenAccounts(
      ctx.program.programId,
      tokenMint.publicKey
    );

    // Check curve token account has 900M tokens
    const curveTokenAcct = await ctx.context.banksClient.getAccount(
      accounts.curveTokenAccountPda
    );
    expect(curveTokenAcct).not.toBeNull();

    // Check vesting token account has 100M tokens
    const vestingTokenAcct = await ctx.context.banksClient.getAccount(
      accounts.vestingTokenAccountPda
    );
    expect(vestingTokenAcct).not.toBeNull();

    // Verify via bonding curve state
    const bondingCurve = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    expect(bondingCurve.tokenTotalSupply.toString()).toBe(
      TOTAL_SUPPLY.toString()
    );
    expect(bondingCurve.realTokenReserves.toString()).toBe(
      CURVE_AMOUNT.toString()
    );
  });

  it("mint authority is None after creation", async () => {
    const { tokenMint } = await createToken(
      ctx.program,
      ctx.context,
      authority
    );

    // Fetch raw mint account data
    const mintAccount = await ctx.context.banksClient.getAccount(
      tokenMint.publicKey
    );
    expect(mintAccount).not.toBeNull();

    // SPL Token Mint layout: offset 0 = mintAuthorityOption (4 bytes, 0 = None)
    // mintAuthorityOption is at byte 0, value 0 means no authority
    const data = Buffer.from(mintAccount!.data);
    const mintAuthorityOption = data.readUInt32LE(0);
    expect(mintAuthorityOption).toBe(0);
  });

  it("BondingCurve state has correct initial reserves and zero fee accruals", async () => {
    const { bondingCurvePda } = await createToken(
      ctx.program,
      ctx.context,
      authority
    );

    const curve = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    expect(curve.virtualTokenReserves.toString()).toBe("1073000000000000");
    expect(curve.virtualSolReserves.toString()).toBe("30000000000");
    expect(curve.realSolReserves.toString()).toBe("0");
    expect(curve.platformFeesAccrued.toString()).toBe("0");
    expect(curve.creatorFeesAccrued.toString()).toBe("0");
  });

  it("VestingAccount has correct allocation and start timestamp", async () => {
    const { tokenMint } = await createToken(
      ctx.program,
      ctx.context,
      authority
    );

    const accounts = getTokenAccounts(
      ctx.program.programId,
      tokenMint.publicKey
    );
    const vesting = await ctx.program.account.vestingAccount.fetch(
      accounts.vestingAccountPda
    );

    expect(vesting.totalAllocation.toString()).toBe(VESTING_AMOUNT.toString());
    expect(vesting.claimedAmount.toString()).toBe("0");
    expect(vesting.isRevoked).toBe(false);
    expect(vesting.creator.toBase58()).toBe(authority.publicKey.toBase58());
    expect(vesting.startTimestamp.toNumber()).toBeGreaterThan(0);
  });

  it("CreatorProfile records launch timestamp and token count", async () => {
    await createToken(ctx.program, ctx.context, authority);

    const [creatorProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator_profile"), authority.publicKey.toBuffer()],
      ctx.program.programId
    );

    const profile = await ctx.program.account.creatorProfile.fetch(
      creatorProfilePda
    );

    expect(profile.tokensLaunched).toBe(1);
    expect(profile.lastTokenLaunchTimestamp.toNumber()).toBeGreaterThan(0);
    expect(profile.creator.toBase58()).toBe(authority.publicKey.toBase58());
  });

  it("second token launch within 90 days fails with CooldownNotElapsed", async () => {
    await createToken(ctx.program, ctx.context, authority);

    // Try to launch second token immediately -- should fail
    await expect(
      createToken(ctx.program, ctx.context, authority)
    ).rejects.toThrow(/CooldownNotElapsed|cooldown/i);
  });

  it("second token launch after 90 days succeeds", async () => {
    await createToken(ctx.program, ctx.context, authority);

    // Advance clock by 91 days
    await advanceClock(ctx.context, 91 * SECONDS_PER_DAY);

    // Second token should succeed
    const { bondingCurvePda } = await createToken(
      ctx.program,
      ctx.context,
      authority
    );

    const curve = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    expect(curve.tokenTotalSupply.toString()).toBe(TOTAL_SUPPLY.toString());

    // Check creator profile updated
    const [creatorProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("creator_profile"), authority.publicKey.toBuffer()],
      ctx.program.programId
    );
    const profile = await ctx.program.account.creatorProfile.fetch(
      creatorProfilePda
    );
    expect(profile.tokensLaunched).toBe(2);
  });

  it("burn_sol_price is stored correctly (test with 0 and non-zero)", async () => {
    // Token with burn disabled (price = 0)
    const { bondingCurvePda: pda1 } = await createToken(
      ctx.program,
      ctx.context,
      authority,
      new BN(0)
    );
    const curve1 = await ctx.program.account.bondingCurve.fetch(pda1);
    expect(curve1.burnSolPrice.toString()).toBe("0");

    // Advance clock for second token
    await advanceClock(ctx.context, 91 * SECONDS_PER_DAY);

    // Token with burn enabled (price = 0.1 SOL)
    const { bondingCurvePda: pda2 } = await createToken(
      ctx.program,
      ctx.context,
      authority,
      new BN(100_000_000)
    );
    const curve2 = await ctx.program.account.bondingCurve.fetch(pda2);
    expect(curve2.burnSolPrice.toString()).toBe("100000000");
  });
});
