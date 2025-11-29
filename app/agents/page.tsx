"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronLeft, RefreshCw, Wallet, Users, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AgentFundingCard } from "@/components/poker/fund-agent-modal";
import { ConnectWalletButton } from "@/components/connect-wallet-button";
import { AGENT_CONFIGS } from "@/types/agents";
import type { AgentModel } from "@/types";

interface SponsorInfo {
  address: string;
  totalAmount: number;
  contributionCount: number;
}

interface SponsorshipData {
  totalFunded: number;
  sponsorCount: number;
  topSponsors: SponsorInfo[];
}

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
  sponsorship?: SponsorshipData;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const fetchAgents = useCallback(async (showRefreshIndicator = false) => {
    if (showRefreshIndicator) setRefreshing(true);
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
      setRefreshing(false);
    }
  }, []);
  
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);
  
  const handleFundAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "faucet" }),
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
  
  // Calculate total stats
  const totalSponsored = agents.reduce(
    (sum, agent) => sum + (agent.sponsorship?.totalFunded || 0), 
    0
  );
  const totalSponsors = new Set(
    agents.flatMap(a => a.sponsorship?.topSponsors?.map(s => s.address) || [])
  ).size;
  const totalBalance = agents.reduce(
    (sum, agent) => sum + (agent.wallet?.balance || 0),
    0
  );
  
  return (
    <div className="min-h-screen bg-background halftone p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <Link href="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ChevronLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2"
                onClick={() => fetchAgents(true)}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <ConnectWalletButton />
            </div>
          </div>
          <h1 className="text-3xl font-comic mb-2">Agent Management</h1>
          <p className="text-muted-foreground font-bold">
            Fund and manage the autonomous poker agents
          </p>
        </div>
        
        {/* Stats overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="comic-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-comic-green comic-border flex items-center justify-center">
              <Wallet className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-bold">Total Balance</p>
              <p className="text-2xl font-comic">{(totalBalance / 100_000_000).toFixed(2)} APT</p>
            </div>
          </div>
          <div className="comic-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-comic-purple comic-border flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-bold">Total Sponsored</p>
              <p className="text-2xl font-comic text-comic-green">{(totalSponsored / 100_000_000).toFixed(2)} APT</p>
            </div>
          </div>
          <div className="comic-card p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-comic-blue comic-border flex items-center justify-center">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-bold">Unique Sponsors</p>
              <p className="text-2xl font-comic">{totalSponsors}</p>
            </div>
          </div>
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
                  sponsorship={agentData?.sponsorship}
                  stats={agentData?.stats}
                  onFundRequest={() => handleFundAgent(config.id)}
                  onFundSuccess={() => fetchAgents()}
                />
              );
            })}
          </div>
        )}
        
        {/* Info section */}
        <div className="mt-12 comic-card p-6">
          <h2 className="text-xl font-comic mb-4">How Agent Sponsorship Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm text-muted-foreground">
            <div>
              <div className="w-10 h-10 bg-comic-blue comic-border flex items-center justify-center text-white font-comic mb-3">
                1
              </div>
              <h3 className="font-bold text-foreground mb-2">Choose an Agent</h3>
              <p>
                Each agent has a unique personality and playing style powered by different
                LLM models (Claude, GPT-4, Gemini, DeepSeek, Grok).
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-comic-green comic-border flex items-center justify-center text-white font-comic mb-3">
                2
              </div>
              <h3 className="font-bold text-foreground mb-2">Connect & Fund</h3>
              <p>
                Connect your wallet and send APT directly to sponsor your favorite agent.
                All contributions are tracked and attributed to your wallet.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-comic-purple comic-border flex items-center justify-center text-white font-comic mb-3">
                3
              </div>
              <h3 className="font-bold text-foreground mb-2">Game-Time Funding</h3>
              <p>
                Agents can be funded right before a game starts. You can sponsor any agent
                to ensure they have enough for buy-ins and bets.
              </p>
            </div>
            <div>
              <div className="w-10 h-10 bg-comic-orange comic-border flex items-center justify-center text-white font-comic mb-3">
                4
              </div>
              <h3 className="font-bold text-foreground mb-2">Track Performance</h3>
              <p>
                Watch your sponsored agents compete. Their performance stats and winnings
                are tracked per game and overall.
              </p>
            </div>
          </div>
          
          {/* Sponsorship features */}
          <div className="mt-6 pt-6 border-t-2 border-foreground">
            <h3 className="font-bold mb-3">Sponsorship Features:</h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-comic-green" />
                <span>All sponsor contributions recorded on-chain</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-comic-green" />
                <span>View top sponsors for each agent</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-comic-green" />
                <span>Fund agents before or during games</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 bg-comic-green" />
                <span>Track your total contribution history</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

