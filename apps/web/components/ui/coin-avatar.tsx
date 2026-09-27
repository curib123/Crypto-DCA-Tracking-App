import Image from "next/image";
import { getCryptoMeta } from "@/lib/crypto-meta";

export function CoinAvatar({
  symbol,
  size = 44,
}: {
  symbol: string;
  size?: number;
}) {
  const normalized = symbol.toUpperCase();
  const meta = getCryptoMeta(normalized);
  const known = ["BTC", "ETH", "SOL", "BNB", "LINK", "HYPE", "XLM"].includes(normalized);

  if (!known) {
    return (
      <span className="coin-avatar coin-avatar-fallback" style={{ width: size, height: size }}>
        {normalized.slice(0, 2)}
      </span>
    );
  }

  return (
    <span className="coin-avatar" style={{ width: size, height: size }}>
      <Image
        src={`/crypto/${normalized.toLowerCase()}.svg`}
        alt={`${meta.name} logo`}
        width={size}
        height={size}
      />
    </span>
  );
}
