/**
 * Agents API
 * 
 * GET /api/agents - Get all agents with their wallet info and sponsorship data
 */

import { NextResponse } from "next/server";
import { AGENT_CONFIGS } from "@/types/agents";
import { walletManager } from "@/lib/wallet-manager";
import { agentManager } from "@/agents/agent-manager";
import { getAgentSponsors, getAgentTotalFunding } from "@/lib/db/sponsorship-db";

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
    
    // Fetch sponsorship data for all agents in parallel
    const sponsorshipPromises = configs.map(async (config) => {
      try {
        const [totalFunding, sponsors] = await Promise.all([
          getAgentTotalFunding(config.id),
          getAgentSponsors(config.id),
        ]);
        return {
          agentId: config.id,
          sponsorship: {
            totalFunded: totalFunding.totalAmount,
            sponsorCount: totalFunding.sponsorCount,
            topSponsors: sponsors.slice(0, 5).map(s => ({
              address: s.sponsorAddress,
              totalAmount: s.totalAmount,
              contributionCount: s.contributionCount,
            })),
          },
        };
      } catch (error) {
        console.error(`[API] Error fetching sponsorship for ${config.id}:`, error);
        return {
          agentId: config.id,
          sponsorship: { totalFunded: 0, sponsorCount: 0, topSponsors: [] },
        };
      }
    });
    
    const sponsorships = await Promise.all(sponsorshipPromises);
    const sponsorshipMap = new Map(sponsorships.map(s => [s.agentId, s.sponsorship]));
    
    const agents = configs.map((config) => ({
      ...config,
      wallet: walletInfos[config.id] || null,
      dbWallet: dbWallets.find(w => w.agentId === config.id) || null,
      stats: stats[config.id] || { totalHands: 0, wins: 0, winRate: 0 },
      sponsorship: sponsorshipMap.get(config.id) || { totalFunded: 0, sponsorCount: 0, topSponsors: [] },
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
