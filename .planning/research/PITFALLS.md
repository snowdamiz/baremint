# Domain Pitfalls

**Domain:** Crypto-native creator platform (Solana, bonding curves, custodial wallets, token-gated content)
**Researched:** 2026-01-31
**Overall confidence:** HIGH (multiple verified sources, real-world exploit post-mortems)

---

## Critical Pitfalls

Mistakes that cause total platform compromise, legal liability, or irreversible financial loss.

---

### Pitfall 1: Custodial Key Storage as a Honeypot

**What goes wrong:** AES-256 encrypted private keys stored in the same database (or on the same server) as the encryption keys. A single server compromise yields both ciphertext and decryption key, rendering encryption meaningless. This is the #1 cause of custodial wallet breaches.

**Why it happens:** Teams treat AES-256 as "good enough" without considering the key management problem. The encryption algorithm is strong; the key storage is the weak link. Developers store encryption keys in environment variables, config files, or adjacent database tables -- all accessible after a single server breach.

**Consequences:** Total loss of all user funds. Bybit, KuCoin, Upbit ($36M Solana breach in Nov 2025), and Atomic Wallet ($35M in 2023) all suffered custodial key compromises. Irreversible on-chain -- no chargebacks, no recovery.

**Prevention:**
- Use a Hardware Security Module (HSM) or cloud KMS (AWS KMS, GCP Cloud HSM) for encryption key storage. Keys never leave the HSM boundary unencrypted.
- Implement envelope encryption: data encryption keys (DEKs) encrypt wallet keys, and a master key in KMS encrypts the DEKs. Compromise of the database alone yields nothing.
- Automated key rotation on defined schedules.
- Memory-safe key handling: zero keys from memory after use, never log key material, never include in error reports.
- Consider MPC (Multi-Party Computation) wallets where the full private key never exists in one place.

**Detection (warning signs):**
- Encryption key in `.env` file or config on the same server as the database
- No HSM/KMS in the architecture
- Keys loaded into application memory and kept resident
- No key rotation policy
- Database backups contain both encrypted data and encryption keys

**Phase mapping:** Must be addressed in Phase 1 (foundation). Retrofitting key management after launch means migrating every wallet -- catastrophic complexity. Get this right from day zero.

**Confidence:** HIGH -- based on multiple real-world breach post-mortems.

---

### Pitfall 2: Bonding Curve Smart Contract Vulnerabilities

**What goes wrong:** Solana programs ship with missing signer checks, missing owner checks, or integer overflow bugs. Between 2021-2025, Solana protocols lost $450M+ to exploits, and 85.5% of critical findings are business logic, permissions, and validation errors -- not exotic attacks.

**Why it happens:** Solana's account model is fundamentally different from EVM. Programs are stateless; accounts are passed in by users. Nothing can be trusted by default. Developers from Ethereum backgrounds miss this. Even with Anchor, subtle vulnerabilities persist (stale data after CPI, PDA bump misuse, arbitrary CPI targets).

**Consequences:** Attacker drains bonding curve reserves, mints unlimited tokens, or manipulates price curves. Complete loss of liquidity pool funds.

**Prevention:**
- Use Anchor framework with all safety features enabled (`overflow-checks = true` in Cargo.toml)
- Mandatory checks for every instruction: signer check (`Signer<'info>`), owner check (`Account<'info, T>`), account data matching (`has_one`, `constraint`)
- Validate CPI targets using Anchor's `Program` account type -- never accept arbitrary program IDs
- Use `checked_*` math operations everywhere; never use raw arithmetic on token amounts
- Store and validate canonical PDA bumps
- Call `reload()` on accounts after CPIs to avoid stale data
- Professional audit by a Solana-specialized firm (not just EVM auditors) before mainnet
- Formal verification for the bonding curve math specifically
- Bug bounty program post-launch

**Detection (warning signs):**
- Raw Rust program without Anchor (unless team has deep Solana security expertise)
- No `overflow-checks = true` in Cargo.toml
- Instructions that don't validate every account passed in
- No audit planned before mainnet deployment
- Bonding curve math using floating point instead of fixed-point/integer arithmetic

**Phase mapping:** Smart contract development phase. The program must be written with security as the primary constraint, not bolted on later. Audit should gate mainnet deployment -- never deploy unaudited contracts that hold funds.

**Confidence:** HIGH -- Solana Foundation security course, Helius security guide, Sec3 2025 ecosystem review all confirm these patterns.

