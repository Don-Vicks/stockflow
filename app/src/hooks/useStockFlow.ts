"use client";

import { useMemo } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { StockFlowClient } from "@stockflow/sdk";

/**
 * Single hook that gives every page a ready-to-use StockFlowClient
 * bound to the connected wallet and RPC connection.
 *
 * Returns null for `client` and `owner` when the wallet is disconnected
 * or the adapter hasn't been initialised yet — pages gate their live
 * reads on `isConnected` rather than handling null branching themselves.
 */
export function useStockFlow() {
  const { wallet, publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const client = useMemo(() => {
    // wallet.adapter must satisfy the Wallet interface StockFlowClient
    // expects (signTransaction / signAllTransactions). The wallet-adapter
    // types are compatible; the `as any` avoids a deep nominal mismatch
    // between @solana/wallet-adapter-base's Wallet and Anchor's Wallet.
    if (!wallet?.adapter || !publicKey) return null;
    return new StockFlowClient({
      connection,
      wallet: wallet.adapter as any,
    });
  }, [connection, wallet?.adapter, publicKey]);

  return {
    client,
    owner: publicKey,
    isConnected: connected && !!client && !!publicKey,
  };
}
