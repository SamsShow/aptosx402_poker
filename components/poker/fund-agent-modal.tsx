"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { AGENT_CONFIGS } from "@/types/agents";
import type { AgentModel } from "@/types";
import { cn, formatAddress } from "@/lib/utils";
import { 
  Copy, 
  CheckCircle, 
  Wallet, 
  ExternalLink,
  Coins,
  Loader2
} from "lucide-react";

interface FundAgentModalProps {
  agentId: string;
  walletAddress?: string;
  balance?: number;
  onFundRequest?: () => Promise<void>;
}

export function FundAgentModal({ 
  agentId, 
  walletAddress,
  balance = 0,
  onFundRequest 
}: FundAgentModalProps) {
  const [copied, setCopied] = useState(false);
  const [funding, setFunding] = useState(false);
  const [open, setOpen] = useState(false);
  
  const model = agentId.replace("agent_", "") as AgentModel;
  const config = AGENT_CONFIGS[model];
  
  const copyAddress = async () => {
    if (walletAddress) {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };
  
  const handleFundFromFaucet = async () => {
    if (!onFundRequest) return;
    
    setFunding(true);
    try {
      await onFundRequest();
    } catch (error) {
      console.error("Failed to fund:", error);
    } finally {
      setFunding(false);
    }
  };
  
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2">
          <Wallet className="h-4 w-4" />
          Fund
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar 
              className="h-10 w-10 border-2"
              style={{ borderColor: config?.color || "#666" }}
            >
              <AvatarImage src={config?.avatar} alt={config?.name} />
              <AvatarFallback 
                style={{ backgroundColor: config?.color || "#666" }}
                className="text-white font-bold"
              >
                {config?.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              Fund {config?.name}
              <p className="text-sm font-normal text-muted-foreground">
                Sponsor this agent with APT
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Current balance */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="text-sm text-muted-foreground">Current Balance</span>
            <span className="font-bold text-lg">
              {(balance / 100_000_000).toFixed(4)} APT
            </span>
          </div>
          
          <Separator />
          
          {/* Wallet address */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Wallet Address</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-xs font-mono break-all">
                {walletAddress || "Loading..."}
              </code>
              <Button
                variant="outline"
                size="icon"
                onClick={copyAddress}
                disabled={!walletAddress}
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Send APT to this address to fund the agent
            </p>
          </div>
          
          <Separator />
          
          {/* Testnet faucet */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Testnet Faucet</label>
            <p className="text-xs text-muted-foreground mb-2">
              Get free testnet APT for development
            </p>
            <Button
              className="w-full gap-2"
              onClick={handleFundFromFaucet}
              disabled={funding || !walletAddress}
            >
              {funding ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Coins className="h-4 w-4" />
              )}
              {funding ? "Funding..." : "Fund from Faucet (1 APT)"}
            </Button>
          </div>
          
          {/* Explorer link */}
          {walletAddress && (
            <a
              href={`https://explorer.aptoslabs.com/account/${walletAddress}?network=testnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 text-sm text-x402 hover:underline"
            >
              View on Explorer
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Agent card with funding option
interface AgentFundingCardProps {
  agentId: string;
  walletAddress?: string;
  balance?: number;
  stats?: {
    totalHands: number;
    wins: number;
    winRate: number;
  };
  onFundRequest?: () => Promise<void>;
}

export function AgentFundingCard({
  agentId,
  walletAddress,
  balance = 0,
  stats,
  onFundRequest,
}: AgentFundingCardProps) {
  const model = agentId.replace("agent_", "") as AgentModel;
  const config = AGENT_CONFIGS[model];
  
  return (
    <motion.div
      className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Avatar 
            className="h-12 w-12 border-2"
            style={{ borderColor: config?.color || "#666" }}
          >
            <AvatarImage src={config?.avatar} alt={config?.name} />
            <AvatarFallback 
              style={{ backgroundColor: config?.color || "#666" }}
              className="text-white font-bold"
            >
              {config?.name?.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          
          <div>
            <h3 className="font-semibold">{config?.name}</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
              {walletAddress ? formatAddress(walletAddress, 6) : "No wallet"}
            </p>
          </div>
        </div>
        
        <FundAgentModal
          agentId={agentId}
          walletAddress={walletAddress}
          balance={balance}
          onFundRequest={onFundRequest}
        />
      </div>
      
      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="p-2 bg-muted rounded">
          <div className="text-lg font-bold">
            {(balance / 100_000_000).toFixed(2)}
          </div>
          <div className="text-xs text-muted-foreground">APT</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className="text-lg font-bold">{stats?.totalHands || 0}</div>
          <div className="text-xs text-muted-foreground">Hands</div>
        </div>
        <div className="p-2 bg-muted rounded">
          <div className={cn(
            "text-lg font-bold",
            (stats?.winRate || 0) > 0.5 ? "text-green-400" : "text-yellow-400"
          )}>
            {Math.round((stats?.winRate || 0) * 100)}%
          </div>
          <div className="text-xs text-muted-foreground">Win Rate</div>
        </div>
      </div>
      
      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
        {config?.personality}
      </p>
    </motion.div>
  );
}

