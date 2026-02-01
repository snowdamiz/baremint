# Devnet Deployment

Deploy the Baremint Anchor program to Solana devnet.

## Prerequisites

- Solana CLI installed (already at `~/.local/share/solana/install/active_release/bin/`)
- Anchor CLI installed
- Program built (`target/deploy/baremint.so` exists)

## Steps

### 1. Add Solana CLI to PATH

Add to `~/.zshrc` (or `~/.bashrc`):

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

Reload:

```bash
source ~/.zshrc
```

### 2. Fund deployer wallet

Deployer address: `E3XhgJtFRTTtN7jEGjaN8Sj2jV3zZBMU2Knci1dfwMqG` (from `~/.config/solana/id.json`)

Program deployment requires ~5 SOL. The devnet faucet is rate-limited to 2 SOL per request:

```bash
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
solana airdrop 2 --url devnet
```

If rate-limited, wait a few minutes between requests or use the web faucet at https://faucet.solana.com.

Verify balance:

```bash
solana balance --url devnet
```

### 3. Update Anchor.toml for devnet

Add a devnet program entry and switch the provider cluster:

```toml
[programs.devnet]
baremint = "FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG"

[provider]
cluster = "devnet"
```

### 4. Deploy

```bash
anchor deploy --provider.cluster devnet
```

This uploads `target/deploy/baremint.so` using the keypair at `target/deploy/baremint-keypair.json` (determines program ID `FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG`).

### 5. Verify deployment

```bash
solana program show FTAssMPiQ8EQUeJA4Rnu6c71maCrUCdnvGetWnVdTXTG --url devnet
```

Should show the program as deployed with your deployer as the upgrade authority.

### 6. Revert Anchor.toml

Set `cluster = "localnet"` back so local tests continue working.

## Redeployment

After code changes:

```bash
anchor build
anchor deploy --provider.cluster devnet
```

The program ID stays the same as long as `target/deploy/baremint-keypair.json` is unchanged.
