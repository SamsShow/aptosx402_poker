/**
 * Fund Agent API
 * 
 * POST /api/agents/[agentId]/fund - Fund an agent
 * 
 * Body:
 * - amount: number (optional, default 1 APT = 100_000_000 octas)
 * - sponsorAddress: string (optional, wallet address of the sponsor)
 * - txHash: string (optional, transaction hash for on-chain transfers)
 * - gameId: string (optional, if funding for a specific game)
 * - source: "faucet" | "wallet" (default: "faucet")
 */

import { NextRequest, NextResponse } from "next/server";
import { walletManager } from "@/lib/wallet-manager";
import { recordSponsorship, getAgentSponsors, getAgentTotalFunding } from "@/lib/db/sponsorship-db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    const body = await request.json().catch(() => ({}));
    const amount = body.amount || 100_000_000; // Default 1 APT
    const sponsorAddress = body.sponsorAddress;
    const txHash = body.txHash;
    const gameId = body.gameId;
    const source = body.source || "faucet";
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    // If funding from faucet
    if (source === "faucet") {
      const success = await walletManager.fundFromFaucet(agentId, amount);
      
      if (!success) {
        return NextResponse.json(
          { error: "Failed to fund agent from faucet" },
          { status: 400 }
        );
      }
      
      // Record faucet funding with system address
      try {
        await recordSponsorship(
          "0x_faucet_system",
          agentId,
          amount,
          undefined,
          gameId
        );
      } catch (dbError) {
        console.error("[API] Error recording faucet sponsorship:", dbError);
        // Continue anyway, sponsorship tracking is secondary
      }
    }
    
    // If funding from wallet transfer
    if (source === "wallet" && sponsorAddress) {
      // Record the sponsorship in database
      try {
        await recordSponsorship(
          sponsorAddress,
          agentId,
          amount,
          txHash,
          gameId
        );
        console.log(`[API] Recorded wallet sponsorship: ${sponsorAddress} -> ${agentId} (${amount} octas)`);
      } catch (dbError) {
        console.error("[API] Error recording wallet sponsorship:", dbError);
        // We still return success since the on-chain transfer succeeded
      }
    }
    
    // Get updated wallet info
    const walletInfo = await walletManager.getWalletInfo(agentId);
    
    // Get sponsorship stats
    let sponsorshipStats = { totalAmount: 0, sponsorCount: 0 };
    let sponsors: Awaited<ReturnType<typeof getAgentSponsors>> = [];
    
    try {
      sponsorshipStats = await getAgentTotalFunding(agentId);
      sponsors = await getAgentSponsors(agentId);
    } catch (dbError) {
      console.error("[API] Error getting sponsorship stats:", dbError);
    }
    
    return NextResponse.json({
      success: true,
      walletInfo,
      sponsorship: {
        totalFunded: sponsorshipStats.totalAmount,
        sponsorCount: sponsorshipStats.sponsorCount,
        topSponsors: sponsors.slice(0, 5).map(s => ({
          address: s.sponsorAddress,
          totalAmount: s.totalAmount,
          contributionCount: s.contributionCount,
        })),
      },
    });
  } catch (error) {
    console.error("[API] Error funding agent:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fund agent" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agents/[agentId]/fund - Get agent funding info
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  try {
    const { agentId } = await params;
    
    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }
    
    const walletInfo = await walletManager.getWalletInfo(agentId);
    
    // Get sponsorship stats
    let sponsorshipStats = { totalAmount: 0, sponsorCount: 0 };
    let sponsors: Awaited<ReturnType<typeof getAgentSponsors>> = [];
    
    try {
      sponsorshipStats = await getAgentTotalFunding(agentId);
      sponsors = await getAgentSponsors(agentId);
    } catch (dbError) {
      console.error("[API] Error getting sponsorship stats:", dbError);
    }
    
    return NextResponse.json({
      success: true,
      walletInfo,
      sponsorship: {
        totalFunded: sponsorshipStats.totalAmount,
        sponsorCount: sponsorshipStats.sponsorCount,
        sponsors: sponsors.map(s => ({
          address: s.sponsorAddress,
          totalAmount: s.totalAmount,
          contributionCount: s.contributionCount,
          lastContribution: s.lastContribution,
        })),
      },
    });
  } catch (error) {
    console.error("[API] Error getting agent funding info:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get funding info" },
      { status: 500 }
    );
  }
}
