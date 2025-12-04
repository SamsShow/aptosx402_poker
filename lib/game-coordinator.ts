/**
 * Game Coordinator
 * 
 * Manages game state, action processing, and event broadcasting
 * Acts as the central authority for game logic
 * 
 * Now integrates with x402 protocol for real APT transactions
 */

import type { GameState, ThoughtRecord, TransactionRecord, ActionType } from "@/types";
import { processAction, startHand, prepareNextHand } from "@/lib/poker/engine";
import { generateRandomSeed } from "@/lib/poker/deck";
import { chipsToOctas } from "@/lib/poker/constants";
import { evaluateHand, determineWinners } from "@/lib/poker/evaluator";
import { generateGameId } from "@/lib/utils";
import { saveGame, saveHand, saveAction, saveThought, saveTransaction } from "@/lib/db/game-db";
import { walletManager } from "@/lib/wallet-manager";
import { gameWalletManager } from "@/lib/game-wallet-manager";
import { transfer, getExplorerUrl, createAccountFromPrivateKey } from "@/lib/x402";

interface GameSession {
  state: GameState;
  thoughts: ThoughtRecord[];
  transactions: TransactionRecord[];
  history: HandHistory[];
  listeners: Set<(event: GameEvent) => void>;
}

interface HandHistory {
  handNumber: number;
  startState: GameState;
  actions: {
    playerId: string;
    action: ActionType;
    amount: number;
    thought?: ThoughtRecord;
    timestamp: number;
  }[];
  endState: GameState;
  winners: string[];
}

interface GameEvent {
  type: string;
  gameId: string;
  payload: unknown;
  timestamp: number;
}

interface ActionResult {
  success: boolean;
  newState?: GameState;
  txHash?: string;
  error?: string;
}

class GameCoordinator {
  private games: Map<string, GameSession> = new Map();
  private globalListeners: Set<(event: GameEvent) => void> = new Set();
  private gameConfigs: Map<string, { buyIn: number; smallBlind: number; bigBlind: number }> = new Map();

  /**
   * Register a new game
   */
  async registerGame(
    state: GameState,
    buyIn = 1000,
    smallBlind = 5,
    bigBlind = 10,
    creatorAddress?: string
  ): Promise<void> {
    // Add creatorAddress to state if provided
    if (creatorAddress) {
      state.creatorAddress = creatorAddress;
    }

    this.games.set(state.gameId, {
      state,
      thoughts: [],
      transactions: [],
      history: [],
      listeners: new Set(),
    });

    // Store game config
    this.gameConfigs.set(state.gameId, { buyIn, smallBlind, bigBlind });

    // Save to database
    try {
      await saveGame(state, buyIn, smallBlind, bigBlind, creatorAddress);
      console.log(`[Coordinator] Game ${state.gameId} saved to database`);
    } catch (error) {
      console.error("[Coordinator] Failed to save game to DB:", error);
      // Continue anyway - DB is not critical for game flow
      // But log the error so we know if there's a DB issue
      if (error instanceof Error) {
        console.error("[Coordinator] DB Error details:", error.message);
      }
    }

    this.broadcast({
      type: "game_created",
      gameId: state.gameId,
      payload: state,
      timestamp: Date.now(),
    });
  }

  /**
   * Get game state
   */
  getGame(gameId: string): GameState | null {
    return this.games.get(gameId)?.state || null;
  }

  /**
   * Get all active games (excludes settled games)
   */
  getActiveGames(): GameState[] {
    return Array.from(this.games.values())
      .map((session) => session.state)
      .filter((state) => state.stage !== "settled");
  }

  /**
   * Get all games (including settled ones)
   */
  getAllGames(): GameState[] {
    return Array.from(this.games.values())
      .map((session) => session.state);
  }

  /**
   * Get thoughts for a game
   */
  getThoughts(gameId: string): ThoughtRecord[] {
    return this.games.get(gameId)?.thoughts || [];
  }

  /**
   * Get transactions for a game
   */
  getTransactions(gameId: string): TransactionRecord[] {
    return this.games.get(gameId)?.transactions || [];
  }

