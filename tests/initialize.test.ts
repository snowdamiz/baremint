import { Program } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import { Baremint } from "../target/types/baremint";
import {
  setupTest,
  initializeGlobalConfig,
  DEFAULT_FEE_BPS,
  DEFAULT_PLATFORM_FEE_BPS,
  DEFAULT_CREATOR_FEE_BPS,
  DEFAULT_VIRTUAL_TOKEN_RESERVES,
  DEFAULT_VIRTUAL_SOL_RESERVES,
  TestContext,
} from "./setup";

describe("initialize", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTest();
  });

  it("initializes GlobalConfig with valid params", async () => {
    const authority = ctx.context.payer;
    const globalConfigPda = await initializeGlobalConfig(
      ctx.program,
      authority
    );

    const config = await ctx.program.account.globalConfig.fetch(
      globalConfigPda
    );

    expect(config.authority.toBase58()).toBe(authority.publicKey.toBase58());
    expect(config.feeBps).toBe(DEFAULT_FEE_BPS);
    expect(config.platformFeeBps).toBe(DEFAULT_PLATFORM_FEE_BPS);
    expect(config.creatorFeeBps).toBe(DEFAULT_CREATOR_FEE_BPS);
    expect(config.initialVirtualTokenReserves.toString()).toBe(
      DEFAULT_VIRTUAL_TOKEN_RESERVES.toString()
    );
    expect(config.initialVirtualSolReserves.toString()).toBe(
      DEFAULT_VIRTUAL_SOL_RESERVES.toString()
    );
    expect(config.vestingCliffSeconds.toNumber()).toBe(2_592_000);
    expect(config.vestingDurationSeconds.toNumber()).toBe(5_184_000);
    expect(config.vestingClaimIntervalSeconds.toNumber()).toBe(604_800);
    expect(config.launchCooldownSeconds.toNumber()).toBe(7_776_000);
    expect(config.creatorAllocationBps).toBe(1000);
  });

  it("rejects invalid fee config (platform + creator != total)", async () => {
    const authority = ctx.context.payer;
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      ctx.program.programId
    );

    await expect(
      ctx.program.methods
        .initialize(
          500, // fee_bps
          300, // platform_fee_bps -- doesn't sum to 500
          100, // creator_fee_bps
          DEFAULT_VIRTUAL_TOKEN_RESERVES,
          DEFAULT_VIRTUAL_SOL_RESERVES
        )
        .accounts({
          authority: authority.publicKey,
          globalConfig: globalConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow();
  });

  it("rejects fee_bps > 1000", async () => {
    const authority = ctx.context.payer;
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      ctx.program.programId
    );

    await expect(
      ctx.program.methods
        .initialize(
          1500, // fee_bps > 1000
          750,
          750,
          DEFAULT_VIRTUAL_TOKEN_RESERVES,
          DEFAULT_VIRTUAL_SOL_RESERVES
        )
        .accounts({
          authority: authority.publicKey,
          globalConfig: globalConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow();
  });

  it("rejects zero virtual reserves", async () => {
    const authority = ctx.context.payer;
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      ctx.program.programId
    );

    // Zero token reserves
    await expect(
      ctx.program.methods
        .initialize(500, 250, 250, new BN(0), DEFAULT_VIRTUAL_SOL_RESERVES)
        .accounts({
          authority: authority.publicKey,
          globalConfig: globalConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow();

    // Zero SOL reserves
    await expect(
      ctx.program.methods
        .initialize(500, 250, 250, DEFAULT_VIRTUAL_TOKEN_RESERVES, new BN(0))
        .accounts({
          authority: authority.publicKey,
          globalConfig: globalConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow();
  });

  it("rejects re-initialization (PDA already exists)", async () => {
    const authority = ctx.context.payer;
    await initializeGlobalConfig(ctx.program, authority);

    // Second initialization should fail
    const [globalConfigPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_config")],
      ctx.program.programId
    );

    await expect(
      ctx.program.methods
        .initialize(
          DEFAULT_FEE_BPS,
          DEFAULT_PLATFORM_FEE_BPS,
          DEFAULT_CREATOR_FEE_BPS,
          DEFAULT_VIRTUAL_TOKEN_RESERVES,
          DEFAULT_VIRTUAL_SOL_RESERVES
        )
        .accounts({
          authority: authority.publicKey,
          globalConfig: globalConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([authority])
        .rpc()
    ).rejects.toThrow();
  });
});
