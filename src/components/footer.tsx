export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border/10 py-8 px-4">
      <div className="mx-auto max-w-2xl flex flex-col items-center gap-3 text-center">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded-md bg-gradient-to-br from-[#00FFA3] to-[#9945FF] flex items-center justify-center">
            <span className="text-[10px] font-bold text-[#050816]">S</span>
          </div>
          <span
            className="text-sm font-semibold text-foreground tracking-tight"
            style={{ fontFamily: "var(--font-space-grotesk)" }}
          >
            SolTrac
          </span>
        </div>
        <p className="text-xs text-muted-foreground/60 max-w-md">
          Transaction intelligence for Solana. We prevent failed transactions by
          predicting, explaining, and fixing failures before they happen.
        </p>
        <div className="flex items-center gap-4 text-xs text-muted-foreground/40">
          <a
            href="https://solana.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            Built for Solana
          </a>
          <span>•</span>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-muted-foreground transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
