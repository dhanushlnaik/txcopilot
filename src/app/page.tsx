import Hero from "@/components/hero";
import AnalyzerCard from "@/components/analyzer-card";
import NetworkStrip from "@/components/network-strip";
import Footer from "@/components/footer";
import HowItWorks from "@/components/how-it-works";
import { BackgroundDots, Spotlight } from "@/components/ui/background-effects";
import WebhookManager from "@/components/webhook-manager";

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col">
      {/* Background effects */}
      <BackgroundDots />
      <Spotlight />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col">
        {/* Hero Section */}
        <Hero />

        {/* Analyzer */}
        <AnalyzerCard />

        {/* Network Intelligence Strip */}
        <NetworkStrip />

        {/* How it Works */}
        <HowItWorks />

        {/* Alerts */}
        <section className="mx-auto w-full max-w-2xl px-4 pt-2 pb-8">
          <WebhookManager />
        </section>

        {/* Spacer */}
        <div className="flex-1 min-h-[60px]" />

        {/* Footer */}
        <Footer />
      </div>
    </div>
  );
}
