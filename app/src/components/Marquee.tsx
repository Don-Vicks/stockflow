"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PriceServiceConnection } from "@pythnetwork/price-service-client";

const PYTH_HERMES_URL = "https://hermes.pyth.network";
const ASSET_FEEDS = [
  { symbol: "xAAPL", id: "0x49f6b65cb9df66133297a7605d3cd9550b1dbf4369e80205d105ff7cc0f47bc5" },
  { symbol: "xTSLA", id: "0xdcc7ec837bbcd42ccbc745ea79c7873b4d1ba25539d09c258d4a6e0c1f6b647d" },
  { symbol: "xNVDA", id: "0xdc4baaa2aa6a8bb16110f08cb3dc7c32bca5bfec5dc504ebc7dc5c1ccfb33139" },
  { symbol: "xMSFT", id: "0x7a854580b8529e4b77f98bf24fa7520e7dfde7b8ee875eb0897f1f0a202d2427" },
];

export default function Marquee() {
  const [assets, setAssets] = useState(
    ASSET_FEEDS.map(a => ({ symbol: a.symbol, price: "...", change: "..." }))
  );

  useEffect(() => {
    let active = true;
    const connection = new PriceServiceConnection(PYTH_HERMES_URL, {
      priceFeedRequestConfig: { binary: true }
    });

    const feedIds = ASSET_FEEDS.map(f => f.id);
    const staticAssets = [
      { symbol: "xNVDA", price: "$120.45", change: "+2.4%" },
      { symbol: "xAAPL", price: "$190.12", change: "+1.1%" },
      { symbol: "xTSLA", price: "$175.50", change: "-0.8%" },
      { symbol: "xMSFT", price: "$410.22", change: "+1.5%" },
    ];
    setAssets(staticAssets);

    connection.getLatestPriceFeeds(feedIds).then(prices => {
      if (!active || !prices) return;
      const updated = ASSET_FEEDS.map((feed, i) => {
        const priceObj = prices.find(p => p.id === feed.id);
        if (!priceObj) return staticAssets[i];
        const p = priceObj.getPriceUnchecked();
        const priceVal = Number(p.price) * Math.pow(10, p.expo);
        return {
          symbol: feed.symbol,
          price: `$${priceVal.toFixed(2)}`,
          change: staticAssets[i].change
        };
      });
      setAssets(updated);
    }).catch(console.error);

    return () => { active = false; };
  }, []);

  return (
    <div className="overflow-hidden whitespace-nowrap bg-panel py-2 border-b border-line relative flex">
      <motion.div
        className="flex gap-12 w-max items-center pr-12 font-mono text-xs uppercase"
        animate={{ x: [0, "-50%"] }}
        transition={{ repeat: Infinity, duration: 25, ease: "linear" }}
      >
        {[...assets, ...assets].map((asset, i) => (
          <div key={i} className="flex items-center gap-3 px-4">
            <span className="text-paper font-semibold">{asset.symbol}</span>
            <span className="text-muted">{asset.price}</span>
            <span className={asset.change.startsWith('+') ? "text-signal" : "text-alert"}>
              {asset.change}
            </span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
