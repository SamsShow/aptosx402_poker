/**
 * Game Wallet Manager
 * 
 * Manages per-game agent wallets - each game gets separate wallets for all agents
 * Users fund these wallets, and they're used for game transactions via x402
 */

import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import { AGENT_CONFIGS } from "@/types/agents";
import { getAccountBalance, octasToApt } from "./aptos-client";
import {
    saveGameWallet,
    getGameWallets,
    getGameWallet,
    updateGameWalletBalance,
    saveGameFunding,
    getGameFunding,
    getAgentGameFunding,
    deleteGameWallets,
} from "./db/game-wallet-db";
import type {
    GameAgentWallet,
    NewGameAgentWallet,
    GameFunding,
    NewGameFunding
} from "./db/index";

export interface GameWalletInfo {
    agentId: string;
    agentName: string;
    address: string;
    publicKey: string;
    balance: number;
    balanceApt: number;
    initialFunding: number;
    requiredAmount: number;
    funded: boolean;
}

export interface FundingRecord {
    id: string;
    funderAddress: string;
    agentId: string;
    amount: number;
    txHash: string | null;
    status: string;
    createdAt: Date;
}

class GameWalletManager {
    // Cache for game wallets: gameId -> (agentId -> Account)
    private walletCache: Map<string, Map<string, Account>> = new Map();

    /**
     * Create wallets for all agents in a game
     * Each agent gets a unique wallet for this specific game
     */
    async createGameWallets(
        gameId: string,
        agentIds: string[],
        requiredAmount = 100_000_000 // Default 1 APT in octas
    ): Promise<GameWalletInfo[]> {
        const walletInfos: GameWalletInfo[] = [];
        const gameWallets = new Map<string, Account>();

        console.log(`[GameWalletManager] Creating wallets for game ${gameId} with ${agentIds.length} agents`);

        for (const agentId of agentIds) {
            // Generate new wallet for this game-agent combination
            const privateKey = Ed25519PrivateKey.generate();
            const privateKeyHex = privateKey.toString();
            const account = Account.fromPrivateKey({ privateKey });

            const address = account.accountAddress.toString();
            const publicKey = account.publicKey.toString();

            // Save to database
            const walletData: NewGameAgentWallet = {
                id: `${gameId}_${agentId}`,
                gameId,
                agentId,
                address,
                publicKey,
                privateKey: privateKeyHex,
                initialFunding: 0,
                currentBalance: 0,
            };

            await saveGameWallet(walletData);

            // Cache the account
            gameWallets.set(agentId, account);

            // Get agent info
            const agentConfig = Object.values(AGENT_CONFIGS).find(c => c.id === agentId);
            const agentName = agentConfig?.name || agentId;

            walletInfos.push({
                agentId,
                agentName,
                address,
                publicKey,
                balance: 0,
                balanceApt: 0,
                initialFunding: 0,
                requiredAmount,
                funded: false,
            });

            console.log(`[GameWalletManager] Created wallet for ${agentName}: ${address}`);
        }

        // Store in cache
        this.walletCache.set(gameId, gameWallets);

        return walletInfos;
    }

    /**
     * Get wallet for a specific agent in a game
     */
    async getWallet(gameId: string, agentId: string): Promise<Account | null> {
        // Check cache first
        const gameWallets = this.walletCache.get(gameId);
        if (gameWallets?.has(agentId)) {
            return gameWallets.get(agentId) || null;
        }

        // Load from database
        const walletData = await getGameWallet(gameId, agentId);
        if (!walletData) return null;

        // Reconstruct account from private key
        const account = this.loadAccountFromPrivateKey(walletData.privateKey);

        // Update cache
        if (!this.walletCache.has(gameId)) {
            this.walletCache.set(gameId, new Map());
        }
        this.walletCache.get(gameId)!.set(agentId, account);

        return account;
    }

    /**
     * Load all wallets for a game into cache
     */
    async loadGameWallets(gameId: string): Promise<void> {
        const wallets = await getGameWallets(gameId);
        const gameWalletMap = new Map<string, Account>();

        for (const wallet of wallets) {
            const account = this.loadAccountFromPrivateKey(wallet.privateKey);
            gameWalletMap.set(wallet.agentId, account);
        }

        this.walletCache.set(gameId, gameWalletMap);
        console.log(`[GameWalletManager] Loaded ${wallets.length} wallets for game ${gameId}`);
    }