  /**
   * Get hand history
   */
  getHistory(gameId: string, handNumber?: number): HandHistory[] | HandHistory | null {
    const session = this.games.get(gameId);
    if (!session) return null;

    if (handNumber !== undefined) {
      return session.history.find((h) => h.handNumber === handNumber) || null;
    }

    return session.history;
  }

  /**
   * Start a new hand
   */
  async startHand(gameId: string, seed?: string): Promise<ActionResult> {
    const session = this.games.get(gameId);
    if (!session) {
      return { success: false, error: "Game not found" };
    }

    try {
      // Generate seed if not provided
      const handSeed = seed || generateRandomSeed();

      // If current hand is settled, prepare for next hand
      if (session.state.stage === "settled" || session.state.stage === "waiting") {
        if (session.state.stage === "settled") {
          session.state = prepareNextHand(session.state);
        }

        // Start new hand
        const newState = startHand(session.state, handSeed);

        // Save start state for history
        const handHistory: HandHistory = {
          handNumber: newState.handNumber,
          startState: { ...newState },
          actions: [],
          endState: newState,
          winners: [],
        };
        session.history.push(handHistory);

        // Save hand to database
        try {
          await saveHand(gameId, newState.handNumber, newState, newState, newState.pot);
        } catch (error) {
          console.error("[Coordinator] Failed to save hand to DB:", error);
        }

        // Update game in database
        try {
          const config = this.gameConfigs.get(gameId) || { buyIn: 1000, smallBlind: 5, bigBlind: 10 };
          await saveGame(newState, config.buyIn, config.smallBlind, config.bigBlind);
        } catch (error) {
          console.error("[Coordinator] Failed to update game in DB:", error);
        }

        session.state = newState;

        this.broadcast({
          type: "game_started",
          gameId,
          payload: newState,
          timestamp: Date.now(),
        });

        return { success: true, newState };
      }

      return { success: false, error: "Game already in progress" };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to start hand"
      };
    }
  }

  /**
   * Process a player action
   */
  async processAction(
    gameId: string,
    playerId: string,
    action: ActionType,
    amount: number,
    thought?: ThoughtRecord,
    _facilitatorReceipt?: string
  ): Promise<ActionResult> {
    const session = this.games.get(gameId);
    if (!session) {
      return { success: false, error: "Game not found" };
    }

    try {
      // Process the action
      const newState = processAction(session.state, playerId, action, amount);

      // Record thought
      let actionId: string | undefined;
      if (thought) {
        session.thoughts.unshift(thought);

        // Save thought to database
        try {
          await saveThought(thought, actionId);
        } catch (error) {
          console.error("[Coordinator] Failed to save thought to DB:", error);
        }

        this.broadcast({
          type: "thought_broadcast",
          gameId,
          payload: thought,
          timestamp: Date.now(),
        });
      }

      // Record transaction if there was a bet
      // Note: Actual APT transfers happen at settlement, not during betting
      // This avoids excessive gas costs and maintains game flow
      if (amount > 0 && action !== "fold") {
        const tx: TransactionRecord = {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          gameId,
          from: playerId,
          to: "pot",
          amount,
          amountOctas: chipsToOctas(amount), // Track real APT value
          type: "bet",
          txHash: `pending_settlement`, // Will be updated at hand settlement
          timestamp: Date.now(),
          status: "pending", // Pending until hand settles
        };
        session.transactions.unshift(tx);

        // Save transaction to database
        try {
          await saveTransaction(tx);
        } catch (error) {
          console.error("[Coordinator] Failed to save transaction to DB:", error);
        }

        this.broadcast({
          type: "transaction_recorded",
          gameId,
          payload: tx,
          timestamp: Date.now(),
        });
      }

      // Update history
      const currentHistory = session.history[session.history.length - 1];
      if (currentHistory) {
        // Save action to database
        try {
          const handId = `hand_${gameId}_${currentHistory.handNumber}`;
          actionId = await saveAction(
            handId,
            playerId,
            action,
            amount,
            thought?.stateHash || null,
            currentHistory.actions.length
          );

          // Update thought with actionId if we have one
          if (thought && actionId) {
            await saveThought(thought, actionId);
          }
        } catch (error) {
          console.error("[Coordinator] Failed to save action to DB:", error);
        }

        currentHistory.actions.push({
          playerId,
          action,
          amount,
          thought,
          timestamp: Date.now(),
        });
        currentHistory.endState = newState;
      }

      // Update game state in database
      try {
        const config = this.gameConfigs.get(gameId) || { buyIn: 1000, smallBlind: 5, bigBlind: 10 };
        await saveGame(newState, config.buyIn, config.smallBlind, config.bigBlind);
      } catch (error) {
        console.error("[Coordinator] Failed to update game in DB:", error);
      }

      // Update state
      session.state = newState;

      // Broadcast action
      this.broadcast({
        type: "action_taken",
        gameId,
        payload: {
          playerId,
          action,
          amount,
          newState,
        },
        timestamp: Date.now(),
      });

      // Check for stage change
      if (newState.stage !== session.state.stage) {
        this.broadcast({
          type: "stage_changed",
          gameId,
          payload: {
            stage: newState.stage,
            communityCards: newState.communityCards,
            pot: newState.pot,
          },
          timestamp: Date.now(),
        });
      }

      // Check for game end
      if (newState.stage === "settled" || newState.stage === "showdown") {
        // Properly determine winners by evaluating hands
        let winners: string[];
        
        if (newState.stage === "showdown") {
          // Evaluate hands for non-folded players
          const contenders = newState.players
            .filter((p) => !p.folded)
            .map((p) => ({
              id: p.id,
              hand: evaluateHand(p.cards, newState.communityCards),
            }));
          
          const winnerHands = determineWinners(contenders);
          winners = winnerHands.map((w) => w.id);
        } else {
          // Stage is "settled" - winners already determined by engine
          // First try: Check which players gained chips (they won)
          let playersWhoGainedChips: string[] = [];
          if (currentHistory) {
            playersWhoGainedChips = newState.players
              .filter((p) => {
                const startPlayer = currentHistory.startState.players.find(sp => sp.id === p.id);
                if (!startPlayer) return false;
                const chipIncrease = p.stack - startPlayer.stack;
                console.log(`[Coordinator] Player ${p.id}: start=${startPlayer.stack}, end=${p.stack}, increase=${chipIncrease}`);
                return chipIncrease > 0;
              })
              .map((p) => p.id);
          }
          
          if (playersWhoGainedChips.length > 0) {
            winners = playersWhoGainedChips;
            console.log(`[Coordinator] Found winners by chip increase: ${winners.join(', ')}`);
          } else {
            // Fallback: all non-folded players (they won by default if everyone else folded)
            winners = newState.players
              .filter((p) => !p.folded)
              .map((p) => p.id);
            console.log(`[Coordinator] Using non-folded players as winners: ${winners.join(', ')}`);
          }
          
          // If still no winners, check if pot was distributed (someone must have won)
          if (winners.length === 0 && newState.pot === 0) {
            // Pot is 0, so it was distributed - find who has the most chips increase
            // This handles edge cases where chip comparison fails
            const nonFolded = newState.players.filter((p) => !p.folded);
            if (nonFolded.length > 0) {
              winners = nonFolded.map((p) => p.id);
              console.log(`[Coordinator] Pot was 0, using non-folded players: ${winners.join(', ')}`);
            }
          }
        }

        // Ensure we always have at least one winner
        if (winners.length === 0) {
          console.warn(`[Coordinator] No winners determined! Using fallback: all non-folded players`);
          winners = newState.players
            .filter((p) => !p.folded)
            .map((p) => p.id);
          
          // If still no winners (everyone folded - shouldn't happen), use last player who acted
          if (winners.length === 0 && currentHistory && currentHistory.actions.length > 0) {
            const lastAction = currentHistory.actions[currentHistory.actions.length - 1];
            winners = [lastAction.playerId];
            console.warn(`[Coordinator] Using last action player as winner: ${lastAction.playerId}`);
          }
        }

        console.log(`[Coordinator] Determined winners: ${winners.join(', ') || 'NONE'} (stage: ${newState.stage}, pot: ${newState.pot})`);

        if (currentHistory && winners.length > 0) {
          currentHistory.winners = winners;
          currentHistory.endState = newState;

          // Execute real APT transfers for pot distribution via x402
          await this.settleHandWithX402(gameId, currentHistory, newState, winners);

          // Update hand in database with final state
          try {
            const handId = `hand_${gameId}_${currentHistory.handNumber}`;
            await saveHand(
              gameId,
              currentHistory.handNumber,
              currentHistory.startState,
              newState,
              newState.pot,
              winners[0] // First winner
            );
          } catch (error) {
            console.error("[Coordinator] Failed to update hand in DB:", error);
          }
        }

        this.broadcast({
          type: "winner_declared",
          gameId,
          payload: {
            winners,
            pot: session.state.pot,
          },
          timestamp: Date.now(),
        });
      }

      return { success: true, newState };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to process action"
      };
    }
  }

  /**
   * Settle a hand with real APT transfers via x402 protocol
   * 
   * This executes actual on-chain transfers from losers to winners.
   * The pot amount is distributed proportionally to winners.
   */
  private async settleHandWithX402(
    gameId: string,
    history: HandHistory,
    finalState: GameState,
    winnerIds: string[]
  ): Promise<void> {
    const session = this.games.get(gameId);
    if (!session) return;

    // Ensure wallet manager is initialized
    if (!walletManager.isInitialized()) {
      await walletManager.initialize();
    }

    // Calculate total pot and distribution
    // The pot represents chips; we need to convert to octas for real transfers
    const potChips = history.startState.pot +
      history.actions.reduce((sum, a) => sum + (a.amount || 0), 0);
    const potOctas = chipsToOctas(potChips);

    if (potOctas === 0 || winnerIds.length === 0) {
      console.log("[Coordinator] No pot to distribute or no winners");
      return;
    }

    // Calculate winnings per winner
    const winningsPerWinner = Math.floor(potOctas / winnerIds.length);

    // Get losers (players who contributed to pot but didn't win)
    const losers = history.actions
      .filter(a => a.amount > 0 && !winnerIds.includes(a.playerId))
      .map(a => ({ playerId: a.playerId, amount: chipsToOctas(a.amount) }));

    // For now, we'll track the transfers but may not execute all of them
    // to avoid excessive gas costs. Instead, we record them for transparency.
    // In a production system, you might use a smart contract escrow.

    console.log(`[Coordinator] Settling hand - Pot: ${potOctas} octas, Winners: ${winnerIds.join(', ')}`);
    console.log(`[Coordinator] Found ${losers.length} losers: ${losers.map(l => `${l.playerId} (${l.amount} octas)`).join(', ')}`);

    if (losers.length === 0) {
      console.log(`[Coordinator] No losers found - all winners or no bets. Skipping settlement transfers.`);
      return;
    }

    // Check if game has per-game wallets
    const gameWallets = await gameWalletManager.getGameWalletInfos(gameId).catch(() => []);
    const hasGameWallets = gameWallets.length > 0;

    console.log(`[Coordinator] Using ${hasGameWallets ? 'per-game' : 'global'} wallets for settlement`);

    // Execute transfers from each loser to winners (proportionally)
    for (const loser of losers) {
      // Try to get per-game wallet first, fall back to global wallet
      let loserWallet;
      if (hasGameWallets) {
        loserWallet = await gameWalletManager.getWallet(gameId, loser.playerId);
      }
      if (!loserWallet) {
        loserWallet = walletManager.getWallet(loser.playerId);
      }

      if (!loserWallet) {
        console.warn(`[Coordinator] No wallet found for loser ${loser.playerId}`);
        continue;
      }

      // Each loser transfers their bet amount to winners proportionally
      const amountPerWinner = Math.floor(loser.amount / winnerIds.length);
      if (amountPerWinner === 0) continue;

      for (const winnerId of winnerIds) {
        const winnerAddress = finalState.players.find(p => p.id === winnerId)?.address;
        if (!winnerAddress) continue;

        try {
          // Execute actual APT transfer via x402
          const receipt = await transfer(loserWallet, winnerAddress, amountPerWinner);

          console.log(`[Coordinator] x402 Transfer: ${loser.playerId} -> ${winnerId}: ${amountPerWinner} octas (tx: ${receipt.txHash})`);

          // Record the settlement transaction
          const settlementTx: TransactionRecord = {
            id: `settle_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            gameId,
            from: loser.playerId,
            to: winnerId,
            amount: amountPerWinner,
            amountOctas: amountPerWinner,
            type: "settlement",
            txHash: receipt.txHash,
            explorerUrl: getExplorerUrl(receipt.txHash),
            timestamp: Date.now(),
            status: "confirmed",
          };

          session.transactions.unshift(settlementTx);

          // Save to database
          try {
            await saveTransaction(settlementTx);
          } catch (error) {
            console.error("[Coordinator] Failed to save settlement tx to DB:", error);
          }

          // Broadcast the settlement
          this.broadcast({
            type: "x402_transfer_complete",
            gameId,
            payload: {
              from: loser.playerId,
              to: winnerId,
              amount: amountPerWinner,
              txHash: receipt.txHash,
              explorerUrl: getExplorerUrl(receipt.txHash),
            },
            timestamp: Date.now(),
          });

        } catch (error) {
          console.error(`[Coordinator] x402 transfer failed: ${loser.playerId} -> ${winnerId}:`, error);

          // Record failed transfer
          const failedTx: TransactionRecord = {
            id: `settle_failed_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            gameId,
            from: loser.playerId,
            to: winnerId,
            amount: amountPerWinner,
            amountOctas: amountPerWinner,
            type: "settlement",
            txHash: "",
            timestamp: Date.now(),
            status: "failed",
            error: error instanceof Error ? error.message : "Transfer failed",
          };

          session.transactions.unshift(failedTx);
        }
      }
    }

    console.log(`[Coordinator] Hand settlement complete for game ${gameId}`);
  }

  /**
   * End a game
   */
  endGame(gameId: string): void {
    const session = this.games.get(gameId);
    if (session) {
      this.broadcast({
        type: "game_ended",
        gameId,
        payload: { finalState: session.state },
        timestamp: Date.now(),
      });

      this.games.delete(gameId);
    }
  }

  /**
   * Subscribe to game events
   */
  subscribe(gameId: string, listener: (event: GameEvent) => void): () => void {
    const session = this.games.get(gameId);
    if (session) {
      session.listeners.add(listener);
      return () => session.listeners.delete(listener);
    }
    return () => { };
  }

  /**
   * Subscribe to all events
   */
  subscribeAll(listener: (event: GameEvent) => void): () => void {
    this.globalListeners.add(listener);
    return () => this.globalListeners.delete(listener);
  }

  /**
   * Broadcast an event
   */
  private broadcast(event: GameEvent): void {
    // Notify game-specific listeners
    const session = this.games.get(event.gameId);
    if (session) {
      session.listeners.forEach((listener) => {
        try {
          listener(event);
        } catch (error) {
          console.error("[Coordinator] Listener error:", error);
        }
      });
    }

    // Notify global listeners
    this.globalListeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error("[Coordinator] Global listener error:", error);
      }
    });
  }
}

// Use global to persist across Next.js hot reloads and API routes
declare global {
  // eslint-disable-next-line no-var
  var gameCoordinatorInstance: GameCoordinator | undefined;
}

// Singleton instance - use globalThis to persist across API routes
if (!globalThis.gameCoordinatorInstance) {
  globalThis.gameCoordinatorInstance = new GameCoordinator();
}

export const gameCoordinator = globalThis.gameCoordinatorInstance;

