/**
 * Game Loop
 * 
 * Runs the autonomous poker game with agent turns
 */

import type { GameState, ThoughtRecord } from "@/types";
import { gameCoordinator } from "@/lib/game-coordinator";
import { agentManager } from "./agent-manager";
import { sleep } from "@/lib/utils";

interface GameLoopOptions {
  gameId: string;
  turnDelay?: number; // ms between turns
  handDelay?: number; // ms between hands
  maxHands?: number;
  onThought?: (thought: ThoughtRecord) => void;
  onStateChange?: (state: GameState) => void;
  onError?: (error: Error) => void;
}

class GameLoop {
  private isRunning = false;
  private shouldStop = false;
  private currentGameId: string | null = null;
  
  /**
   * Start the game loop
   */
  async start(options: GameLoopOptions): Promise<void> {
    if (this.isRunning) {
      throw new Error("Game loop already running");
    }
    
    const {
      gameId,
      turnDelay = 2000,
      handDelay = 5000,
      maxHands = 100,
      onThought,
      onStateChange,
      onError,
    } = options;
    
    this.isRunning = true;
    this.shouldStop = false;
    this.currentGameId = gameId;
    
    console.log(`[GameLoop] Starting game loop for ${gameId}`);
    
    try {
      let handCount = 0;
      
      while (!this.shouldStop && handCount < maxHands) {
        // Start a new hand
        const startResult = await gameCoordinator.startHand(gameId);
        if (!startResult.success) {
          console.error("[GameLoop] Failed to start hand:", startResult.error);
          break;
        }
        
        handCount++;
        console.log(`[GameLoop] Starting hand ${handCount}`);
        
        let gameState = startResult.newState!;
        onStateChange?.(gameState);
        
        // Play the hand
        while (!this.shouldStop && gameState.stage !== "settled") {
          // Get current player
          const currentPlayer = gameState.players[gameState.currentPlayerIndex];
          
          if (!currentPlayer || currentPlayer.folded || currentPlayer.isAllIn) {
            // Should not happen, but advance if it does
            await sleep(100);
            gameState = gameCoordinator.getGame(gameId)!;
            continue;
          }
          
          console.log(`[GameLoop] ${currentPlayer.name}'s turn`);
          
          try {
            // Get agent decision
            const thought = await agentManager.requestDecision(
              currentPlayer.id,
              gameState
            );
            
            onThought?.(thought);
            
            // Add delay for spectator experience
            await sleep(turnDelay);
            
            // Process the action
            const actionResult = await gameCoordinator.processAction(
              gameId,
              currentPlayer.id,
              thought.action,
              thought.amount,
              thought
            );
            
            if (actionResult.success && actionResult.newState) {
              gameState = actionResult.newState;
              onStateChange?.(gameState);
            } else {
              console.error("[GameLoop] Action failed:", actionResult.error);
              // If action fails, try to continue
            }
          } catch (error) {
            console.error("[GameLoop] Error getting agent decision:", error);
            onError?.(error instanceof Error ? error : new Error(String(error)));
            
            // Default to fold on error
            await gameCoordinator.processAction(
              gameId,
              currentPlayer.id,
              "fold",
              0
            );
          }
          
          // Update state
          gameState = gameCoordinator.getGame(gameId)!;
        }
        
        // Record results
        const winners = gameState.players.filter((p) => !p.folded);
        for (const player of gameState.players) {
          const won = winners.some((w) => w.id === player.id);
          agentManager.recordResult(player.id, won);
        }
        
        console.log(`[GameLoop] Hand ${handCount} complete. Winners: ${winners.map(w => w.name).join(", ")}`);
        
        // Delay between hands
        if (!this.shouldStop && handCount < maxHands) {
          await sleep(handDelay);
        }
      }
      
      console.log(`[GameLoop] Game loop ended after ${handCount} hands`);
    } catch (error) {
      console.error("[GameLoop] Fatal error:", error);
      onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isRunning = false;
      this.currentGameId = null;
    }
  }
  
  /**
   * Stop the game loop
   */
  stop(): void {
    console.log("[GameLoop] Stopping game loop");
    this.shouldStop = true;
  }
  
  /**
   * Check if the game loop is running
   */
  isActive(): boolean {
    return this.isRunning;
  }
  
  /**
   * Get current game ID
   */
  getCurrentGameId(): string | null {
    return this.currentGameId;
  }
}

// Singleton instance
export const gameLoop = new GameLoop();

