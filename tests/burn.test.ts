import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import BN from "bn.js";
import { Baremint } from "../target/types/baremint";
import {
  setupTest,
  initializeGlobalConfig,
  createToken,
  createATA,
  airdropSol,
  getTokenAccounts,
  calculateFee,
  calculateTokensForSolValue,
  DEFAULT_FEE_BPS,
  TOTAL_SUPPLY,
  TestContext,
} from "./setup";

describe("burn_for_access", () => {
  let ctx: TestContext;
  let authority: Keypair;
  let viewer: Keypair;
  let tokenMint: Keypair;
  let bondingCurvePda: PublicKey;
  let viewerAta: PublicKey;
  let accounts: ReturnType<typeof getTokenAccounts>;

  const BURN_SOL_PRICE = new BN(100_000_000); // 0.1 SOL

  beforeEach(async () => {
    ctx = await setupTest();
    authority = ctx.context.payer;
    await initializeGlobalConfig(ctx.program, authority);

    const result = await createToken(
      ctx.program,
      ctx.context,
      authority,
      BURN_SOL_PRICE
    );
    tokenMint = result.tokenMint;
    bondingCurvePda = result.bondingCurvePda;
    accounts = getTokenAccounts(ctx.program.programId, tokenMint.publicKey);

    // Setup viewer: airdrop SOL, create ATA, buy tokens
    viewer = Keypair.generate();
    await airdropSol(ctx.context, viewer.publicKey, 10 * 1_000_000_000);
    viewerAta = await createATA(
      ctx.context,
      ctx.provider,
      tokenMint.publicKey,
      viewer.publicKey,
      viewer
    );

    // Viewer buys tokens (2 SOL worth)
    await ctx.program.methods
      .buy(new BN(2_000_000_000), new BN(0))
      .accounts({
        buyer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([viewer])
      .rpc();
  });

  it("burn_for_access destroys correct number of tokens based on SOL price", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const viewerTokensBefore = Buffer.from(
      (await ctx.context.banksClient.getAccount(viewerAta))!.data
    ).readBigUInt64LE(64);

    // Calculate expected tokens to burn
    const expectedBurnTokens = calculateTokensForSolValue(
      BigInt(curveBefore.virtualSolReserves.toString()),
      BigInt(curveBefore.virtualTokenReserves.toString()),
      BigInt(BURN_SOL_PRICE.toString())
    );

    await ctx.program.methods
      .burnForAccess()
      .accounts({
        viewer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        viewerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer])
      .rpc();

    const viewerTokensAfter = Buffer.from(
      (await ctx.context.banksClient.getAccount(viewerAta))!.data
    ).readBigUInt64LE(64);

    const tokensBurned = viewerTokensBefore - viewerTokensAfter;
    const diff =
      tokensBurned > expectedBurnTokens
        ? tokensBurned - expectedBurnTokens
        : expectedBurnTokens - tokensBurned;
    expect(diff <= BigInt(1)).toBe(true);
  });

  it("burn_for_access is deflationary -- no SOL returned to viewer", async () => {
    const viewerSolBefore = BigInt(
      (await ctx.context.banksClient.getAccount(viewer.publicKey))!.lamports
    );

    await ctx.program.methods
      .burnForAccess()
      .accounts({
        viewer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        viewerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer])
      .rpc();

    const viewerSolAfter = BigInt(
      (await ctx.context.banksClient.getAccount(viewer.publicKey))!.lamports
    );

    // Viewer should NOT have gained any SOL (deflationary burn)
    expect(viewerSolAfter <= viewerSolBefore).toBe(true);
  });

  it("burn_for_access extracts fee from curve reserves into accrual fields", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const platformBefore = BigInt(
      curveBefore.platformFeesAccrued.toString()
    );
    const creatorBefore = BigInt(curveBefore.creatorFeesAccrued.toString());

    const burnSolPrice = BigInt(BURN_SOL_PRICE.toString());
    const totalFee = calculateFee(burnSolPrice, DEFAULT_FEE_BPS);
    const expectedPlatformFee = totalFee / BigInt(2);
    const expectedCreatorFee = totalFee - expectedPlatformFee;

    await ctx.program.methods
      .burnForAccess()
      .accounts({
        viewer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        viewerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    expect(
      BigInt(curveAfter.platformFeesAccrued.toString()) - platformBefore
    ).toBe(expectedPlatformFee);
    expect(
      BigInt(curveAfter.creatorFeesAccrued.toString()) - creatorBefore
    ).toBe(expectedCreatorFee);
  });

  it("burn_for_access fails when burn_sol_price is 0 (BurnDisabled)", async () => {
    // Create a token with burn disabled
    // Need a new creator (or advance clock for cooldown)
    const creator2 = Keypair.generate();
    await airdropSol(ctx.context, creator2.publicKey, 10 * 1_000_000_000);

    const result2 = await createToken(
      ctx.program,
      ctx.context,
      creator2,
      new BN(0) // burn disabled
    );
    const accounts2 = getTokenAccounts(
      ctx.program.programId,
      result2.tokenMint.publicKey
    );

    // Fund viewer with this token
    const viewerAta2 = await createATA(
      ctx.context,
      ctx.provider,
      result2.tokenMint.publicKey,
      viewer.publicKey,
      viewer
    );
    await ctx.program.methods
      .buy(new BN(1_000_000_000), new BN(0))
      .accounts({
        buyer: viewer.publicKey,
        globalConfig: accounts2.globalConfigPda,
        bondingCurve: result2.bondingCurvePda,
        tokenMint: result2.tokenMint.publicKey,
        curveTokenAccount: accounts2.curveTokenAccountPda,
        buyerTokenAccount: viewerAta2,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([viewer])
      .rpc();

    // Try to burn -- should fail
    await expect(
      ctx.program.methods
        .burnForAccess()
        .accounts({
          viewer: viewer.publicKey,
          globalConfig: accounts2.globalConfigPda,
          bondingCurve: result2.bondingCurvePda,
          tokenMint: result2.tokenMint.publicKey,
          viewerTokenAccount: viewerAta2,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer])
        .rpc()
    ).rejects.toThrow(/BurnDisabled/i);
  });

  it("burn_for_access fails when viewer has insufficient tokens", async () => {
    // Create a viewer with very few tokens
    const viewer2 = Keypair.generate();
    await airdropSol(ctx.context, viewer2.publicKey, 10 * 1_000_000_000);
    const viewer2Ata = await createATA(
      ctx.context,
      ctx.provider,
      tokenMint.publicKey,
      viewer2.publicKey,
      viewer2
    );

    // Buy minimal tokens (very small amount)
    await ctx.program.methods
      .buy(new BN(1000), new BN(0)) // Extremely small buy
      .accounts({
        buyer: viewer2.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: viewer2Ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([viewer2])
      .rpc();

    // Try to burn -- should fail (not enough tokens for 0.1 SOL worth)
    await expect(
      ctx.program.methods
        .burnForAccess()
        .accounts({
          viewer: viewer2.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          viewerTokenAccount: viewer2Ata,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([viewer2])
        .rpc()
    ).rejects.toThrow(/InsufficientTokens/i);
  });

  it("after burn, token total supply decreases (deflationary)", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const supplyBefore = BigInt(curveBefore.tokenTotalSupply.toString());

    await ctx.program.methods
      .burnForAccess()
      .accounts({
        viewer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        viewerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const supplyAfter = BigInt(curveAfter.tokenTotalSupply.toString());

    expect(supplyAfter < supplyBefore).toBe(true);
  });

  it("fees from burn are correctly split between platform and creator", async () => {
    const burnSolPrice = BigInt(BURN_SOL_PRICE.toString());
    const totalFee = calculateFee(burnSolPrice, DEFAULT_FEE_BPS);
    const expectedPlatformFee = totalFee / BigInt(2);
    const expectedCreatorFee = totalFee - expectedPlatformFee;

    // Verify the split is 50/50 of total fee
    expect(expectedPlatformFee + expectedCreatorFee).toBe(totalFee);
    expect(expectedPlatformFee > BigInt(0)).toBe(true);
    expect(expectedCreatorFee > BigInt(0)).toBe(true);

    // Execute burn and verify on-chain
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    await ctx.program.methods
      .burnForAccess()
      .accounts({
        viewer: viewer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        viewerTokenAccount: viewerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([viewer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    const platformIncrease =
      BigInt(curveAfter.platformFeesAccrued.toString()) -
      BigInt(curveBefore.platformFeesAccrued.toString());
    const creatorIncrease =
      BigInt(curveAfter.creatorFeesAccrued.toString()) -
      BigInt(curveBefore.creatorFeesAccrued.toString());

    expect(platformIncrease).toBe(expectedPlatformFee);
    expect(creatorIncrease).toBe(expectedCreatorFee);
  });
});
