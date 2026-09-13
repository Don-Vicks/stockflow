export interface MintInfo {
  symbol: string;
  name: string;
  devnetMint: string;
  logoUrl: string;
  pythPriceFeedId: string;
  decimals: number;
}

export const KNOWN_MINTS: Record<string, MintInfo> = {
  xAAPL: {
    symbol: 'xAAPL',
    name: 'Apple Inc.',
    // TODO: Replace with real Devnet xAAPL mint once deployed.
    devnetMint: '11111111111111111111111111111111',
    logoUrl: 'https://logo.clearbit.com/apple.com',
    pythPriceFeedId: '0x49f6b65cb1df6dfacbfcb3cb42e471d87e07eb54f15ddf9e612a4505f0de3fb5',
    decimals: 6,
  },
  xTSLA: {
    symbol: 'xTSLA',
    name: 'Tesla Inc.',
    // TODO: Replace with real Devnet xTSLA mint once deployed.
    devnetMint: '11111111111111111111111111111111',
    logoUrl: 'https://logo.clearbit.com/tesla.com',
    pythPriceFeedId: '0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    decimals: 6,
  },
  xNVDA: {
    symbol: 'xNVDA',
    name: 'NVIDIA Corporation',
    // TODO: Replace with real Devnet xNVDA mint once deployed.
    devnetMint: '11111111111111111111111111111111',
    logoUrl: 'https://logo.clearbit.com/nvidia.com',
    pythPriceFeedId: '0x0035e022422e8b4b9ede5c7d5b27c6df87a6038df1a17ac9cf32bbbf71c8e61d',
    decimals: 6,
  },
  xMSFT: {
    symbol: 'xMSFT',
    name: 'Microsoft Corporation',
    // TODO: Replace with real Devnet xMSFT mint once deployed.
    devnetMint: '11111111111111111111111111111111',
    logoUrl: 'https://logo.clearbit.com/microsoft.com',
    pythPriceFeedId: '0x0d3f83a33a6ad2c97f24b5ac4a7b1f3b5e3a1e7e5c8f2b4d6a9e1c3b5d7f9a2',
    decimals: 6,
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    // Well-known Devnet USDC mint address.
    devnetMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU',
    logoUrl: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
    pythPriceFeedId: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
    decimals: 6,
  }
};

export function getMintBySymbol(symbol: string): MintInfo | undefined {
  if (!symbol) return undefined;
  const upper = symbol.toUpperCase();
  if (KNOWN_MINTS[upper]) return KNOWN_MINTS[upper];
  if (KNOWN_MINTS[`x${upper}`]) return KNOWN_MINTS[`x${upper}`];
  
  return Object.values(KNOWN_MINTS).find(m => upper.includes(m.symbol.replace(/^x/i, '').toUpperCase()));
}

export function getMintByAddress(address: string): MintInfo | undefined {
  return Object.values(KNOWN_MINTS).find(m => m.devnetMint === address);
}