    /**
     * Get wallet info for all agents in a game
     */
    async getGameWalletInfos(gameId: string, requiredAmount = 100_000_000): Promise<GameWalletInfo[]> {
        const wallets = await getGameWallets(gameId);
        const infos: GameWalletInfo[] = [];

        for (const wallet of wallets) {
            const balance = await getAccountBalance(wallet.address);
            const balanceNum = Number(balance);

            const agentConfig = Object.values(AGENT_CONFIGS).find(c => c.id === wallet.agentId);
            const agentName = agentConfig?.name || wallet.agentId;

            infos.push({
                agentId: wallet.agentId,
                agentName,
                address: wallet.address,
                publicKey: wallet.publicKey,
                balance: balanceNum,
                balanceApt: octasToApt(balance),
                initialFunding: wallet.initialFunding,
                requiredAmount,
                funded: balanceNum >= requiredAmount,
            });
        }

        return infos;
    }

    /**
     * Record funding for a game wallet
     */
    async recordFunding(
        gameId: string,
        agentId: string,
        funderAddress: string,
        amount: number,
        txHash?: string
    ): Promise<string> {
        const wallet = await getGameWallet(gameId, agentId);
        if (!wallet) {
            throw new Error(`Wallet not found for game ${gameId}, agent ${agentId}`);
        }

        const fundingId = `fund_${gameId}_${agentId}_${Date.now()}`;

        const fundingData: NewGameFunding = {
            id: fundingId,
            gameId,
            funderAddress,
            agentId,
            gameWalletAddress: wallet.address,
            amount,
            txHash: txHash || null,
            status: txHash ? "confirmed" : "pending",
        };

        await saveGameFunding(fundingData);

        // Update wallet balance if confirmed
        if (txHash) {
            const currentBalance = await getAccountBalance(wallet.address);
            await updateGameWalletBalance(gameId, agentId, Number(currentBalance));
        }

        console.log(`[GameWalletManager] Recorded funding: ${amount} octas to ${agentId} in game ${gameId}`);

        return fundingId;
    }

    /**
     * Get funding records for a game
     */
    async getFundingRecords(gameId: string): Promise<FundingRecord[]> {
        const records = await getGameFunding(gameId);
        return records.map(r => ({
            id: r.id,
            funderAddress: r.funderAddress,
            agentId: r.agentId,
            amount: r.amount,
            txHash: r.txHash,
            status: r.status,
            createdAt: r.createdAt,
        }));
    }

    /**
     * Get total funding for a specific agent in a game
     */
    async getAgentTotalFunding(gameId: string, agentId: string): Promise<number> {
        const records = await getAgentGameFunding(gameId, agentId);
        return records
            .filter(r => r.status === "confirmed")
            .reduce((sum, r) => sum + r.amount, 0);
    }

    /**
     * Update wallet balances from blockchain
     */
    async refreshWalletBalances(gameId: string): Promise<void> {
        const wallets = await getGameWallets(gameId);

        await Promise.all(
            wallets.map(async (wallet) => {
                const balance = await getAccountBalance(wallet.address);
                await updateGameWalletBalance(gameId, wallet.agentId, Number(balance));
            })
        );

        console.log(`[GameWalletManager] Refreshed balances for ${wallets.length} wallets in game ${gameId}`);
    }

    /**
     * Clean up game wallets after game ends
     * Note: This doesn't delete the database records (for history), just clears cache
     */
    clearGameCache(gameId: string): void {
        this.walletCache.delete(gameId);
        console.log(`[GameWalletManager] Cleared cache for game ${gameId}`);
    }

    /**
     * Permanently delete game wallets (use with caution)
     */
    async deleteGameWallets(gameId: string): Promise<void> {
        await deleteGameWallets(gameId);
        this.walletCache.delete(gameId);
        console.log(`[GameWalletManager] Deleted all wallets for game ${gameId}`);
    }

    /**
     * Load account from private key string
     */
    private loadAccountFromPrivateKey(privateKeyHex: string): Account {
        const cleanKey = privateKeyHex.startsWith("0x")
            ? privateKeyHex.slice(2)
            : privateKeyHex;
        const privateKey = new Ed25519PrivateKey(cleanKey);
        return Account.fromPrivateKey({ privateKey });
    }

    /**
     * Check if all wallets for a game are sufficiently funded
     */
    async areWalletsFunded(gameId: string, requiredAmount: number): Promise<boolean> {
        const infos = await this.getGameWalletInfos(gameId, requiredAmount);
        return infos.every(info => info.funded);
    }
}

// Use global to persist across Next.js hot reloads
declare global {
    // eslint-disable-next-line no-var
    var gameWalletManagerInstance: GameWalletManager | undefined;
}

// Singleton instance
if (!globalThis.gameWalletManagerInstance) {
    globalThis.gameWalletManagerInstance = new GameWalletManager();
}

export const gameWalletManager = globalThis.gameWalletManagerInstance;
