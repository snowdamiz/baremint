const COINGECKO_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";

const CACHE_TTL_MS = 60_000; // 60 seconds

let cachedPrice: number | null = null;
let cachedAt: number = 0;

/**
 * Fetch the current SOL/USD price from CoinGecko.
 * Results are cached for 60 seconds to avoid rate limits.
 */
export async function getSolUsdPrice(): Promise<number> {
  const now = Date.now();
  if (cachedPrice !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedPrice;
  }

  try {
    const response = await fetch(COINGECKO_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 },
    });

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      solana?: { usd?: number };
    };

    const price = data.solana?.usd;
    if (typeof price !== "number") {
      throw new Error("Invalid CoinGecko response format");
    }

    cachedPrice = price;
    cachedAt = now;
    return price;
  } catch (error) {
    console.error("Failed to fetch SOL/USD price:", error);
    // Return cached value if available, otherwise 0
    return cachedPrice ?? 0;
  }
}
