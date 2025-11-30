/**
 * Game Wallet Funding Component
 * 
 * Modal for funding per-game agent wallets
 * Each game has separate wallets for all agents
 */

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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
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
    Copy,
    RefreshCcw,
    ExternalLink
} from "lucide-react";

interface GameWalletInfo {
    agentId: string;
    agentName: string;
    address: string;
    publicKey: string;
    balance: number;
    balanceApt: number;
    initialFunding: number;
    requiredAmount: number;
    funded: boolean;
}

interface GameWalletFundingProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    gameId: string;
    requiredAmount?: number; // in octas, default 100_000_000 (1 APT)
    onAllFunded?: () => void;
    onStartGame: () => void;
}

export function GameWalletFunding({
    open,
    onOpenChange,
    gameId,
    requiredAmount = 100_000_000, // 1 APT
    onAllFunded,
    onStartGame,
}: GameWalletFundingProps) {
    const [wallets, setWallets] = useState<GameWalletInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [transferring, setTransferring] = useState<string | null>(null);
    const [transferSuccess, setTransferSuccess] = useState<string | null>(null);
    const [transferError, setTransferError] = useState<string | null>(null);
    const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
    const [startingGame, setStartingGame] = useState(false);

    const { connected, account, signAndSubmitTransaction } = useWallet();

    // Fetch wallet status
    const fetchWalletStatus = async () => {
        try {
            const res = await fetch(`/api/game-wallets/status?gameId=${gameId}&requiredAmount=${requiredAmount}`);
            const data = await res.json();

            if (data.success) {
                setWallets(data.wallets);

                // Check if all funded
                if (data.summary.allFunded && onAllFunded) {
                    onAllFunded();
                }
            }
        } catch (error) {
            console.error("Failed to fetch wallet status:", error);
        }
    };

    useEffect(() => {
        if (!open) return;

        const load = async () => {
            setLoading(true);
            await fetchWalletStatus();
            setLoading(false);
        };

        load();
        // Removed auto-refresh interval - use manual refresh button instead
    }, [open, gameId, requiredAmount]);

    // Refresh balances manually
    const handleRefresh = async () => {
        setRefreshing(true);
        await fetch(`/api/game-wallets/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ gameId }),
        });
        await fetchWalletStatus();
        setRefreshing(false);
    };

    // Handle wallet transfer
    const handleFundWallet = async (wallet: GameWalletInfo) => {
        if (!connected || !account || !signAndSubmitTransaction) {
            setTransferError("Please connect your wallet first");
            return;
        }

        setTransferring(wallet.agentId);
        setTransferError(null);
        setTransferSuccess(null);

        try {
            // Calculate amount needed
            const amountNeeded = Math.max(requiredAmount - wallet.balance, 0);
            const amountToSend = Math.ceil(amountNeeded * 1.1); // Send 10% more to cover any delays

            // Submit transfer
            const response = await signAndSubmitTransaction({
                data: {
                    function: "0x1::aptos_account::transfer",
                    functionArguments: [wallet.address, amountToSend],
                },
            });

            // Record funding
            await fetch(`/api/game-wallets/fund`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    gameId,
                    agentId: wallet.agentId,
                    funderAddress: account.address?.toString(),
                    amount: amountToSend,
                    txHash: response.hash,
                }),
            });

            setTransferSuccess(wallet.agentId);

            // Refresh status after a delay
            setTimeout(async () => {
                await handleRefresh();
                setTransferSuccess(null);
            }, 3000);
        } catch (error) {
            setTransferError(error instanceof Error ? error.message : "Transfer failed");
        } finally {
            setTransferring(null);
        }
    };

    // Copy address to clipboard
    const handleCopyAddress = async (address: string) => {
        await navigator.clipboard.writeText(address);
        setCopiedAddress(address);
        setTimeout(() => setCopiedAddress(null), 2000);
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

    const allFunded = wallets.every(w => w.funded);
    const fundedCount = wallets.filter(w => w.funded).length;
    const totalWallets = wallets.length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 font-comic text-2xl">
                        <Wallet className="h-6 w-6 text-comic-blue" />
                        Game Wallet Funding
                    </DialogTitle>
                    <DialogDescription>
                        Fund per-game wallets for <span className="font-mono font-bold">Game #{gameId.slice(-6).toUpperCase()}</span>.
                        {" "}Each agent has a dedicated wallet for this game only.
                    </DialogDescription>
                </DialogHeader>

                {/* Progress */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                        <span className="font-bold">Funding Progress</span>
                        <div className="flex items-center gap-2">
                            <span className={cn(
                                "font-bold",
                                allFunded ? "text-comic-green" : "text-comic-orange"
                            )}>
                                {fundedCount}/{totalWallets} Wallets Funded
                            </span>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={handleRefresh}
                                disabled={refreshing}
                            >
                                <RefreshCcw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                            </Button>
                        </div>
                    </div>
                    <Progress
                        value={(fundedCount / Math.max(totalWallets, 1)) * 100}
                        className="h-3"
                    />
                    <p className="text-xs text-muted-foreground">
                        Each wallet needs <span className="font-bold text-comic-green">{(requiredAmount / 100_000_000).toFixed(2)} APT</span>
                    </p>
                </div>

                <Separator />

                {/* Wallet list */}
                {loading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-comic-blue" />
                    </div>
                ) : (
                    <ScrollArea className="h-[350px] pr-4">
                        <div className="space-y-3">
                            {wallets.map((wallet) => (
                                <motion.div
                                    key={wallet.agentId}
                                    className={cn(
                                        "p-4 rounded-lg border-2 transition-all",
                                        wallet.funded
                                            ? "border-comic-green bg-comic-green/5"
                                            : "border-comic-orange bg-comic-orange/5"
                                    )}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        {/* Agent info */}
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <span className="font-bold text-lg">{wallet.agentName}</span>
                                                {wallet.funded ? (
                                                    <Badge variant="outline" className="bg-comic-green/10 text-comic-green border-comic-green gap-1">
                                                        <CheckCircle className="h-3 w-3" />
                                                        Funded
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-comic-orange/10 text-comic-orange border-comic-orange gap-1">
                                                        <AlertTriangle className="h-3 w-3" />
                                                        Needs {((requiredAmount - wallet.balance) / 100_000_000).toFixed(2)} APT
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Wallet address */}
                                            <div className="flex items-center gap-2">
                                                <code className="text-xs bg-black/5 dark:bg-white/5 px-2 py-1 rounded font-mono">
                                                    {formatAddress(wallet.address, 8)}
                                                </code>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="h-6 w-6 p-0"
                                                    onClick={() => handleCopyAddress(wallet.address)}
                                                >
                                                    {copiedAddress === wallet.address ? (
                                                        <CheckCircle className="h-3 w-3 text-comic-green" />
                                                    ) : (
                                                        <Copy className="h-3 w-3" />
                                                    )}
                                                </Button>
                                                <a
                                                    href={`https://explorer.aptoslabs.com/account/${wallet.address}?network=testnet`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-comic-blue hover:underline"
                                                >
                                                    <ExternalLink className="h-3 w-3" />
                                                </a>
                                            </div>

                                            {/* Balance */}
                                            <div className="text-sm">
                                                <span className="text-muted-foreground">Balance: </span>
                                                <span className={cn(
                                                    "font-bold",
                                                    wallet.funded ? "text-comic-green" : "text-comic-orange"
                                                )}>
                                                    {wallet.balanceApt.toFixed(4)} APT
                                                </span>
                                                <span className="text-muted-foreground">
                                                    {" "}/ {(requiredAmount / 100_000_000).toFixed(2)} required
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action */}
                                        {!wallet.funded && connected && (
                                            <Button
                                                size="sm"
                                                variant="poker"
                                                className="gap-1"
                                                onClick={() => handleFundWallet(wallet)}
                                                disabled={transferring !== null}
                                            >
                                                {transferring === wallet.agentId ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <Send className="h-3 w-3" />
                                                )}
                                                Fund
                                            </Button>
                                        )}
                                    </div>

                                    {/* Success indicator */}
                                    {transferSuccess === wallet.agentId && (
                                        <div className="mt-2 flex items-center gap-2 text-comic-green text-sm">
                                            <CheckCircle className="h-4 w-4" />
                                            Transfer submitted! Refreshing...
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </ScrollArea>
                )}

                {/* Error message */}
                {transferError && (
                    <div className="p-3 bg-comic-red/10 rounded-lg text-sm text-comic-red">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 flex-shrink-0" />
                            <div>
                                <p className="font-bold">Transfer Failed</p>
                                <p className="text-xs mt-1">{transferError}</p>
                            </div>
                        </div>
                    </div>
                )}

                {!connected && (
                    <div className="p-3 bg-comic-orange/10 rounded-lg text-sm text-comic-orange">
                        <div className="flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            <p>Connect your wallet to fund agent wallets</p>
                        </div>
                    </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                        Per-game wallets • {totalWallets} agents
                    </div>

                    <div className="flex gap-2">
                        <Button variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
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
                            {allFunded
                                ? "Start Game"
                                : `Fund ${totalWallets - fundedCount} More & Start`
                            }
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
