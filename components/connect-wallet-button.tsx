"use client";

/**
 * Connect Wallet Button
 * 
 * A stylish button to connect/disconnect Petra wallet
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { formatAddress } from "@/lib/utils";
import {
  Wallet,
  LogOut,
  Copy,
  CheckCircle,
  ExternalLink,
  Loader2,
  ChevronDown
} from "lucide-react";

interface ConnectWalletButtonProps {
  className?: string;
  variant?: "default" | "poker" | "outline" | "ghost";
}

export function ConnectWalletButton({
  className = "",
  variant = "poker"
}: ConnectWalletButtonProps) {
  const {
    connected,
    account,
    connect,
    disconnect,
    wallet,
    isLoading: connecting,
  } = useWallet();

  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // Fetch balance when connected
  useEffect(() => {
    if (!connected || !account?.address) {
      setBalance(null);
      return;
    }

    const fetchBalance = async () => {
      setLoadingBalance(true);
      try {
        // Use API route to proxy through server-side (with API key)
        const res = await fetch(`/api/account/balance?address=${account.address.toString()}`);
        const data = await res.json();

        if (data.success) {
          setBalance(data.balanceInAPT);
        } else {
          throw new Error(data.error || "Failed to fetch balance");
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
        setBalance(null);
      } finally {
        setLoadingBalance(false);
      }
    };

    fetchBalance();
    // Removed auto-refresh - balance updates on reconnect or page refresh
    // This prevents excessive API calls
  }, [connected, account?.address]);

  const handleConnect = async () => {
    try {
      await connect("Petra");
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Failed to disconnect:", error);
    }
  };

  const copyAddress = async () => {
    if (account?.address) {
      await navigator.clipboard.writeText(account.address.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const openExplorer = () => {
    if (account?.address) {
      window.open(
        `https://explorer.aptoslabs.com/account/${account.address.toString()}?network=testnet`,
        "_blank"
      );
    }
  };

  // Not connected state
  if (!connected) {
    return (
      <Button
        variant={variant}
        onClick={handleConnect}
        disabled={connecting}
        className={`gap-2 ${className}`}
      >
        {connecting ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wallet className="h-4 w-4" />
        )}
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  // Connected state with dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={`gap-2 ${className}`}
        >
          <motion.div
            className="w-2 h-2 rounded-full bg-comic-green"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
          <span className="font-mono text-sm">
            {formatAddress(account?.address?.toString() || "", 4)}
          </span>
          {balance !== null && (
            <span className="text-comic-green font-bold">
              {balance.toFixed(2)} APT
            </span>
          )}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        {/* Wallet info header */}
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 mb-1">
            <img
              src={wallet?.icon || "/avatars/wallet.png"}
              alt={wallet?.name || "Wallet"}
              className="w-5 h-5"
            />
            <span className="font-semibold text-sm">{wallet?.name}</span>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate">
            {account?.address?.toString()}
          </p>
          {loadingBalance ? (
            <div className="flex items-center gap-1 mt-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span className="text-xs">Loading balance...</span>
            </div>
          ) : balance !== null ? (
            <p className="text-sm font-bold text-comic-green mt-1">
              {balance.toFixed(4)} APT
            </p>
          ) : null}
        </div>

        <DropdownMenuSeparator />

        {/* Actions */}
        <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
          {copied ? (
            <CheckCircle className="h-4 w-4 mr-2 text-comic-green" />
          ) : (
            <Copy className="h-4 w-4 mr-2" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>

        <DropdownMenuItem onClick={openExplorer} className="cursor-pointer">
          <ExternalLink className="h-4 w-4 mr-2" />
          View on Explorer
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleDisconnect}
          className="cursor-pointer text-comic-red focus:text-comic-red"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