---

### Pitfall 3: MEV Sandwich Attacks on Bonding Curve Trades

**What goes wrong:** Users buying/selling creator tokens via the bonding curve get sandwich attacked. An attacker front-runs the buy (pushing price up), the user's trade executes at inflated price, then the attacker back-runs (selling at profit). $370-500M extracted on Solana over 16 months. At least 100 victims per hour.

**Why it happens:** Bonding curves with deterministic pricing and on-chain liquidity are trivially sandwichable. Memecoin/creator-token traders set high slippage because of volatility, making them easy targets. Solana validators with slot leader advantage can see and reorder transactions before finalization. Wide (multi-slot) sandwiches now account for 93% of all attacks, evading single-slot detection.

**Consequences:** Users lose value on every trade. Trust erodes quickly when users realize they're consistently getting worse prices than expected. Creator tokens become associated with extraction rather than community value.

**Prevention:**
- Implement slippage protection with sensible defaults (not user-overridable to extreme values without warning)
- Consider a time-weighted or batch auction mechanism for large trades instead of instant AMM execution
- Implement a linearly decaying "sniper tax" during initial price discovery (as Heaven platform does -- 6-second decay period)
- Use MEV-protection transaction submission (Jito bundles, bloXroute leader-aware routing) as the default RPC path
- Consider whether the bonding curve should have a maximum single-trade size to limit sandwich profitability
- Display estimated price impact prominently before trade confirmation

**Detection (warning signs):**
- Users complaining about worse-than-expected execution prices
- Large trades consistently preceded and followed by same-wallet transactions in on-chain history
- High slippage tolerance set as default in the UI

**Phase mapping:** Bonding curve design phase. MEV resistance must be a design constraint for the curve and trading UX, not a post-launch patch.

**Confidence:** HIGH -- Helius MEV report, bloXroute analysis, Ghost year-long Solana trade study.

---

### Pitfall 4: CSAM and Illegal Content on Creator Platform

**What goes wrong:** A platform that allows creators to upload and sell content behind token gates will inevitably attract bad actors attempting to distribute CSAM or other illegal material. Section 230 explicitly does NOT protect platforms from federal CSAM liability. Strict liability applies for mere possession.

**Why it happens:** Creator platforms with financial incentives (token-gated paid content) attract commercial CSAM distribution. Crypto payments between 2022-2024 to CSAM addresses increased 130%. At least one crypto CSAM transaction occurs every two minutes. Platforms that allow pseudonymous creators with encrypted/gated content create ideal conditions for abuse.

**Consequences:** Criminal liability for the platform operators (not just civil). Platform seizure by law enforcement. Complete destruction of the business. This is an existential risk, not a feature trade-off.

**Prevention:**
- Implement automated CSAM scanning (PhotoDNA or similar perceptual hashing) on ALL uploaded content BEFORE it becomes accessible, even behind token gates
- Report to NCMEC as legally required (18 U.S.C. 2258A mandatory reporting for electronic service providers)
- KYC requirement for creators (not just consumers) -- verify identity before allowing content uploads
- Human review pipeline for flagged content with trained moderators
- Content type restrictions in early phases (e.g., no video initially, or only approved content categories)
- Retain content hashes for law enforcement cooperation
- Legal counsel specializing in platform liability before launch
- Consider age verification for content consumers accessing mature content categories

**Detection (warning signs):**
- No content scanning pipeline in architecture
- Allowing content uploads without identity verification
- No NCMEC reporting integration
- "We'll add moderation later" in the roadmap
- Encrypted content that the platform itself cannot inspect

**Phase mapping:** Must be in Phase 1 alongside content upload functionality. Content moderation is not a feature -- it is a legal requirement. Never launch content uploads without scanning in place.

**Confidence:** HIGH -- Federal law (18 U.S.C. 2258A), DOJ Section 230 review, Chainalysis CSAM reports.

---

### Pitfall 5: KYC Data as a Liability Magnet

**What goes wrong:** Platform collects government IDs, selfies, addresses for KYC compliance, then stores this PII in a way that becomes a high-value breach target. In 2024, 8.6 million KYC records were compromised across two major exchanges. 42% of exchanges cite securing KYC data as a "major issue."

