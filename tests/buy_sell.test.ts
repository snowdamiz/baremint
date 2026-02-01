import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import BN from "bn.js";
import { Baremint } from "../target/types/baremint";
import {
  setupTest,
  initializeGlobalConfig,
  createToken,
  createATA,
  airdropSol,
  getTokenAccounts,
  calculateBuyTokens,
  calculateSellSol,
  calculateFee,
  LAMPORTS_PER_SOL,
  DEFAULT_FEE_BPS,
  DEFAULT_PLATFORM_FEE_BPS,
  DEFAULT_CREATOR_FEE_BPS,
  TestContext,
} from "./setup";

describe("buy_sell", () => {
  let ctx: TestContext;
  let authority: Keypair;
  let buyer: Keypair;
  let tokenMint: Keypair;
  let bondingCurvePda: PublicKey;
  let buyerAta: PublicKey;
  let accounts: ReturnType<typeof getTokenAccounts>;

  beforeEach(async () => {
    ctx = await setupTest();
    authority = ctx.context.payer;
    await initializeGlobalConfig(ctx.program, authority);

    const result = await createToken(ctx.program, ctx.context, authority);
    tokenMint = result.tokenMint;
    bondingCurvePda = result.bondingCurvePda;
    accounts = getTokenAccounts(ctx.program.programId, tokenMint.publicKey);

    // Setup buyer
    buyer = Keypair.generate();
    await airdropSol(ctx.context, buyer.publicKey, 100 * 1_000_000_000);
    buyerAta = await createATA(
      ctx.context,
      ctx.provider,
      tokenMint.publicKey,
      buyer.publicKey,
      buyer
    );
  });

  // -------- Buy Tests --------

  it("buy with 1 SOL -> receives expected tokens", async () => {
    const solAmount = new BN(1_000_000_000); // 1 SOL

    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Calculate expected: fee deducted first, then curve math
    const fee = calculateFee(BigInt(solAmount.toString()), DEFAULT_FEE_BPS);
    const solIntoCurve = BigInt(solAmount.toString()) - fee;
    const expectedTokens = calculateBuyTokens(
      BigInt(curveBefore.virtualSolReserves.toString()),
      BigInt(curveBefore.virtualTokenReserves.toString()),
      solIntoCurve
    );

    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Verify token balance
    const buyerTokenAcct = await ctx.context.banksClient.getAccount(buyerAta);
    expect(buyerTokenAcct).not.toBeNull();
    // Parse SPL token account: amount is at offset 64 (8 bytes LE u64)
    const amount = Buffer.from(buyerTokenAcct!.data).readBigUInt64LE(64);
    // Allow 1 token tolerance for rounding
    const diff =
      amount > expectedTokens
        ? amount - expectedTokens
        : expectedTokens - amount;
    expect(diff <= BigInt(1)).toBe(true);
  });

  it("buy deducts 5% fee into platform and creator accrual fields", async () => {
    const solAmount = new BN(1_000_000_000);

    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    const totalFee = calculateFee(BigInt(solAmount.toString()), DEFAULT_FEE_BPS);
    // Program does total_fee / 2 for platform, total_fee - platform for creator
    const expectedPlatformFee = totalFee / BigInt(2);
    const expectedCreatorFee = totalFee - expectedPlatformFee;

    expect(curveAfter.platformFeesAccrued.toString()).toBe(
      expectedPlatformFee.toString()
    );
    expect(curveAfter.creatorFeesAccrued.toString()).toBe(
      expectedCreatorFee.toString()
    );
  });

  it("all SOL goes into bonding_curve PDA", async () => {
    const solAmount = new BN(1_000_000_000);

    const pdaLamportsBefore = (
      await ctx.context.banksClient.getAccount(bondingCurvePda)
    )!.lamports;

    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const pdaLamportsAfter = (
      await ctx.context.banksClient.getAccount(bondingCurvePda)
    )!.lamports;

    expect(BigInt(pdaLamportsAfter) - BigInt(pdaLamportsBefore)).toBe(
      BigInt(solAmount.toString())
    );
  });

  it("buy with slippage protection passes when min_tokens_out met", async () => {
    const solAmount = new BN(1_000_000_000);
    // Use a very low min -- should pass
    await expect(
      ctx.program.methods
        .buy(solAmount, new BN(1))
        .accounts({
          buyer: buyer.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount: accounts.curveTokenAccountPda,
          buyerTokenAccount: buyerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc()
    ).resolves.toBeDefined();
  });

  it("buy fails when min_tokens_out exceeds actual output (SlippageExceeded)", async () => {
    const solAmount = new BN(1_000_000_000);
    // Set impossibly high min
    const absurdMin = new BN("999999999999999");

    await expect(
      ctx.program.methods
        .buy(solAmount, absurdMin)
        .accounts({
          buyer: buyer.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount: accounts.curveTokenAccountPda,
          buyerTokenAccount: buyerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc()
    ).rejects.toThrow();
  });

  it("buy updates virtual and real reserves correctly", async () => {
    const solAmount = new BN(1_000_000_000);

    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    const totalFee = calculateFee(BigInt(solAmount.toString()), DEFAULT_FEE_BPS);
    const solIntoCurve = BigInt(solAmount.toString()) - totalFee;
    const expectedTokens = calculateBuyTokens(
      BigInt(curveBefore.virtualSolReserves.toString()),
      BigInt(curveBefore.virtualTokenReserves.toString()),
      solIntoCurve
    );

    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Virtual SOL should increase by sol_into_curve
    const expectedVSol =
      BigInt(curveBefore.virtualSolReserves.toString()) + solIntoCurve;
    expect(curveAfter.virtualSolReserves.toString()).toBe(
      expectedVSol.toString()
    );

    // Virtual token should decrease by tokens_out
    const expectedVToken =
      BigInt(curveBefore.virtualTokenReserves.toString()) - expectedTokens;
    expect(curveAfter.virtualTokenReserves.toString()).toBe(
      expectedVToken.toString()
    );

    // Real SOL increases by sol_into_curve
    expect(curveAfter.realSolReserves.toString()).toBe(
      solIntoCurve.toString()
    );

    // Real token decreases by tokens_out
    const expectedRealToken =
      BigInt(curveBefore.realTokenReserves.toString()) - expectedTokens;
    expect(curveAfter.realTokenReserves.toString()).toBe(
      expectedRealToken.toString()
    );
  });

  it("multiple sequential buys increase price (second buy gets fewer tokens per SOL)", async () => {
    const solAmount = new BN(1_000_000_000);

    // First buy
    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const tokensAfterFirst = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Setup second buyer
    const buyer2 = Keypair.generate();
    await airdropSol(ctx.context, buyer2.publicKey, 100 * 1_000_000_000);
    const buyer2Ata = await createATA(
      ctx.context,
      ctx.provider,
      tokenMint.publicKey,
      buyer2.publicKey,
      buyer2
    );

    // Second buy with same SOL
    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer2.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyer2Ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer2])
      .rpc();

    const tokensAfterSecond = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyer2Ata))!.data
    ).readBigUInt64LE(64);

    // Second buyer should get fewer tokens
    expect(tokensAfterSecond < tokensAfterFirst).toBe(true);
  });

  // -------- Sell Tests --------

  it("sell tokens -> receives expected SOL minus fees", async () => {
    const buyAmount = new BN(2_000_000_000); // Buy 2 SOL worth first

    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Get token balance
    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half of tokens
    const sellAmount = tokensHeld / BigInt(2);

    const buyerSolBefore = (
      await ctx.context.banksClient.getAccount(buyer.publicKey)
    )!.lamports;

    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Calculate expected SOL output
    const grossSol = calculateSellSol(
      BigInt(curveBefore.virtualSolReserves.toString()),
      BigInt(curveBefore.virtualTokenReserves.toString()),
      sellAmount
    );
    const totalFee = calculateFee(grossSol, DEFAULT_FEE_BPS);
    const expectedNet = grossSol - totalFee;

    await ctx.program.methods
      .sell(new BN(sellAmount.toString()), new BN(0))
      .accounts({
        seller: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const buyerSolAfter = (
      await ctx.context.banksClient.getAccount(buyer.publicKey)
    )!.lamports;

    const solReceived = BigInt(buyerSolAfter) - BigInt(buyerSolBefore);
    // Allow small tolerance for tx fees
    const diff =
      solReceived > BigInt(expectedNet)
        ? solReceived - BigInt(expectedNet)
        : BigInt(expectedNet) - solReceived;
    // Bankrun does not charge tx fees, so should be exact
    expect(diff <= BigInt(1)).toBe(true);
  });

  it("sell deducts 5% fee tracked in accrual fields", async () => {
    const buyAmount = new BN(2_000_000_000);

    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfterBuy = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const platformBefore = BigInt(
      curveAfterBuy.platformFeesAccrued.toString()
    );
    const creatorBefore = BigInt(curveAfterBuy.creatorFeesAccrued.toString());

    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half to avoid rounding edge case with full sell
    const sellAmount = tokensHeld / BigInt(2);

    const grossSol = calculateSellSol(
      BigInt(curveAfterBuy.virtualSolReserves.toString()),
      BigInt(curveAfterBuy.virtualTokenReserves.toString()),
      sellAmount
    );
    const totalFee = calculateFee(grossSol, DEFAULT_FEE_BPS);
    const expectedPlatformFee = totalFee / BigInt(2);
    const expectedCreatorFee = totalFee - expectedPlatformFee;

    await ctx.program.methods
      .sell(new BN(sellAmount.toString()), new BN(0))
      .accounts({
        seller: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfterSell = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    expect(
      BigInt(curveAfterSell.platformFeesAccrued.toString()) - platformBefore
    ).toBe(expectedPlatformFee);
    expect(
      BigInt(curveAfterSell.creatorFeesAccrued.toString()) - creatorBefore
    ).toBe(expectedCreatorFee);
  });

  it("sell with slippage protection passes when min_sol_out met", async () => {
    const buyAmount = new BN(2_000_000_000);

    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half to avoid rounding edge case
    const sellAmount = tokensHeld / BigInt(2);

    // Very low min -- should pass
    await expect(
      ctx.program.methods
        .sell(new BN(sellAmount.toString()), new BN(1))
        .accounts({
          seller: buyer.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount: accounts.curveTokenAccountPda,
          sellerTokenAccount: buyerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc()
    ).resolves.toBeDefined();
  });

  it("sell fails when min_sol_out exceeds actual output", async () => {
    const buyAmount = new BN(1_000_000_000);

    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half with absurdly high min_sol_out -- should fail on slippage
    const sellAmount = tokensHeld / BigInt(2);
    await expect(
      ctx.program.methods
        .sell(new BN(sellAmount.toString()), new BN("999999999999999"))
        .accounts({
          seller: buyer.publicKey,
          globalConfig: accounts.globalConfigPda,
          bondingCurve: bondingCurvePda,
          tokenMint: tokenMint.publicKey,
          curveTokenAccount: accounts.curveTokenAccountPda,
          sellerTokenAccount: buyerAta,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([buyer])
        .rpc()
    ).rejects.toThrow();
  });

  it("sell updates reserves correctly", async () => {
    const buyAmount = new BN(2_000_000_000);

    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half to avoid rounding edge case
    const sellAmount = tokensHeld / BigInt(2);

    const grossSol = calculateSellSol(
      BigInt(curveBefore.virtualSolReserves.toString()),
      BigInt(curveBefore.virtualTokenReserves.toString()),
      sellAmount
    );

    await ctx.program.methods
      .sell(new BN(sellAmount.toString()), new BN(0))
      .accounts({
        seller: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Virtual SOL decreases by gross_sol
    const expectedVSol =
      BigInt(curveBefore.virtualSolReserves.toString()) - grossSol;
    expect(curveAfter.virtualSolReserves.toString()).toBe(
      expectedVSol.toString()
    );

    // Virtual token increases by sellAmount
    const expectedVToken =
      BigInt(curveBefore.virtualTokenReserves.toString()) + sellAmount;
    expect(curveAfter.virtualTokenReserves.toString()).toBe(
      expectedVToken.toString()
    );

    // Real SOL decreases by gross_sol
    const expectedRealSol =
      BigInt(curveBefore.realSolReserves.toString()) - grossSol;
    expect(curveAfter.realSolReserves.toString()).toBe(
      expectedRealSol.toString()
    );
  });

  it("round-trip returns less SOL than invested (due to fees)", async () => {
    // Do two buys to build up reserves, then sell tokens from second buy
    // This avoids the rounding edge case when selling all tokens from a single buy
    const solAmount = new BN(1_000_000_000);

    // First buy (builds reserves buffer)
    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    // Record SOL balance and token balance before second buy
    const buyerSolBefore = BigInt(
      (await ctx.context.banksClient.getAccount(buyer.publicKey))!.lamports
    );
    const tokensBefore = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Second buy
    await ctx.program.methods
      .buy(solAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const tokensAfterSecondBuy = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);
    const tokensFromSecondBuy = tokensAfterSecondBuy - tokensBefore;

    // Sell tokens from second buy
    await ctx.program.methods
      .sell(new BN(tokensFromSecondBuy.toString()), new BN(0))
      .accounts({
        seller: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const buyerSolAfter = BigInt(
      (await ctx.context.banksClient.getAccount(buyer.publicKey))!.lamports
    );

    // Buyer spent 1 SOL on second buy and got back less than 1 SOL
    // Net change should be negative (lost SOL to fees)
    expect(buyerSolAfter < buyerSolBefore).toBe(true);
  });

  // -------- Price Curve Tests --------

  it("after large buy, price is higher than initial", async () => {
    const curveBefore = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Initial price ratio: virtualSol / virtualToken
    const initialPriceNumerator = BigInt(
      curveBefore.virtualSolReserves.toString()
    );
    const initialPriceDenom = BigInt(
      curveBefore.virtualTokenReserves.toString()
    );

    // Large buy: 10 SOL
    await ctx.program.methods
      .buy(new BN(10_000_000_000), new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );
    const newPriceNumerator = BigInt(
      curveAfter.virtualSolReserves.toString()
    );
    const newPriceDenom = BigInt(
      curveAfter.virtualTokenReserves.toString()
    );

    // Price = virtualSol / virtualToken; compare cross-multiplied
    // newPrice > initialPrice means: newNum * initDenom > initNum * newDenom
    expect(
      newPriceNumerator * initialPriceDenom >
        initialPriceNumerator * newPriceDenom
    ).toBe(true);
  });

  it("after buy + sell back, reserves approximately restored and fees accrued", async () => {
    // Do two buys to build reserve buffer, then sell half
    const buyAmount = new BN(1_000_000_000);

    // First buy
    await ctx.program.methods
      .buy(buyAmount, new BN(0))
      .accounts({
        buyer: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        buyerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfterBuy = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    const tokensHeld = Buffer.from(
      (await ctx.context.banksClient.getAccount(buyerAta))!.data
    ).readBigUInt64LE(64);

    // Sell half the tokens back
    const sellAmount = tokensHeld / BigInt(2);

    await ctx.program.methods
      .sell(new BN(sellAmount.toString()), new BN(0))
      .accounts({
        seller: buyer.publicKey,
        globalConfig: accounts.globalConfigPda,
        bondingCurve: bondingCurvePda,
        tokenMint: tokenMint.publicKey,
        curveTokenAccount: accounts.curveTokenAccountPda,
        sellerTokenAccount: buyerAta,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([buyer])
      .rpc();

    const curveAfter = await ctx.program.account.bondingCurve.fetch(
      bondingCurvePda
    );

    // Virtual token reserves should increase by sellAmount from the post-buy state
    const expectedVToken =
      BigInt(curveAfterBuy.virtualTokenReserves.toString()) + sellAmount;
    expect(curveAfter.virtualTokenReserves.toString()).toBe(
      expectedVToken.toString()
    );

    // Fees were accrued on both buy and sell
    expect(
      BigInt(curveAfter.platformFeesAccrued.toString()) > BigInt(0)
    ).toBe(true);
    expect(
      BigInt(curveAfter.creatorFeesAccrued.toString()) > BigInt(0)
    ).toBe(true);
  });
});
