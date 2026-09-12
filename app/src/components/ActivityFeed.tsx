import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { Activity, ArrowRight, ExternalLink } from "lucide-react";

export function ActivityFeed() {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const [sigs, setSigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicKey) {
       setSigs([]);
       setLoading(false);
       return;
    }
    
    setLoading(true);
    connection.getSignaturesForAddress(publicKey, { limit: 5 })
      .then(fetched => setSigs(fetched))
      .catch(e => console.error(e))
      .finally(() => setLoading(false));
  }, [publicKey, connection]);

  return (
    <div className="rounded-xl border border-line bg-panel p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-display text-lg text-paper flex items-center gap-2">
          <Activity className="w-5 h-5 text-signal" />
          Recent Network Activity
        </h3>
        <a 
          href={publicKey ? `https://explorer.solana.com/address/${publicKey.toBase58()}?cluster=devnet` : '#'} 
          target="_blank" 
          rel="noreferrer"
          className="font-mono text-xs text-signal hover:underline flex items-center gap-1"
        >
          Explorer <ExternalLink className="w-3 h-3" />
        </a>
      </div>
      <div className="space-y-4">
        {loading && <p className="font-mono text-sm text-muted animate-pulse">Scanning ledger...</p>}
        {!loading && sigs.length === 0 && (
          <p className="font-mono text-sm text-muted">No recent on-chain activity found.</p>
        )}
        {!loading && sigs.map((sig) => {
          const isSuccess = sig.err === null;
          const date = new Date((sig.blockTime || 0) * 1000);
          const timeAgo = Math.floor((Date.now() - date.getTime()) / 60000);
          
          return (
            <div key={sig.signature} className="flex items-center justify-between group cursor-default">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border ${isSuccess ? 'bg-signal/10 border-signal/20' : 'bg-alert/10 border-alert/20'}`}>
                  <ArrowRight className={`w-3.5 h-3.5 ${isSuccess ? 'text-signal' : 'text-alert'}`} />
                </div>
                <div>
                  <a href={`https://explorer.solana.com/tx/${sig.signature}?cluster=devnet`} target="_blank" rel="noreferrer" className="font-mono text-sm text-paper hover:text-signal transition-colors flex items-center gap-1">
                    Tx: {sig.signature.slice(0, 8)}...
                  </a>
                  <p className="font-mono text-xs text-muted">{timeAgo} mins ago</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-mono text-xs uppercase ${isSuccess ? 'text-signal' : 'text-alert'}`}>{isSuccess ? 'Success' : 'Failed'}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