**Why it happens:** KYC is required for anti-rug compliance and legal reasons, but teams treat it as a checkbox rather than a security domain. PII stored in the same database as user accounts. No data minimization. Indefinite retention. The collected data (government IDs + wallet addresses) is uniquely dangerous because it links real identities to on-chain financial activity.

**Consequences:** Breach exposes government IDs linked to crypto wallets -- enabling targeted phishing, SIM-swap attacks (as happened to friend.tech users), and physical threats against high-value holders. GDPR fines up to 4% of global revenue or 20M EUR. Regulatory enforcement -- 86% of enforcement actions from 2019-2024 were triggered by KYC non-compliance.

**Prevention:**
- Use a third-party KYC provider (Jumio, Sumsub, Onfido) rather than storing raw PII yourself. Let them handle the liability of document storage.
- If you must store PII: separate database, separate encryption keys, separate access controls from the main application database
- Data minimization: store only KYC pass/fail status and provider reference ID, not the actual documents
- Implement GDPR right-to-erasure workflows from day one (delete KYC data when no longer legally required)
- Retention policy: define and enforce maximum retention periods per jurisdiction
- Access logging: every PII access logged and auditable
- Never store KYC data and wallet private keys in the same database or accessible from the same application service

**Detection (warning signs):**
- Raw government ID images stored in your database
- KYC data in the same database as user accounts and wallet keys
- No data retention policy
- No third-party KYC provider evaluation
- GDPR/CCPA compliance not in the roadmap

**Phase mapping:** KYC integration phase. Architecture the data separation before integrating any KYC provider. The data model for PII isolation must be designed before any PII is collected.

**Confidence:** HIGH -- EDPB 2025 guidelines, MiCA requirements, multiple exchange breach reports.

---

## Moderate Pitfalls

Mistakes that cause significant user harm, legal exposure, or require expensive rework.

---

### Pitfall 6: Token-Gated Content Access Control Bypass

**What goes wrong:** Users who sell their creator tokens retain access to gated content. Or: verification happens only at login, not at content access time. Or: API endpoints serving gated content don't verify token ownership, only authentication.

**Why it happens:** Token ownership is dynamic (users trade tokens constantly) but content access checks are often static (checked once at session start). Server-side access control may verify "is user authenticated?" but not "does user currently hold the required token balance?" at the moment of content delivery.

**Prevention:**
- Verify token balance at content access time, not just at login/session creation
- Implement real-time or near-real-time on-chain balance checks (cache with short TTL, e.g., 30-60 seconds)
- API middleware that checks token balance before serving gated content
- Webhook or polling system to detect token transfers and revoke access
- Never rely on client-side token gate enforcement
- CDN/signed URL expiration for media files (short-lived URLs that require re-verification)

**Detection (warning signs):**
- Token balance checked only during login flow
- Gated content served via static/permanent URLs
- No on-chain balance polling or websocket subscription
- Access revocation not tested in QA

**Phase mapping:** Token-gated content implementation phase. Must be designed into the content delivery architecture, not patched onto existing static file serving.

**Confidence:** MEDIUM -- based on general access control patterns and WordPress Web3 plugin CVE; limited public post-mortems specific to creator platforms.

---

### Pitfall 7: Bonding Curve Economics That Enable Soft Rug Pulls

**What goes wrong:** Even with vesting and cliff protections, the bonding curve parameters themselves can enable extraction. If the curve is too steep, early buyers (including the creator) accumulate outsized value that later buyers can never recover. If the creator's 10% allocation is large relative to the curve's reserve, selling after vesting still crashes the price.

**Why it happens:** Teams focus on the vesting schedule (30-day cliff, 60-day vest) without simulating the economic outcomes. The anti-rug mechanisms prevent sudden pulls but don't prevent slow, predictable extraction that mathematically guarantees later buyers lose. The 90-day cooldown between launches doesn't prevent a creator from extracting maximum value from a single curve.

**Prevention:**
- Simulate bonding curve economics with realistic scenarios: what happens when creator sells their full 10% after vesting? What's the price impact?
- Set maximum price impact thresholds for creator token sales (e.g., creator can only sell X% per day/week)
- Consider a bonding curve shape where the creator's allocation being sold doesn't crash the price below a threshold
- Publish the bonding curve formula and parameters transparently -- users should be able to calculate worst-case scenarios
- Implement gradual sell limits (daily/weekly sell caps) for creator allocations even after vesting completes
- Show users the "creator can sell starting [date]" and "maximum price impact of creator sell" transparently

