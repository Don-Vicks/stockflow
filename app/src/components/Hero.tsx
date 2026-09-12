"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";

export default function Hero() {
  return (
    <section className="relative w-full h-[85vh] flex items-center overflow-hidden border-b border-line bg-ink">
      {/* Background Image - Cleaned up and blended properly */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-luminosity">
        <Image 
          src="/stockflow_hero_bg.jpg"
          alt="Abstract financial growth"
          fill
          className="object-cover object-right"
          priority
        />
        {/* Linear gradient fade out to seamlessly blend the image into the background */}
        <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/90 to-transparent"></div>
      </div>

      <div className="relative z-10 w-full md:w-[60%] pl-8 md:pl-24 pr-8">
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <h1 className="font-display text-5xl md:text-7xl text-paper leading-[1.05] tracking-tight mb-6">
            Put your stocks <br />
            <span className="text-signal">to work.</span>
          </h1>
          <p className="font-mono text-base md:text-lg text-muted mb-10 max-w-lg leading-relaxed">
            Unlock liquidity without selling. Turn tokenized equities into programmable financial accounts. Automate payments, manage risk, and compose your portfolio on Solana.
          </p>
          <div className="flex gap-4">
            <Link href="/dashboard" className="rounded-md bg-paper px-6 py-3 font-mono text-sm font-semibold text-ink hover:bg-white transition-colors">
              Launch App →
            </Link>
            <a href="https://github.com/Don-Vicks/stockflow" target="_blank" rel="noreferrer" className="rounded-md border border-line bg-panel px-6 py-3 font-mono text-sm text-paper hover:border-muted transition-colors">
              View Source
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
