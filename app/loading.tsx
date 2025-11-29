export default function Loading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          {/* Spinning poker chip */}
          <div className="w-16 h-16 rounded-full border-4 border-x402 border-t-transparent animate-spin" />
          <div className="absolute inset-2 rounded-full bg-felt flex items-center justify-center">
            <span className="text-white font-bold text-xs">x402</span>
          </div>
        </div>
        <p className="text-muted-foreground animate-pulse">Loading game...</p>
      </div>
    </div>
  );
}

