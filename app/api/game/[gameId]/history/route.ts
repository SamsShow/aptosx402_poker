/**
 * Game History API
 * 
 * GET /api/game/[gameId]/history - Get hand history for replay
 */

import { NextRequest, NextResponse } from "next/server";
import { gameCoordinator } from "@/lib/game-coordinator";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ gameId: string }> }
) {
  try {
    const { gameId } = await params;
    const { searchParams } = new URL(request.url);
    const handNumber = searchParams.get("hand");
    
    const history = gameCoordinator.getHistory(
      gameId,
      handNumber ? parseInt(handNumber) : undefined
    );
    
    if (!history) {
      return NextResponse.json(
        { error: "No history found" },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error) {
    console.error("[API] Error getting history:", error);
    return NextResponse.json(
      { error: "Failed to get history" },
      { status: 500 }
    );
  }
}

