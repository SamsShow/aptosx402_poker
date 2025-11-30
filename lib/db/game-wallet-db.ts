/**
 * Game Wallet Database Functions
 * 
 * Database operations for per-game agent wallets and funding
 */

import { db, gameAgentWallets, gameFunding, type GameAgentWallet, type NewGameAgentWallet, type GameFunding, type NewGameFunding } from "./index";
import { eq, and } from "drizzle-orm";

/**
 * Save a game-specific agent wallet
 */
export async function saveGameWallet(wallet: NewGameAgentWallet): Promise<void> {
    await db
        .insert(gameAgentWallets)
        .values(wallet)
        .onConflictDoUpdate({
            target: gameAgentWallets.id,
            set: {
                address: wallet.address,
                publicKey: wallet.publicKey,
                privateKey: wallet.privateKey,
                currentBalance: wallet.currentBalance,
                updatedAt: new Date(),
            },
        });
}

/**
 * Get all wallets for a specific game
 */
export async function getGameWallets(gameId: string): Promise<GameAgentWallet[]> {
    return db
        .select()
        .from(gameAgentWallets)
        .where(eq(gameAgentWallets.gameId, gameId));
}

/**
 * Get a specific wallet for a game-agent combination
 */
export async function getGameWallet(gameId: string, agentId: string): Promise<GameAgentWallet | null> {
    const results = await db
        .select()
        .from(gameAgentWallets)
        .where(
            and(
                eq(gameAgentWallets.gameId, gameId),
                eq(gameAgentWallets.agentId, agentId)
            )
        )
        .limit(1);

    return results[0] || null;
}

/**
 * Update wallet balance
 */
export async function updateGameWalletBalance(
    gameId: string,
    agentId: string,
    balance: number
): Promise<void> {
    await db
        .update(gameAgentWallets)
        .set({
            currentBalance: balance,
            updatedAt: new Date()
        })
        .where(
            and(
                eq(gameAgentWallets.gameId, gameId),
                eq(gameAgentWallets.agentId, agentId)
            )
        );
}

/**
 * Save a game funding record
 */
export async function saveGameFunding(funding: NewGameFunding): Promise<void> {
    await db.insert(gameFunding).values(funding);
}

/**
 * Get all funding records for a game
 */
export async function getGameFunding(gameId: string): Promise<GameFunding[]> {
    return db
        .select()
        .from(gameFunding)
        .where(eq(gameFunding.gameId, gameId));
}

/**
 * Get funding records for a specific agent in a game
 */
export async function getAgentGameFunding(gameId: string, agentId: string): Promise<GameFunding[]> {
    return db
        .select()
        .from(gameFunding)
        .where(
            and(
                eq(gameFunding.gameId, gameId),
                eq(gameFunding.agentId, agentId)
            )
        );
}

/**
 * Update funding status
 */
export async function updateFundingStatus(
    fundingId: string,
    status: string,
    txHash?: string
): Promise<void> {
    await db
        .update(gameFunding)
        .set({
            status,
            ...(txHash && { txHash })
        })
        .where(eq(gameFunding.id, fundingId));
}

/**
 * Delete game wallets (cleanup after game ends)
 */
export async function deleteGameWallets(gameId: string): Promise<void> {
    await db.delete(gameAgentWallets).where(eq(gameAgentWallets.gameId, gameId));
}