**Detection (warning signs):**
- No economic simulation of the bonding curve under adversarial conditions
- Creator allocation percentage chosen without modeling price impact
- Vesting schedule designed without considering curve shape interaction
- No transparency about creator sell rights in the UI

**Phase mapping:** Bonding curve design phase (before smart contract implementation). The economics must be modeled and simulated before writing any code.

**Confidence:** MEDIUM -- based on bonding curve theory, Fei Protocol post-mortem, and general tokenomics analysis. Specific to Baremint's 10%/30d/60d parameters.

---

### Pitfall 8: Platform Fee Accounting Drift

**What goes wrong:** On-chain transaction fees, bonding curve spreads, and platform fee percentages create a complex accounting system where rounding errors, failed transactions, and race conditions cause the platform's internal ledger to drift from on-chain reality.

**Why it happens:** Solana transactions can partially fail (instruction-level failures within a transaction). RPC nodes may report different states during high load. Bonding curve math with integer arithmetic introduces rounding. Fee calculations on small token amounts can round to zero. The platform must reconcile its database state with on-chain state, and these will diverge.

**Prevention:**
- On-chain as source of truth: never trust the platform database for balance/fee calculations; always derive from confirmed on-chain state
- Implement reconciliation jobs that compare platform DB state with on-chain state at regular intervals
- Use Solana's `confirmed` or `finalized` commitment levels for financial operations, never `processed`
- Handle partial transaction failures explicitly -- don't assume a transaction either fully succeeds or fully fails
- Implement idempotent transaction processing (the same transaction confirmation processed twice should not double-count fees)
- Integer arithmetic everywhere -- never floating point for financial calculations
- Explicit rounding policy (always round in platform's favor for fees, always round in user's favor for payouts)

**Detection (warning signs):**
- Financial calculations using JavaScript `Number` type or floating point
- No reconciliation process between DB and on-chain state
- Using `processed` commitment level for financial state updates
- No handling for partial transaction failures

**Phase mapping:** Core transaction processing implementation. Must be in place before any real funds flow through the system.

**Confidence:** HIGH -- standard financial engineering principles applied to blockchain-specific failure modes.

---

### Pitfall 9: SIM-Swap and Account Takeover Attacks

**What goes wrong:** Attackers SIM-swap a creator's phone number, gain access to their account, and either drain their custodial wallet or manipulate their token (dump allocation, change content). Friend.tech lost 234 ETH in under 24 hours from SIM-swap attacks on just 4 users.

**Why it happens:** Platforms use SMS-based 2FA or phone-number-based account recovery. Telecom companies are notoriously poor at preventing SIM swaps. High-profile creators with visible on-chain wealth become targeted.

**Prevention:**
- Never use SMS-based 2FA or phone-based account recovery for accounts with custodial wallets
- Require TOTP-based 2FA (authenticator apps) or hardware keys (WebAuthn/passkeys)
- Implement withdrawal delays (e.g., 24-hour hold on first withdrawal to a new address) with email notification
- Account recovery should require multiple factors, not just email or phone
- Rate-limit sensitive operations (withdrawals, settings changes)
- Alert users via multiple channels (email + in-app) when sensitive account changes occur

**Detection (warning signs):**
- SMS-based verification as the primary or only 2FA option
- Account recovery via phone number
- No withdrawal delay for new addresses
- No multi-channel notifications for sensitive operations

**Phase mapping:** Authentication system design (Phase 1). Must be implemented before custodial wallets go live.

**Confidence:** HIGH -- friend.tech SIM-swap incidents are well-documented; Slowmist founder publicly criticized the lack of basic security controls.

---

## Minor Pitfalls

Mistakes that cause user frustration, technical debt, or operational overhead.

---

### Pitfall 10: Solana RPC Reliability and Rate Limits

**What goes wrong:** The platform relies on a single public Solana RPC endpoint, which rate-limits during high traffic, returns stale data, or goes down entirely. Token balance checks fail, transactions time out, users see incorrect balances.

**Prevention:**
- Use a dedicated RPC provider (Helius, QuickNode, Triton) with SLA guarantees
- Implement RPC failover across multiple providers
- Cache on-chain reads with appropriate TTLs (balance checks: 30-60s, historical data: longer)
- Implement retry logic with exponential backoff for transaction submission
- Use websocket subscriptions for real-time updates rather than polling where possible

**Phase mapping:** Infrastructure setup (Phase 1).

