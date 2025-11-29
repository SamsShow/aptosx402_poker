/**
 * Game Coordinator
 * 
 * Manages game state, action processing, and event broadcasting
 * Acts as the central authority for game logic
 */

import type { GameState, ThoughtRecord, TransactionRecord, ActionType } from "@/types";
import { processAction, startHand, prepareNextHand } from "@/lib/poker/engine";
import { generateRandomSeed } from "@/lib/poker/deck";
import { generateGameId } from "@/lib/utils";
import { saveGame, saveHand, saveAction, saveThought, saveTransaction } from "@/lib/db/game-db";

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
  async registerGame(state: GameState, buyIn = 1000, smallBlind = 5, bigBlind = 10): Promise<void> {
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
      await saveGame(state, buyIn, smallBlind, bigBlind);
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
   * Get all active games
   */
  getActiveGames(): GameState[] {
    return Array.from(this.games.values())
      .map((session) => session.state)
      .filter((state) => state.stage !== "settled");
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
      if (amount > 0 && action !== "fold") {
        const tx: TransactionRecord = {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          gameId,
          from: playerId,
          to: "pot",
          amount,
          type: "bet",
          txHash: `0x${Date.now().toString(16)}`, // Mock hash
          timestamp: Date.now(),
          status: "confirmed",
        };
        session.transactions.unshift(tx);
        
        // Save transaction to database
        try {
          await saveTransaction(tx);
        } catch (error) {
          console.error("[Coordinator] Failed to save transaction to DB:", error);
        }
        
        this.broadcast({
          type: "transaction_confirmed",
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
        const winners = newState.players
          .filter((p) => !p.folded)
          .map((p) => p.id);
        
        if (currentHistory) {
          currentHistory.winners = winners;
          currentHistory.endState = newState;
          
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
    return () => {};
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

