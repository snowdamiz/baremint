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
  DEFAULT_FEE_BPS,
  TestContext,
} from "./setup";

describe("fees", () => {
  let ctx: TestContext;
  let authority: Keypair;
  let trader: Keypair;
  let tokenMint: Keypair;
  let bondingCurvePda: PublicKey;
  let traderAta: PublicKey;
  let accounts: ReturnType<typeof getTokenAccounts>;

  beforeEach(async () => {
    ctx = await setupTest();
    authority = ctx.context.payer;
    await initializeGlobalConfig(ctx.program, authority);

    const result = await createToken(ctx.program, ctx.context, authority);
    tokenMint = result.tokenMint;
    bondingCurvePda = result.bondingCurvePda;
    accounts = getTokenAccounts(ctx.program.programId, tokenMint.publicKey);

    // Setup trader
    trader = Keypair.generate();
    await airdropSol(ctx.context, trader.publicKey, 50 * 1_000_000_000);
    traderAta = await createATA(
      ctx.context,
      ctx.provider,
      tokenMint.publicKey,
      trader.publicKey,
      trader
    );

    // Execute some trades to accumulate fees
    // Buy 3 SOL worth
    await ctx.program.methods
      .buy(new BN(3_000_000_000), new BN(0))
      .accounts({
        buyer: trader.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: traderAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    // Sell half
    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(traderAta))!.data
    ).readBigUInt64LE(64);
    const sellAmount = tokensHeld / BigInt(2);

    await ctx.program.methods
      .sell(new BN(sellAmount.toString()), new BN(0))
      .accounts({
        seller: trader.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: traderAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();
  });

  it("withdraw_platform_fees sends correct SOL to authority", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const platformFees = BigInt(curveBefore.platformFeesAccrued.toString());
    expect(platformFees > BigInt(0)).toBe(true);

    const authSolBefore = BigInt(
      (await ctx.context.banksClient.getAccount(authority.publicKey))!.lamports
    );

    await ctx.program.methods
      .withdrawPlatformFees()
      .accounts({
        authority: authority.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
      })
      .signers([authority])
      .rpc();

    const authSolAfter = BigInt(
      (await ctx.context.banksClient.getAccount(authority.publicKey))!.lamports
    );

    // Account for transaction fee (5000 lamports in bankrun)
    const solIncrease = authSolAfter - authSolBefore;
    const txFee = platformFees - solIncrease;
    expect(txFee).toBe(BigInt(5000));
  });

  it("withdraw_platform_fees resets platform_fees_accrued to 0", async () => {
    await ctx.program.methods
      .withdrawPlatformFees()
      .accounts({
        authority: authority.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
      })
      .signers([authority])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    expect(curveAfter.platformFeesAccrued.toString()).toBe("0");
  });

  it("withdraw_platform_fees fails for non-authority (Unauthorized)", async () => {
    const nonAuth = Keypair.generate();
    await airdropSol(ctx.context, nonAuth.publicKey, 1_000_000_000);

    await expect(
      ctx.program.methods
        .withdrawPlatformFees()
        .accounts({
          authority: nonAuth.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
        })
        .signers([nonAuth])
        .rpc()
    ).rejects.toThrow(/Unauthorized|unauthorized|constraint/i);
  });

  it("withdraw_creator_fees sends correct SOL to creator", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const creatorFees = BigInt(curveBefore.creatorFeesAccrued.toString());
    expect(creatorFees > BigInt(0)).toBe(true);

    // Creator is the authority (same person in these tests)
    const creatorSolBefore = BigInt(
      (await ctx.context.banksClient.getAccount(authority.publicKey))!.lamports
    );

    await ctx.program.methods
      .withdrawCreatorFees()
      .accounts({
        creator: authority.publicKey,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
      })
      .signers([authority])
      .rpc();

    const creatorSolAfter = BigInt(
      (await ctx.context.banksClient.getAccount(authority.publicKey))!.lamports
    );

    // Account for transaction fee (5000 lamports in bankrun)
    const solIncrease = creatorSolAfter - creatorSolBefore;
    const txFee = creatorFees - solIncrease;
    expect(txFee).toBe(BigInt(5000));
  });

  it("withdraw_creator_fees fails for non-creator (Unauthorized)", async () => {
    const nonCreator = Keypair.generate();
    await airdropSol(ctx.context, nonCreator.publicKey, 1_000_000_000);

    await expect(
      ctx.program.methods
        .withdrawCreatorFees()
        .accounts({
          creator: nonCreator.publicKey,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
        })
        .signers([nonCreator])
        .rpc()
    ).rejects.toThrow(/Unauthorized|unauthorized|constraint/i);
  });

  it("fees accumulate correctly across multiple trades", async () => {
    const curveMid = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const platformMid = BigInt(curveMid.platformFeesAccrued.toString());
    const creatorMid = BigInt(curveMid.creatorFeesAccrued.toString());

    // Do another buy
    const buyAmount = new BN(1_000_000_000);
    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: trader.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: traderAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([trader])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const platformAfter = BigInt(curveAfter.platformFeesAccrued.toString());
    const creatorAfter = BigInt(curveAfter.creatorFeesAccrued.toString());

    // Fees should have increased
    expect(platformAfter > platformMid).toBe(true);
    expect(creatorAfter > creatorMid).toBe(true);

    // Check the increase matches expected fee from the buy
    const buyFee = calculateFee(BigInt(buyAmount.toString()), DEFAULT_FEE_BPS);
    const expectedPlatformIncrease = buyFee / BigInt(2);
    const expectedCreatorIncrease = buyFee - expectedPlatformIncrease;

    expect(platformAfter - platformMid).toBe(expectedPlatformIncrease);
    expect(creatorAfter - creatorMid).toBe(expectedCreatorIncrease);
  });

  it("bonding_curve retains rent-exempt lamports after fee withdrawal", async () => {
    // Withdraw all platform fees
    await ctx.program.methods
      .withdrawPlatformFees()
      .accounts({
        authority: authority.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
      })
      .signers([authority])
      .rpc();

    // Withdraw all creator fees
    await ctx.program.methods
      .withdrawCreatorFees()
      .accounts({
        creator: authority.publicKey,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
      })
      .signers([authority])
      .rpc();

    // Verify PDA still has lamports (rent exempt + real reserves)
    const pdaAccount = await ctx.context.banksClient.getAccount(
      bondingCurvePda
    );
    expect(pdaAccount).not.toBeNull();
    expect(BigInt(pdaAccount!.lamports) > BigInt(0)).toBe(true);

    // Should have at least rent-exempt minimum
    const rent = await ctx.context.banksClient.getRent();
    const minLamports = rent.minimumBalance(BigInt(pdaAccount!.data.length));
    expect(BigInt(pdaAccount!.lamports) >= minLamports).toBe(true);
  });
});
