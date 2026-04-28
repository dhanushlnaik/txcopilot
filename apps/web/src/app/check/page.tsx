import type { Metadata } from "next";
import { BackgroundDots, Spotlight } from "@/components/ui/background-effects";
import CheckPage from "./CheckPage";

export const metadata: Metadata = {
  title: "Pre-flight Check — SolTrac",
  description: "Paste a base64 transaction or signature to get a full risk assessment before sending.",
};

export default function Page() {
  return (
    <div className="relative flex flex-1 flex-col min-h-screen">
      <BackgroundDots />
      <Spotlight />
      <div className="relative z-10 flex flex-1 flex-col">
        <CheckPage />
      </div>
    </div>
  );
}
