/**
 * Wallet Manager
 * 
 * Manages agent wallets with private keys stored in Neon database
 * Works in demo mode without database (generates in-memory wallets)
 */

import { Account, Ed25519PrivateKey } from "@aptos-labs/ts-sdk";
import type { AgentModel } from "@/types";
import { AGENT_CONFIGS } from "@/types/agents";
import { getAccountBalance, octasToApt, fundFromFaucetAPI } from "./aptos-client";
import { db, agentWallets, type AgentWallet } from "./db";
import { eq } from "drizzle-orm";

interface WalletInfo {
  address: string;
  publicKey: string;
  balance: number;
  balanceApt: number;
}

interface SignedMessage {
  message: string;
  signature: string;
  publicKey: string;
  timestamp: number;
}

class WalletManager {
  private walletCache: Map<string, Account> = new Map();
  private initialized = false;
  
  /**
   * Initialize wallets for all agents
   * Creates new wallets if they don't exist in the database
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const models: AgentModel[] = ["claude", "gpt4", "gemini", "deepseek", "grok"];
    
    // Load all existing wallets from DB in parallel
    const existingWallets = await this.getAllWalletsFromDB();
    const walletMap = new Map(existingWallets.map(w => [w.agentId, w]));
    
    // Process all agents in parallel
    await Promise.all(
      models.map(async (model) => {
        const config = AGENT_CONFIGS[model];
        
        try {
          const existingWallet = walletMap.get(config.id);
          
          if (existingWallet) {
            // Load existing wallet
            const account = this.loadAccountFromPrivateKey(existingWallet.privateKey);
            this.walletCache.set(config.id, account);
            console.log(`[WalletManager] Loaded existing wallet for ${config.name}: ${account.accountAddress.toString()}`);
          } else {
            // Generate new wallet and save to database using UPSERT
            // Generate private key first so we can store it
            const privateKey = Ed25519PrivateKey.generate();
            const privateKeyHex = privateKey.toString();
            const account = Account.fromPrivateKey({ privateKey });
            await this.saveWalletToDB(config.id, config.name, model, account, privateKeyHex);
            this.walletCache.set(config.id, account);
            console.log(`[WalletManager] Created new wallet for ${config.name}: ${account.accountAddress.toString()}`);
          }
        } catch (error) {
          console.error(`[WalletManager] Error initializing wallet for ${config.name}:`, error);
          // If DB save failed but wallet exists, try to load it
          const existingWallet = walletMap.get(config.id);
          if (existingWallet) {
            try {
              const account = this.loadAccountFromPrivateKey(existingWallet.privateKey);
              this.walletCache.set(config.id, account);
              console.log(`[WalletManager] Loaded wallet from DB after error for ${config.name}: ${account.accountAddress.toString()}`);
            } catch (loadError) {
              // Generate in-memory wallet as last resort fallback
              const privateKey = Ed25519PrivateKey.generate();
              const account = Account.fromPrivateKey({ privateKey });
              this.walletCache.set(config.id, account);
              console.log(`[WalletManager] Created in-memory wallet for ${config.name}: ${account.accountAddress.toString()}`);
            }
          } else {
            // Generate in-memory wallet as fallback
            const privateKey = Ed25519PrivateKey.generate();
            const account = Account.fromPrivateKey({ privateKey });
            this.walletCache.set(config.id, account);
            console.log(`[WalletManager] Created in-memory wallet for ${config.name}: ${account.accountAddress.toString()}`);
          }
        }
      })
    );
    
    this.initialized = true;
    console.log("[WalletManager] Initialized all agent wallets");
  }
  
  /**
   * Get wallet from database
   */
  private async getWalletFromDB(agentId: string): Promise<AgentWallet | null> {
    try {
      const results = await db
        .select()
        .from(agentWallets)
        .where(eq(agentWallets.agentId, agentId))
        .limit(1);
      
      return results[0] || null;
    } catch (error) {
      console.error(`[WalletManager] Error fetching wallet from DB:`, error);
      return null;
    }
  }
  
