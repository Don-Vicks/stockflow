"use client";
import Hero from "@/components/Hero";
import Marquee from "@/components/Marquee";
import { Features } from "@/components/Features";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";

export default function LandingPage() {
  return (
    <main>
      <TopNav />
      <Hero />
      <Marquee />
      <Features />
      <Footer />
    </main>
  );
}
