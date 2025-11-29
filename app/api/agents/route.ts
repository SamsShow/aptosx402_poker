/**
 * Agents API
 * 
 * GET /api/agents - Get all agents with their wallet info
 */

import { NextResponse } from "next/server";
import { AGENT_CONFIGS } from "@/types/agents";
import { walletManager } from "@/lib/wallet-manager";
import { agentManager } from "@/agents/agent-manager";

export async function GET() {
  try {
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    const configs = Object.values(AGENT_CONFIGS);
    const walletInfos = await walletManager.getAllWalletInfos();
    const stats = agentManager.getAllStats();
    
    // Also get wallets from database to show stored info
    const dbWallets = await walletManager.getAllWalletsFromDB();
    
    const agents = configs.map((config) => ({
      ...config,
      wallet: walletInfos[config.id] || null,
      dbWallet: dbWallets.find(w => w.agentId === config.id) || null,
      stats: stats[config.id] || { totalHands: 0, wins: 0, winRate: 0 },
    }));
    
    return NextResponse.json({
      success: true,
      agents,
    });
  } catch (error) {
    console.error("[API] Error getting agents:", error);
    return NextResponse.json(
      { error: "Failed to get agents" },
      { status: 500 }
    );
  }
}