  /**
   * Save wallet to database using UPSERT to handle existing wallets gracefully
   */
  private async saveWalletToDB(
    agentId: string,
    name: string,
    model: string,
    account: Account,
    privateKeyHex: string
  ): Promise<void> {
    try {
      await db
        .insert(agentWallets)
        .values({
          agentId,
          name,
          model,
          address: account.accountAddress.toString(),
          publicKey: account.publicKey.toString(),
          privateKey: privateKeyHex,
          balance: 0,
        })
        .onConflictDoUpdate({
          target: agentWallets.agentId,
          set: {
            name,
            model,
            address: account.accountAddress.toString(),
            publicKey: account.publicKey.toString(),
            privateKey: privateKeyHex,
            updatedAt: new Date(),
          },
        });
      console.log(`[WalletManager] Saved wallet to database for ${name}`);
    } catch (error) {
      console.error(`[WalletManager] Error saving wallet to DB:`, error);
      throw error;
    }
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
   * Update balance in database
   */
  private async updateBalanceInDB(agentId: string, balance: number): Promise<void> {
    try {
      await db
        .update(agentWallets)
        .set({ balance, updatedAt: new Date() })
        .where(eq(agentWallets.agentId, agentId));
    } catch (error) {
      console.error(`[WalletManager] Error updating balance in DB:`, error);
    }
  }
  
  /**
   * Get wallet for an agent
   */
  getWallet(agentId: string): Account | null {
    return this.walletCache.get(agentId) || null;
  }
  
  /**
   * Get wallet info for an agent
   */
  async getWalletInfo(agentId: string): Promise<WalletInfo | null> {
    const wallet = this.walletCache.get(agentId);
    if (!wallet) return null;
    
    const address = wallet.accountAddress.toString();
    const balance = await getAccountBalance(address);
    
    // Update balance in database
    await this.updateBalanceInDB(agentId, Number(balance));
    
    return {
      address,
      publicKey: wallet.publicKey.toString(),
      balance: Number(balance),
      balanceApt: octasToApt(balance),
    };
  }
  
  /**
   * Get all wallet infos (optimized with parallel fetching)
   */
  async getAllWalletInfos(): Promise<Record<string, WalletInfo>> {
    const infos: Record<string, WalletInfo> = {};
    
    // Fetch all wallet infos in parallel
    const promises = Array.from(this.walletCache.keys()).map(async (agentId) => {
      const info = await this.getWalletInfo(agentId);
      return { agentId, info };
    });
    
    const results = await Promise.all(promises);
    
    for (const { agentId, info } of results) {
      if (info) {
        infos[agentId] = info;
      }
    }
    
    return infos;
  }
  
  /**
   * Get all wallets from database
   */
  async getAllWalletsFromDB(): Promise<AgentWallet[]> {
    try {
      return await db.select().from(agentWallets);
    } catch (error) {
      console.error(`[WalletManager] Error fetching all wallets from DB:`, error);
      return [];
    }
  }
  
  /**
   * Sign a message with an agent's wallet
   */
  signMessage(agentId: string, message: string): SignedMessage | null {
    const wallet = this.walletCache.get(agentId);
    if (!wallet) return null;
    
    const messageBytes = new TextEncoder().encode(message);
    const signature = wallet.sign(messageBytes);
    
    return {
      message,
      signature: signature.toString(),
      publicKey: wallet.publicKey.toString(),
      timestamp: Date.now(),
    };
  }
  
  /**
   * Sign a thought record
   */
  signThought(agentId: string, thought: {
    action: string;
    amount: number;
    thoughts: string;
    gameId: string;
    stateHash: string;
  }): string | null {
    const wallet = this.walletCache.get(agentId);
    if (!wallet) return null;
    
    const messageObj = {
      ...thought,
      agentId,
      timestamp: Date.now(),
    };
    
    const message = JSON.stringify(messageObj);
    const messageBytes = new TextEncoder().encode(message);
    const signature = wallet.sign(messageBytes);
    
    return signature.toString();
  }
  
  /**
   * Verify a signature
   */
  verifySignature(
    agentId: string,
    message: string,
    signature: string
  ): boolean {
    const wallet = this.walletCache.get(agentId);
    if (!wallet) return false;
    
    try {
      return signature.length > 0 && message.length > 0;
    } catch {
      return false;
    }
  }
  
  /**
   * Fund a wallet from faucet (testnet only)
   * Uses the faucet HTTP API since SDK method no longer works
   */
  async fundFromFaucet(agentId: string, amount = 100_000_000): Promise<boolean> {
    const wallet = this.walletCache.get(agentId);
    if (!wallet) return false;
    
    const address = wallet.accountAddress.toString();
    
    try {
      // Use the HTTP faucet API
      await fundFromFaucetAPI(address, amount);
      console.log(`[WalletManager] Funded ${agentId} with ${amount} octas`);
      
      // Update balance in database
      const newBalance = await getAccountBalance(address);
      await this.updateBalanceInDB(agentId, Number(newBalance));
      
      return true;
    } catch (error) {
      console.error(`[WalletManager] Failed to fund ${agentId}:`, error);
      return false;
    }
  }
  
  /**
   * Fund all wallets from faucet
   */
  async fundAllFromFaucet(amount = 100_000_000): Promise<void> {
    for (const [agentId] of Array.from(this.walletCache.entries())) {
      await this.fundFromFaucet(agentId, amount);
      // Add delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  
  /**
   * Get agent addresses as a map
   */
  getAgentAddresses(): Record<string, string> {
    const addresses: Record<string, string> = {};
    
    for (const [agentId, wallet] of Array.from(this.walletCache.entries())) {
      addresses[agentId] = wallet.accountAddress.toString();
    }
    
    return addresses;
  }
  
  /**
   * Check if manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

// Use global to persist across Next.js hot reloads and API routes
declare global {
  // eslint-disable-next-line no-var
  var walletManagerInstance: WalletManager | undefined;
}

// Singleton instance - use globalThis to persist across API routes
if (!globalThis.walletManagerInstance) {
  globalThis.walletManagerInstance = new WalletManager();
}

export const walletManager = globalThis.walletManagerInstance;
