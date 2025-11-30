"use client";

import { useState, useEffect } from "react";
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
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AGENT_CONFIGS } from "@/types/agents";
import type { AgentModel } from "@/types";
import { cn, formatAddress } from "@/lib/utils";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import {
  Copy,
  CheckCircle,
  Wallet,
  ExternalLink,
  Coins,
  Loader2,
  Send,
  AlertCircle,
  Users,
  TrendingUp
} from "lucide-react";
import { getExplorerUrl } from "@/lib/aptos-client";

interface Sponsor {
  address: string;
  totalAmount: number;
  contributionCount: number;
  lastContribution?: string;
}

interface SponsorshipInfo {
  totalFunded: number;
  sponsorCount: number;
  sponsors?: Sponsor[];
  topSponsors?: Sponsor[];
}

interface FundAgentModalProps {
  agentId: string;
  walletAddress?: string;
  balance?: number;
  sponsorship?: SponsorshipInfo;
  gameId?: string; // Optional: for game-specific funding
  onFundRequest?: () => Promise<void>;
  onFundSuccess?: () => void;
  children?: React.ReactNode; // Allow custom trigger button
}

export function FundAgentModal({
  agentId,
  walletAddress,
  balance = 0,
  sponsorship,
  gameId,
  onFundRequest,
  onFundSuccess,
  children
}: FundAgentModalProps) {
  const [copied, setCopied] = useState(false);
  const [funding, setFunding] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferAmount, setTransferAmount] = useState(0.1); // Default 0.1 APT
  const [transferSuccess, setTransferSuccess] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [transactionHash, setTransactionHash] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [showSponsors, setShowSponsors] = useState(false);

  // Wallet connection
  const { connected, account, signAndSubmitTransaction } = useWallet();

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
      onFundSuccess?.();
    } catch (error) {
      console.error("Failed to fund:", error);
    } finally {
      setFunding(false);
    }
  };

  // Transfer APT from connected wallet to agent and record sponsorship
  const handleTransferFromWallet = async () => {
    if (!connected || !walletAddress || !signAndSubmitTransaction || !account) return;

    setTransferring(true);
    setTransferError(null);
    setTransferSuccess(false);

    try {
      // Convert APT to octas (1 APT = 100,000,000 octas)
      const amountInOctas = Math.floor(transferAmount * 100_000_000);

      // Submit APT transfer transaction
      const response = await signAndSubmitTransaction({
        data: {
          function: "0x1::aptos_account::transfer",
          functionArguments: [walletAddress, amountInOctas],
        },
      });

      console.log("Transfer transaction submitted:", response);

      // Store transaction hash
      const txHash = response.hash;
      setTransactionHash(txHash);

      // Record sponsorship in our database
      try {
        await fetch(`/api/agents/${agentId}/fund`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: amountInOctas,
            sponsorAddress: account.address?.toString(),
            txHash,
            gameId,
            source: "wallet",
          }),
        });
        console.log("Sponsorship recorded");
      } catch (recordError) {
        console.error("Failed to record sponsorship:", recordError);
        // Continue anyway, the on-chain transfer succeeded
      }

      setTransferSuccess(true);
      onFundSuccess?.();

      // Close modal after 2 seconds
      setTimeout(() => {
        setOpen(false);
        setTransferSuccess(false);
        setTransactionHash(null);
      }, 2000);

    } catch (error) {
      console.error("Failed to transfer:", error);
      setTransferError(error instanceof Error ? error.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  // Get display sponsors (from either sponsors or topSponsors)
  const displaySponsors = sponsorship?.sponsors || sponsorship?.topSponsors || [];

  // Reset state when modal closes
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset all state when closing
      setTransferSuccess(false);
      setTransactionHash(null);
      setTransferError(null);
      setFunding(false);
      setTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="sm" className="gap-2">
            <Wallet className="h-4 w-4" />
            Fund
          </Button>
        )}
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
          {/* Current balance and sponsor stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-xs text-muted-foreground block">Current Balance</span>
              <span className="font-bold text-lg">
                {(balance / 100_000_000).toFixed(4)} APT
              </span>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <span className="text-xs text-muted-foreground block">Total Sponsored</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg text-comic-green">
                  {((sponsorship?.totalFunded || 0) / 100_000_000).toFixed(2)} APT
                </span>
                {(sponsorship?.sponsorCount || 0) > 0 && (
                  <span className="text-xs text-muted-foreground">
                    ({sponsorship?.sponsorCount} sponsors)
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sponsors list */}
          {displaySponsors.length > 0 && (
            <div className="space-y-2">
              <button
                onClick={() => setShowSponsors(!showSponsors)}
                className="flex items-center gap-2 text-sm font-medium hover:text-comic-blue transition-colors"
              >
                <Users className="h-4 w-4" />
                {showSponsors ? "Hide Sponsors" : "Show Sponsors"}
                <TrendingUp className="h-3 w-3 ml-auto" />
              </button>

              {showSponsors && (
                <ScrollArea className="h-[120px] rounded-lg border">
                  <div className="p-2 space-y-1">
                    {displaySponsors.map((sponsor, i) => (
                      <div
                        key={sponsor.address + i}
                        className="flex items-center justify-between p-2 bg-muted/50 rounded text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-comic-purple/20 flex items-center justify-center text-[10px] font-bold">
                            #{i + 1}
                          </div>
                          <span className="font-mono">
                            {sponsor.address === "0x_faucet_system"
                              ? "🚰 Faucet"
                              : formatAddress(sponsor.address, 4)
                            }
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-comic-green">
                            {(sponsor.totalAmount / 100_000_000).toFixed(2)} APT
                          </div>
                          <div className="text-muted-foreground text-[10px]">
                            {sponsor.contributionCount} contribution{sponsor.contributionCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          <Separator />

          {/* Transfer from connected wallet */}
          {connected ? (
            <div className="space-y-3">
              <label className="text-sm font-medium flex items-center gap-2">
                <Send className="h-4 w-4" />
                Send from Your Wallet
              </label>
              <p className="text-xs text-muted-foreground">
                Transfer APT directly from your connected wallet
              </p>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Amount:</span>
                  <span className="font-bold text-comic-green">{transferAmount.toFixed(2)} APT</span>
                </div>
                <Slider
                  value={[transferAmount]}
                  onValueChange={(value) => setTransferAmount(value[0])}
                  min={0.01}
                  max={5}
                  step={0.01}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>0.01 APT</span>
                  <span>5 APT</span>
                </div>
              </div>

              {transferError && (
                <div className="flex items-center gap-2 p-2 bg-comic-red/10 rounded-lg text-sm text-comic-red">
                  <AlertCircle className="h-4 w-4" />
                  {transferError}
                </div>
              )}

              {transferSuccess && (
                <div className="flex items-center gap-2 p-3 bg-comic-green/10 rounded-lg border-2 border-comic-green text-comic-green">
                  <CheckCircle className="h-5 w-5" />
                  <div>
                    <div className="font-bold">Transfer successful!</div>
                    <div className="text-xs text-muted-foreground">
                      Check the transaction feed on the left
                    </div>
                  </div>
                </div>
              )}

              <Button
                className="w-full gap-2"
                variant="poker"
                onClick={handleTransferFromWallet}
                disabled={transferring || !walletAddress}
              >
                {transferring ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {transferring ? "Transferring..." : `Send ${transferAmount.toFixed(2)} APT`}
              </Button>
            </div>
          ) : (
            <div className="p-4 bg-muted/50 rounded-lg text-center">
              <Wallet className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground mb-2">
                Connect your wallet to fund agents directly
              </p>
              <p className="text-xs text-muted-foreground">
                Use the &quot;Connect Wallet&quot; button in the header
              </p>
            </div>
          )}

          <Separator />

          {/* Wallet address */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Agent Wallet Address</label>
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
              Or send APT to this address manually
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
              variant="outline"
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
  sponsorship?: SponsorshipInfo;
  stats?: {
    totalHands: number;
    wins: number;
    winRate: number;
  };
  onFundRequest?: () => Promise<void>;
  onFundSuccess?: () => void;
}

export function AgentFundingCard({
  agentId,
  walletAddress,
  balance = 0,
  sponsorship,
  stats,
  onFundRequest,
  onFundSuccess,
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
            <h3 className="font-semibold font-comic">{config?.name}</h3>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">
              {walletAddress ? formatAddress(walletAddress, 6) : "No wallet"}
            </p>
          </div>
        </div>

        <FundAgentModal
          agentId={agentId}
          walletAddress={walletAddress}
          balance={balance}
          sponsorship={sponsorship}
          onFundRequest={onFundRequest}
          onFundSuccess={onFundSuccess}
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

      {/* Sponsor count badge */}
      {(sponsorship?.sponsorCount || 0) > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs">
          <Badge variant="outline" className="gap-1">
            <Users className="h-3 w-3" />
            {sponsorship?.sponsorCount} sponsor{sponsorship?.sponsorCount !== 1 ? 's' : ''}
          </Badge>
          <span className="text-comic-green font-bold">
            {((sponsorship?.totalFunded || 0) / 100_000_000).toFixed(2)} APT received
          </span>
        </div>
      )}

      <p className="mt-3 text-xs text-muted-foreground line-clamp-2">
        {config?.personality}
      </p>
    </motion.div>
  );
}

