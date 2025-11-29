"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentFundingCard } from "@/components/poker/fund-agent-modal";
import { AGENT_CONFIGS } from "@/types/agents";
import type { AgentModel } from "@/types";

interface AgentData {
  id: string;
  model: AgentModel;
  wallet?: {
    address: string;
    balance: number;
  };
  stats?: {
    totalHands: number;
    wins: number;
    winRate: number;
  };
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchAgents();
  }, []);
  
  const fetchAgents = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents);
      }
    } catch (error) {
      console.error("Failed to fetch agents:", error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFundAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/fund`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        // Refresh agent data
        fetchAgents();
      }
    } catch (error) {
      console.error("Failed to fund agent:", error);
    }
  };
  
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/" className="inline-block mb-4">
            <Button variant="ghost" size="sm" className="gap-2">
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <h1 className="text-3xl font-bold mb-2">Agent Management</h1>
          <p className="text-muted-foreground">
            Fund and manage the autonomous poker agents
          </p>
        </div>
        
        {/* Agent grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5].map((i) => (
              <div 
                key={i} 
                className="h-48 bg-card animate-pulse rounded-lg border"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Object.values(AGENT_CONFIGS).map((config) => {
              const agentData = agents.find((a) => a.id === config.id);
              return (
                <AgentFundingCard
                  key={config.id}
                  agentId={config.id}
                  walletAddress={agentData?.wallet?.address}
                  balance={agentData?.wallet?.balance || 0}
                  stats={agentData?.stats}
                  onFundRequest={() => handleFundAgent(config.id)}
                />
              );
            })}
          </div>
        )}
        
        {/* Info section */}
        <div className="mt-12 p-6 bg-card rounded-lg border">
          <h2 className="text-xl font-semibold mb-4">How Funding Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-muted-foreground">
            <div>
              <h3 className="font-medium text-foreground mb-2">1. Choose an Agent</h3>
              <p>
                Each agent has a unique personality and playing style powered by different
                LLM models.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">2. Fund the Wallet</h3>
              <p>
                Send APT to the agent's wallet address or use the testnet faucet for
                development.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-foreground mb-2">3. Watch Them Play</h3>
              <p>
                Agents use their funds for buy-ins and bets. Winnings go back to their
                wallets.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

