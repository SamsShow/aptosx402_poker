"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_CONFIGS } from "@/types/agents";
import type { AgentModel } from "@/types";
import { cn, formatAddress } from "@/lib/utils";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { 
  CheckCircle, 
  Wallet, 
  Coins,
  Loader2,
  Send,
  AlertCircle,
  AlertTriangle,
  Play,
  Users,
  Zap
} from "lucide-react";

interface AgentFundingStatus {
  agentId: string;
  name: string;
  model: AgentModel;
  color: string;
  walletAddress: string;
  balance: number; // in octas
  requiredBalance: number; // minimum for buy-in
  hasSufficientFunds: boolean;
}

interface PreGameFundingProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  buyIn: number; // Buy-in amount in chips (will be converted)
  onStartGame: () => void;
  gameId?: string;
}

// Minimum balance multiplier (agents need at least 2x buy-in for betting room)
const MIN_BALANCE_MULTIPLIER = 2;

export function PreGameFundingModal({
  open,
  onOpenChange,
  buyIn,
  onStartGame,
  gameId,
}: PreGameFundingProps) {
  const [agents, setAgents] = useState<AgentFundingStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [fundingAmount, setFundingAmount] = useState(0.5); // Default 0.5 APT
  const [transferring, setTransferring] = useState(false);
  const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [startingGame, setStartingGame] = useState(false);
  
  // Wallet connection
  const { connected, account, signAndSubmitTransaction } = useWallet();
  
  // Required balance in octas (buy-in chips * MIN_BALANCE_MULTIPLIER, assuming 1 chip = 0.0001 APT)
  const requiredBalanceOctas = buyIn * MIN_BALANCE_MULTIPLIER * 10_000; // Convert chips to octas

  // Fetch agent funding status
  useEffect(() => {
    if (!open) return;
    
    const fetchAgents = async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/agents");
        const data = await res.json();
        
        if (data.success) {
          const agentStatuses: AgentFundingStatus[] = data.agents.map((agent: any) => {
            const config = AGENT_CONFIGS[agent.model as AgentModel];
            const balance = agent.wallet?.balance || 0;
            return {
              agentId: agent.id,
              name: config?.name || agent.name,
              model: agent.model,
              color: config?.color || "#666",
              walletAddress: agent.wallet?.address || "",
              balance,
              requiredBalance: requiredBalanceOctas,
              hasSufficientFunds: balance >= requiredBalanceOctas,
            };
          });
          setAgents(agentStatuses);
        }
      } catch (error) {
        console.error("Failed to fetch agents:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAgents();
  }, [open, requiredBalanceOctas]);

  // Check if all agents have sufficient funds
  const allAgentsFunded = agents.every(a => a.hasSufficientFunds);
  const fundedCount = agents.filter(a => a.hasSufficientFunds).length;
  const totalAgents = agents.length;

  // Handle fund from faucet
  const handleFundFromFaucet = async (agentId: string) => {
    setTransferring(true);
    setTransferError(null);
    setTransferSuccess(null);
    
    try {
      const res = await fetch(`/api/agents/${agentId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          source: "faucet",
          gameId,
        }),
      });
      
      const data = await res.json();
      if (data.success) {
        setTransferSuccess(agentId);
        // Refresh agent status
        const updatedAgents = agents.map(a => 
          a.agentId === agentId 
            ? { ...a, balance: data.walletInfo.balance, hasSufficientFunds: data.walletInfo.balance >= requiredBalanceOctas }
            : a
        );
        setAgents(updatedAgents);
        
        setTimeout(() => setTransferSuccess(null), 2000);
      } else {
        // Check if it's a testnet faucet authentication issue
        const errorMsg = data.error || "Failed to fund agent";
        if (errorMsg.includes("authentication") || errorMsg.includes("testnet")) {
          setTransferError(
            "Testnet faucet requires login. Please use 'From Wallet' to fund, or visit aptos.dev/en/network/faucet manually."
          );
        } else {
          setTransferError(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to fund";
      if (errorMsg.includes("authentication") || errorMsg.includes("testnet")) {
        setTransferError(
          "Testnet faucet unavailable. Please connect wallet and use 'From Wallet' to fund agents."
        );
      } else {
        setTransferError(errorMsg);
      }
    } finally {
      setTransferring(false);
    }
  };

  // Handle wallet transfer
  const handleWalletTransfer = async (agentId: string, walletAddress: string) => {
    if (!connected || !account || !signAndSubmitTransaction) {
      setTransferError("Please connect your wallet first");
      return;
    }
    
    setTransferring(true);
    setTransferError(null);
    setTransferSuccess(null);
    
    try {
      const amountInOctas = Math.floor(fundingAmount * 100_000_000);
      
      // Submit transfer
      const response = await signAndSubmitTransaction({
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [walletAddress, amountInOctas],
        },
      });
      
      // Record sponsorship
      await fetch(`/api/agents/${agentId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountInOctas,
          sponsorAddress: account.address?.toString(),
          txHash: response.hash,
          gameId,
          source: "wallet",
        }),
      });
      
      setTransferSuccess(agentId);
      
      // Update agent balance locally
      const updatedAgents = agents.map(a => 
        a.agentId === agentId 
          ? { 
              ...a, 
              balance: a.balance + amountInOctas, 
              hasSufficientFunds: (a.balance + amountInOctas) >= requiredBalanceOctas 
            }
          : a
      );
      setAgents(updatedAgents);
      setSelectedAgent(null);
      
      setTimeout(() => setTransferSuccess(null), 2000);
    } catch (error) {
      setTransferError(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // Handle start game
  const handleStartGame = async () => {
    setStartingGame(true);
    try {
      await onStartGame();
      onOpenChange(false);
    } finally {
      setStartingGame(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-comic text-2xl">
            <Coins className="h-6 w-6 text-comic-yellow" />
            Agent Funding
          </DialogTitle>
          <DialogDescription>
            {gameId ? (
              <>
                Fund agents for <span className="font-mono font-bold">Game #{gameId.slice(-6).toUpperCase()}</span>.
                {" "}Anyone can sponsor agents before the game starts.
              </>
            ) : (
              "Ensure all agents have sufficient funds before starting the game."
            )}
          </DialogDescription>
        </DialogHeader>
        
        {/* Funding progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Funding Progress</span>
            <span className={cn(
              "font-bold",
              allAgentsFunded ? "text-comic-green" : "text-comic-orange"
            )}>
              {fundedCount}/{totalAgents} Agents Ready
            </span>
          </div>
          <Progress 
            value={(fundedCount / Math.max(totalAgents, 1)) * 100} 
            className="h-3"
          />
          <p className="text-xs text-muted-foreground">
            Each agent needs at least <span className="font-bold">{(requiredBalanceOctas / 100_000_000).toFixed(4)} APT</span> 
            {" "}(~{MIN_BALANCE_MULTIPLIER}x buy-in of {buyIn} chips)
          </p>
        </div>
        
        <Separator />
        
        {/* Agent list */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-comic-blue" />
          </div>
        ) : (
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-3">
              {agents.map((agent) => (
                <motion.div
                  key={agent.agentId}
                  className={cn(
                    "p-3 rounded-lg border-2 transition-all",
                    agent.hasSufficientFunds 
                      ? "border-comic-green bg-comic-green/5" 
                      : "border-comic-orange bg-comic-orange/5",
                    selectedAgent === agent.agentId && "ring-2 ring-comic-blue"
                  )}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar 
                        className="h-10 w-10 border-2"
                        style={{ borderColor: agent.color }}
                      >
                        <AvatarFallback 
                          style={{ backgroundColor: agent.color }}
                          className="text-white font-bold"
                        >
                          {agent.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{agent.name}</span>
                          {agent.hasSufficientFunds ? (
                            <Badge variant="outline" className="bg-comic-green/10 text-comic-green border-comic-green gap-1">
                              <CheckCircle className="h-3 w-3" />
                              Ready
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-comic-orange/10 text-comic-orange border-comic-orange gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Needs Funding
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {formatAddress(agent.walletAddress, 6)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={cn(
                        "font-bold",
                        agent.hasSufficientFunds ? "text-comic-green" : "text-comic-orange"
                      )}>
                        {(agent.balance / 100_000_000).toFixed(4)} APT
                      </div>
                      <div className="text-xs text-muted-foreground">
                        / {(agent.requiredBalance / 100_000_000).toFixed(4)} needed
                      </div>
                    </div>
                  </div>
                  
                  {/* Funding actions for underfunded agents */}
                  {!agent.hasSufficientFunds && (
                    <div className="mt-3 pt-3 border-t border-dashed">
                      {selectedAgent === agent.agentId ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">Amount:</span>
                            <span className="font-bold text-comic-green">{fundingAmount.toFixed(2)} APT</span>
                          </div>
                          <Slider
                            value={[fundingAmount]}
                            onValueChange={(v) => setFundingAmount(v[0])}
                            min={0.1}
                            max={2}
                            step={0.1}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedAgent(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              variant="poker"
                              className="flex-1 gap-1"
                              onClick={() => handleWalletTransfer(agent.agentId, agent.walletAddress)}
                              disabled={transferring || !connected}
                            >
                              {transferring ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Send className="h-3 w-3" />
                              )}
                              Send {fundingAmount.toFixed(2)} APT
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1 gap-1"
                            onClick={() => handleFundFromFaucet(agent.agentId)}
                            disabled={transferring}
                          >
                            {transferring && transferSuccess !== agent.agentId ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Zap className="h-3 w-3" />
                            )}
                            Faucet (1 APT)
                          </Button>
                          {connected && (
                            <Button
                              size="sm"
                              variant="poker"
                              className="flex-1 gap-1"
                              onClick={() => setSelectedAgent(agent.agentId)}
                            >
                              <Wallet className="h-3 w-3" />
                              From Wallet
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Success indicator */}
                  {transferSuccess === agent.agentId && (
                    <div className="mt-2 flex items-center gap-2 text-comic-green text-sm">
                      <CheckCircle className="h-4 w-4" />
                      Funded successfully!
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </ScrollArea>
        )}
        
        {/* Error message */}
        {transferError && (
          <div className="p-3 bg-comic-red/10 rounded-lg text-sm text-comic-red space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-bold">Funding Failed</p>
                <p className="text-xs mt-1">{transferError}</p>
              </div>
            </div>
            {(transferError.includes("faucet") || transferError.includes("Testnet")) && (
              <div className="text-xs text-muted-foreground pl-6 space-y-1">
                <p className="font-bold text-foreground">Alternative Options:</p>
                <div className="space-y-1">
                  <p>1. Use <strong>"From Wallet"</strong> button to transfer from your connected wallet</p>
                  <p>2. Visit <a 
                    href="https://aptos.dev/en/network/faucet" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-comic-blue hover:underline font-bold"
                  >
                    manual faucet (requires login)
                  </a></p>
                  <p className="text-muted-foreground mt-2">
                    Note: Testnet faucet requires manual authentication. Devnet supports programmatic funding.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
        
        <Separator />
        
        {/* Actions */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {!connected && (
              <span className="flex items-center gap-1 text-comic-orange">
                <Wallet className="h-4 w-4" />
                Connect wallet to sponsor from your balance
              </span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {!allAgentsFunded && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={handleStartGame}
                disabled={startingGame}
              >
                {gameId ? "Join Anyway" : "Skip & Start Anyway"}
              </Button>
            )}
            <Button
              variant="call"
              className="gap-2"
              onClick={handleStartGame}
              disabled={startingGame}
            >
              {startingGame ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {gameId 
                ? (allAgentsFunded ? "Join Game" : `Fund ${totalAgents - fundedCount} More & Join`)
                : (allAgentsFunded ? "Start Game" : `Fund ${totalAgents - fundedCount} More`)
              }
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

