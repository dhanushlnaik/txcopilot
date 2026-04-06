"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application error:", error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-md">
        <div className="rounded-full bg-red-500/10 p-4 border border-red-500/20">
          <AlertTriangle className="h-8 w-8 text-red-400" />
        </div>
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "var(--font-space-grotesk)" }}
        >
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground">
          An unexpected error occurred. This could be a network issue or a
          temporary problem with the Solana RPC.
        </p>
        <Button
          onClick={reset}
          variant="outline"
          className="mt-2 gap-2"
        >
          <RotateCcw className="h-4 w-4" />
          Try Again
        </Button>
      </div>
    </div>
  );
}