**Confidence:** HIGH -- standard Solana development practice.

---

### Pitfall 11: Media Storage Cost Explosion

**What goes wrong:** Creator platforms with user-uploaded media (images, video, audio) see storage and bandwidth costs grow nonlinearly. Without upload limits, a small number of power users can generate outsized costs. Without deduplication, the same content gets stored multiple times.

**Prevention:**
- Set file size limits per upload and total storage quotas per creator tier
- Implement content-addressed storage (hash-based deduplication)
- Use tiered storage (hot for recent content, cold for older)
- Implement CDN with edge caching for popular content
- Consider creator-pays-for-storage model (storage costs deducted from creator token revenue)
- Transcode uploaded media to standard formats/resolutions rather than storing originals at arbitrary sizes

**Phase mapping:** Media upload implementation phase.

**Confidence:** MEDIUM -- general platform engineering; no crypto-specific sources, but applies to all creator platforms.

---

### Pitfall 12: Creator Token Spam and Platform Pollution

**What goes wrong:** Even with a 90-day cooldown between launches, bad actors create throwaway creator accounts to launch low-effort tokens, extract value from initial buyers, and abandon them. The platform fills with dead tokens, eroding trust.

**Prevention:**
- KYC gate for token creation (already planned -- good)
- Minimum creator activity requirements before token launch eligibility
- Platform curation layer (featured vs. unlisted tokens)
- Creator reputation scoring based on content activity and token holder satisfaction
- Consider a refundable creator deposit (staked SOL returned after maintaining activity for N days)
- Dead token cleanup: delist tokens with zero activity after N days

**Phase mapping:** Creator onboarding and token launch feature implementation.

