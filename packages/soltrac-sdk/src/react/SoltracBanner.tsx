import React from "react";
import type { SimResult } from "../types";

export interface SoltracBannerProps {
  result: SimResult;
  onFix?: () => void;
  className?: string;
}

const STYLES = {
  warning: {
    background: "var(--color-background-warning)",
    color: "var(--color-text-warning)",
    border: "1px solid var(--color-border-warning)",
    dotColor: "var(--color-text-warning)",
  },
  fail: {
    background: "var(--color-background-danger)",
    color: "var(--color-text-danger)",
    border: "1px solid var(--color-border-danger)",
    dotColor: "var(--color-text-danger)",
  },
} as const;

export function SoltracBanner({ result, onFix, className }: SoltracBannerProps) {
  if (result.risk === "safe") return null;

  const style = STYLES[result.risk];

  const deepLinkUrl =
    result.fixParams?.type === "slippage"
      ? result.fixParams.deepLinkUrl
      : undefined;

  const handleFixClick = () => {
    if (onFix) {
      onFix();
      return;
    }
    if (deepLinkUrl) {
      window.open(deepLinkUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        width: "100%",
        boxSizing: "border-box",
        borderRadius: "8px",
        padding: "12px 16px",
        background: style.background,
        color: style.color,
        border: style.border,
      }}
    >
      {/* Left: dot + reason */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <span
          aria-hidden="true"
          style={{
            flexShrink: 0,
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: style.dotColor,
          }}
        />
        <span style={{ fontSize: "14px", lineHeight: "1.4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {result.reason}
        </span>
      </div>

      {/* Right: fix button or muted fix text */}
      {(deepLinkUrl || onFix) ? (
        <button
          type="button"
          onClick={handleFixClick}
          style={{
            flexShrink: 0,
            fontSize: "13px",
            fontWeight: 600,
            padding: "4px 12px",
            borderRadius: "6px",
            border: style.border,
            background: "transparent",
            color: style.color,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Fix it
        </button>
      ) : result.fix ? (
        <span
          style={{
            flexShrink: 0,
            fontSize: "13px",
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          {result.fix}
        </span>
      ) : null}
    </div>
  );
}
