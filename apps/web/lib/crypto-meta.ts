export type CryptoMeta = {
  symbol: string;
  name: string;
  category: string;
  network: string;
  about: string;
  website: string;
  explorer: string;
};

export const CRYPTO_META: Record<string, CryptoMeta> = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    category: "Digital money · Store of value",
    network: "Bitcoin",
    about: "Bitcoin is a decentralized digital asset secured by a proof-of-work network. It has a fixed maximum supply of 21 million BTC and is commonly used as a long-term store of value and settlement asset.",
    website: "https://bitcoin.org/",
    explorer: "https://mempool.space/",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    category: "Smart-contract platform",
    network: "Ethereum",
    about: "Ethereum is a programmable blockchain for smart contracts, decentralized applications and tokenized assets. ETH is the network's native asset and is used for transaction fees and staking.",
    website: "https://ethereum.org/",
    explorer: "https://etherscan.io/",
  },
  SOL: {
    symbol: "SOL",
    name: "Solana",
    category: "Smart-contract platform",
    network: "Solana",
    about: "Solana is a high-throughput blockchain designed for low-latency applications, payments and decentralized finance. SOL is used for fees and network staking.",
    website: "https://solana.com/",
    explorer: "https://explorer.solana.com/",
  },
  BNB: {
    symbol: "BNB",
    name: "BNB",
    category: "Smart-contract ecosystem",
    network: "BNB Smart Chain",
    about: "BNB is the native asset used across the BNB Chain ecosystem for network fees, staking and application activity.",
    website: "https://www.bnbchain.org/",
    explorer: "https://bscscan.com/",
  },
  LINK: {
    symbol: "LINK",
    name: "Chainlink",
    category: "Oracle network",
    network: "Multi-chain",
    about: "Chainlink is a decentralized oracle network that connects smart contracts with external data, cross-chain messaging and off-chain services. LINK is used within the network's economic model.",
    website: "https://chain.link/",
    explorer: "https://etherscan.io/token/0x514910771af9ca656af840dff83e8264ecf986ca",
  },
  HYPE: {
    symbol: "HYPE",
    name: "Hyperliquid",
    category: "Trading ecosystem",
    network: "Hyperliquid",
    about: "HYPE is the native asset of the Hyperliquid ecosystem, which focuses on on-chain trading infrastructure and a high-performance decentralized exchange experience.",
    website: "https://hyperliquid.xyz/",
    explorer: "https://app.hyperliquid.xyz/explorer",
  },
  XLM: {
    symbol: "XLM",
    name: "Stellar",
    category: "Payments network",
    network: "Stellar",
    about: "Stellar is a payments-focused blockchain designed for moving and issuing digital assets. XLM is the network's native asset and helps support transaction operations.",
    website: "https://stellar.org/",
    explorer: "https://stellar.expert/explorer/public",
  },
};

export function getCryptoMeta(symbol: string): CryptoMeta {
  const normalized = symbol.toUpperCase();
  return CRYPTO_META[normalized] || {
    symbol: normalized,
    name: normalized,
    category: "Crypto asset",
    network: "Blockchain",
    about: `${normalized} is a tracked crypto asset in your NextFi portfolio.`,
    website: "",
    explorer: "",
  };
}