**Confidence:** MEDIUM -- based on pump.fun ecosystem analysis and general platform moderation patterns.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Severity | Mitigation |
|---|---|---|---|
| Custodial wallet infrastructure | Key storage honeypot (#1) | CRITICAL | HSM/KMS from day zero; never store encryption keys alongside encrypted data |
| Authentication system | SIM-swap account takeover (#9) | CRITICAL | TOTP/WebAuthn only; no SMS-based auth for wallet-holding accounts |
| Smart contract development | Missing checks, overflow (#2) | CRITICAL | Anchor with all safety features; professional Solana-specific audit |
| Bonding curve design | MEV sandwich attacks (#3) | HIGH | Built-in slippage protection; sniper tax on launch; MEV-aware tx submission |
| Bonding curve economics | Soft rug pull enablement (#7) | HIGH | Simulate before coding; daily sell caps for creator allocation |
| Content upload system | CSAM liability (#4) | CRITICAL | PhotoDNA scanning before content accessible; NCMEC reporting; never launch uploads without scanning |
| KYC integration | PII breach liability (#5) | HIGH | Third-party KYC provider; data minimization; separate PII storage |
| Token-gated content | Access control bypass (#6) | MODERATE | Real-time balance checks at content access time; short-lived signed URLs |
| Transaction processing | Accounting drift (#8) | MODERATE | On-chain as source of truth; reconciliation jobs; integer arithmetic only |
| Infrastructure | RPC reliability (#10) | LOW | Dedicated provider with failover |
| Media storage | Cost explosion (#11) | LOW | Upload limits, deduplication, tiered storage |
| Token launches | Platform pollution (#12) | LOW | Creator reputation scoring; minimum activity requirements |

---

## Security Architecture Principles (Cross-Cutting)

These are not individual pitfalls but architectural principles that prevent entire categories of failure:

1. **Defense in depth for custodial assets:** HSM for keys, MPC for signing, withdrawal delays, multi-channel alerts, rate limiting. No single compromise should drain funds.

2. **Assume every account passed to a Solana program is adversarial.** Validate signer, owner, data, and relationships for every instruction. Anchor helps but does not guarantee safety.

3. **Separate security domains.** Wallet keys, KYC PII, user credentials, and content storage should be in separate databases/services with separate access controls. A breach of one should not compromise another.

4. **On-chain state is the source of truth.** The platform database is a cache. Any divergence should resolve in favor of on-chain state.

5. **Content moderation is a legal obligation, not a feature.** For a platform that stores and serves user-generated content, CSAM scanning and NCMEC reporting are non-negotiable prerequisites to launch, not post-launch improvements.

---

## Sources

### Solana Security
- [Helius: Solana Hacks Complete History](https://www.helius.dev/blog/solana-hacks)
- [Helius: Hitchhiker's Guide to Solana Program Security](https://www.helius.dev/blog/a-hitchhikers-guide-to-solana-program-security)
- [Sec3: Solana Security Ecosystem Review 2025](https://solanasec25.sec3.dev/)
- [Solana Foundation: Signer Authorization Course](https://solana.com/developers/courses/program-security/signer-auth)
- [Solana Foundation: Owner Checks Course](https://solana.com/developers/courses/program-security/owner-checks)
- [DEV.to: Solana Vulnerabilities Every Developer Should Know](https://dev.to/4k_mira/solana-vulnerabilities-every-developer-should-know-389l)
- [Arxiv: Exploring Vulnerabilities in Solana Smart Contracts](https://arxiv.org/html/2504.07419v1)

### MEV and Sandwich Attacks
- [Helius: Solana MEV Report](https://www.helius.dev/blog/solana-mev-report)
- [Solana Compass: MEV Exposed at Accelerate 2025](https://solanacompass.com/learn/accelerate-25/scale-or-die-at-accelerate-2025-the-state-of-solana-mev)
- [Blockworks: How Solana is Cutting MEV Snipers](https://blockworks.co/news/solana-cutting-mev-snipers)
- [bloXroute: New Era of MEV on Solana](https://bloxroute.com/pulse/a-new-era-of-mev-on-solana/)

### Bonding Curves
- [Fei Protocol Bonding Curve Bug Post-Mortem](https://medium.com/fei-protocol/fei-bonding-curve-bug-post-mortem-98d2c6f271e9)
- [Curve Vulnerability Report](https://medium.com/@peter_4205/curve-vulnerability-report-a1d7630140ec)

### Custodial Wallet Security
- [Kiteworks: HSM Key Protection](https://www.kiteworks.com/regulatory-compliance/hsm-key-protection/)
- [Kiteworks: AES-256 Encryption Security Gaps](https://www.kiteworks.com/secure-file-sharing/encryption-security-gaps/)
- [a16z: Wallet Security Non-Custodial Fallacy](https://a16zcrypto.com/posts/article/wallet-security-non-custodial-fallacy/)

### Platform Incidents
- [friend.tech SIM-Swap Attacks](https://cryptopotato.com/friend-tech-targeted-again-hacker-steals-234-eth-in-under-24-hours/)
- [friend.tech Data Leak: 101K Users Exposed](https://coingape.com/friend-tech-data-leak-101k-user/)
- [Pump.fun Lawsuit and Legal Risks](https://www.o2k.tech/blog/pump-fun-legal-tax-memecoin)
- [Upbit $36M Solana Breach](https://www.ccn.com/education/crypto/upbit-2025-hack-36-million-solana-assets-stolen/)

### KYC and Compliance
- [KYC Compliance in Crypto Statistics 2025](https://coinlaw.io/kyc-compliance-in-crypto-statistics/)
- [Finance Magnates: Are Crypto Platforms Taking Data Protection Seriously?](https://www.financemagnates.com/cryptocurrency/news/are-crypto-platforms-taking-personal-data-protection-seriously-enough/)
- [TechGDPR: GDPR Compliance for Blockchain/Crypto](https://techgdpr.com/industries/gdpr-compliance-for-blockchain-crypto-companies/)

### CSAM and Content Liability
- [Chainalysis: CSAM and Cryptocurrency](https://www.chainalysis.com/blog/csam-cryptocurrency-monero-instant-exchangers-2024/)
- [Chainalysis: Large CSAM Website Identified July 2025](https://www.chainalysis.com/blog/chainalysis-identifies-large-csam-website-using-cryptocurrency-july-2025/)
- [Crystal Intelligence: Global Crackdown on Crypto CSAM Platform](https://crystalintelligence.com/news/global-crackdown-takes-down-crypto-csam-platform/)

### Rug Pull Prevention
- [Streamflow: Introduction to Rug Pull](https://streamflow.finance/blog/what-is-a-rug-pull-in-crypto)
- [Arxiv: RPHunter Rug Pull Analysis](https://arxiv.org/html/2506.18398v3)
- [BDO: How to Identify and Prevent Rug Pulls in Web3](https://www.bdo.com.sg/en-gb/blogs/bdo-cyberdigest/how-to-identify-and-prevent-rug-pulls-in-the-web3-space)
