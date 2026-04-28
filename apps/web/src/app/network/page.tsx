import type { Metadata } from "next";
import { BackgroundDots, Spotlight } from "@/components/ui/background-effects";
import { NetworkPage } from "./NetworkPage";

export const metadata: Metadata = {
  title: "Network Pulse — SolTrac",
  description: "Live Solana network congestion, priority fees, and transaction success rates.",
};

export default function Page() {
  return (
    <div className="relative flex flex-1 flex-col min-h-screen">
      <BackgroundDots />
      <Spotlight />
      <div className="relative z-10 flex flex-1 flex-col">
        <NetworkPage />
      </div>
    </div>
  );
}
