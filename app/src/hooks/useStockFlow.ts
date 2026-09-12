"use client";
import { useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { StockFlowClient } from "@stockflow/sdk";

export function useStockFlow() {
  const { wallet, publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const client = useMemo(() => {
    if (!wallet?.adapter || !publicKey) return null;
    return new StockFlowClient({ connection, wallet: wallet.adapter as any });
  }, [connection, wallet?.adapter, publicKey]);

  return { client, owner: publicKey, isConnected: connected && !!client };
}
