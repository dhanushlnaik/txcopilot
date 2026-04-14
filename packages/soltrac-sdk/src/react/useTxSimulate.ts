import { useState, useEffect, useRef } from "react";
import { simulateTx } from "../index";
import type { SimResult } from "../types";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";

interface UseTxSimulateOptions {
  rpcUrl?: string;
  debounceMs?: number;
}

interface UseTxSimulateResult {
  result: SimResult | null;
  isLoading: boolean;
  error: Error | null;
}

export function useTxSimulate(
  tx: Transaction | VersionedTransaction | string | null,
  options?: UseTxSimulateOptions
): UseTxSimulateResult {
  const [result, setResult] = useState<SimResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Increment this ref to cancel in-flight requests when tx changes
  const generationRef = useRef(0);

  useEffect(() => {
    if (tx === null) {
      setResult(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const debounceMs = options?.debounceMs ?? 400;

    // Clear any pending debounce
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      // Capture the generation for this invocation
      const generation = ++generationRef.current;

      setIsLoading(true);
      setError(null);

      simulateTx(tx, { rpcUrl: options?.rpcUrl })
        .then((simResult) => {
          if (generation !== generationRef.current) return; // stale
          setResult(simResult);
        })
        .catch((err: unknown) => {
          if (generation !== generationRef.current) return; // stale
          setError(err instanceof Error ? err : new Error(String(err)));
        })
        .finally(() => {
          if (generation !== generationRef.current) return; // stale
          setIsLoading(false);
        });
    }, debounceMs);

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx, options?.rpcUrl, options?.debounceMs]);

  return { result, isLoading, error };
}
