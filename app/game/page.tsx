"use client";

import { useSearchParams } from "next/navigation";
import { PokerLobby } from "@/components/poker-lobby";
import { Suspense } from "react";

function GamePageContent() {
  const searchParams = useSearchParams();
  const gameId = searchParams.get("gameId") || undefined;
  
  return <PokerLobby initialGameId={gameId} />;
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-comic-blue border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="font-bold text-muted-foreground">Loading game...</p>
        </div>
      </div>
    }>
      <GamePageContent />
    </Suspense>
  );
}
