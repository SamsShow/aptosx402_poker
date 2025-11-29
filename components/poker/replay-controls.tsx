"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Rewind,
  FastForward,
  History,
} from "lucide-react";
import type { GameState, ThoughtRecord } from "@/types";

interface ReplayState {
  handNumber: number;
  actionIndex: number;
  gameState: GameState;
  thought?: ThoughtRecord;
}

interface ReplayControlsProps {
  history: {
    handNumber: number;
    startState: GameState;
    actions: {
      playerId: string;
      action: string;
      amount: number;
      thought?: ThoughtRecord;
      timestamp: number;
    }[];
    endState: GameState;
  }[];
  onStateChange: (state: GameState, thought?: ThoughtRecord) => void;
  currentHand?: number;
}

export function ReplayControls({ 
  history, 
  onStateChange,
  currentHand = 1
}: ReplayControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [currentPosition, setCurrentPosition] = useState(0);
  
  // Calculate total actions across all hands
  const totalActions = history.reduce((sum, h) => sum + h.actions.length + 1, 0);
  
  // Convert position to hand/action index
  const getStateAtPosition = useCallback((position: number): ReplayState | null => {
    let remaining = position;
    
    for (const hand of history) {
      // Start state
      if (remaining === 0) {
        return {
          handNumber: hand.handNumber,
          actionIndex: -1,
          gameState: hand.startState,
        };
      }
      remaining--;
      
      // Actions
      for (let i = 0; i < hand.actions.length; i++) {
        if (remaining === 0) {
          // Reconstruct state after this action
          // In a real implementation, you'd apply each action to get the state
          return {
            handNumber: hand.handNumber,
            actionIndex: i,
            gameState: i === hand.actions.length - 1 ? hand.endState : hand.startState,
            thought: hand.actions[i].thought,
          };
        }
        remaining--;
      }
    }
    
    // End state
    if (history.length > 0) {
      const lastHand = history[history.length - 1];
      return {
        handNumber: lastHand.handNumber,
        actionIndex: lastHand.actions.length - 1,
        gameState: lastHand.endState,
      };
    }
    
    return null;
  }, [history]);
  
  // Update state when position changes
  useEffect(() => {
    const state = getStateAtPosition(currentPosition);
    if (state) {
      onStateChange(state.gameState, state.thought);
    }
  }, [currentPosition, getStateAtPosition, onStateChange]);
  
  // Playback timer
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentPosition((pos) => {
        if (pos >= totalActions - 1) {
          setIsPlaying(false);
          return pos;
        }
        return pos + 1;
      });
    }, 2000 / playbackSpeed);
    
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, totalActions]);
  
  const goToStart = () => {
    setCurrentPosition(0);
    setIsPlaying(false);
  };
  
  const goToEnd = () => {
    setCurrentPosition(totalActions - 1);
    setIsPlaying(false);
  };
  
  const stepBack = () => {
    setCurrentPosition((pos) => Math.max(0, pos - 1));
    setIsPlaying(false);
  };
  
  const stepForward = () => {
    setCurrentPosition((pos) => Math.min(totalActions - 1, pos + 1));
    setIsPlaying(false);
  };
  
  const togglePlay = () => {
    if (currentPosition >= totalActions - 1) {
      setCurrentPosition(0);
    }
    setIsPlaying(!isPlaying);
  };
  
  const currentState = getStateAtPosition(currentPosition);
  
  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center p-4 text-muted-foreground">
        <History className="h-4 w-4 mr-2" />
        No replay history available
      </div>
    );
  }
  
  return (
    <div className="p-4 bg-card rounded-lg border space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-x402" />
          <span className="font-medium">Replay</span>
        </div>
        <Badge variant="secondary">
          Hand {currentState?.handNumber || 1} / {history.length}
        </Badge>
      </div>
      
      {/* Progress slider */}
      <div className="space-y-2">
        <Slider
          value={[currentPosition]}
          max={totalActions - 1}
          step={1}
          onValueChange={(value) => {
            setCurrentPosition(value[0]);
            setIsPlaying(false);
          }}
          className="cursor-pointer"
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Start</span>
          <span>
            Action {currentState?.actionIndex !== undefined && currentState.actionIndex >= 0 
              ? currentState.actionIndex + 1 
              : 0}
          </span>
          <span>End</span>
        </div>
      </div>
      
      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="ghost" size="icon" onClick={goToStart}>
          <Rewind className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={stepBack}>
          <SkipBack className="h-4 w-4" />
        </Button>
        <Button 
          variant="default" 
          size="icon" 
          className="h-10 w-10"
          onClick={togglePlay}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5" />
          )}
        </Button>
        <Button variant="ghost" size="icon" onClick={stepForward}>
          <SkipForward className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={goToEnd}>
          <FastForward className="h-4 w-4" />
        </Button>
      </div>
      
      {/* Speed control */}
      <div className="flex items-center justify-center gap-2">
        <span className="text-xs text-muted-foreground">Speed:</span>
        {[0.5, 1, 2, 4].map((speed) => (
          <Button
            key={speed}
            variant={playbackSpeed === speed ? "secondary" : "ghost"}
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setPlaybackSpeed(speed)}
          >
            {speed}x
          </Button>
        ))}
      </div>
      
      {/* Current thought */}
      {currentState?.thought && (
        <motion.div
          className="p-3 bg-muted rounded-lg text-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium capitalize">
              {currentState.thought.agentId.replace("agent_", "")}:
            </span>
            <Badge variant="outline" className="text-xs capitalize">
              {currentState.thought.action}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            "{currentState.thought.thoughts}"
          </p>
        </motion.div>
      )}
    </div>
  );
}

