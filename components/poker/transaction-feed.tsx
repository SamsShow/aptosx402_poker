"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TransactionRecord } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatAddress, formatAmount } from "@/lib/utils";

import {
  ArrowRight,
  ExternalLink,
  Receipt,
  CheckCircle,
  Zap
} from "lucide-react";

interface TransactionFeedProps {
  transactions: TransactionRecord[];
}

/**
 * Filter to only show real blockchain transactions
 * - Must have a valid txHash (not "pending_settlement" or empty)
 * - Must be confirmed status
 */
function isRealBlockchainTx(tx: TransactionRecord): boolean {
  return !!(
    tx.txHash && 
    tx.txHash !== "pending_settlement" && 
    tx.status === "confirmed"
  );
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  // Filter to only real blockchain transactions
  const realTransactions = transactions.filter(isRealBlockchainTx);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-comic-blue comic-border flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-comic text-lg">ON-CHAIN TXS</h3>
        </div>
        <div className="comic-badge bg-comic-blue text-white px-2 py-0.5 text-xs">
          {realTransactions.length}
        </div>
      </div>

      {/* Transaction list */}
      <ScrollArea className="h-[200px] -mx-4 px-4">
        <AnimatePresence initial={false}>
          {realTransactions.length === 0 ? (
            <div className="text-center py-6 comic-card p-4">
              <Receipt className="h-8 w-8 mx-auto mb-2 text-comic-blue" />
              <p className="font-comic text-sm">NO ON-CHAIN TXS YET</p>
              <p className="text-xs text-muted-foreground mt-1">
                APT transfers occur when hands settle
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {realTransactions.map((tx, index) => (
                <TransactionRow key={tx.id} tx={tx} index={index} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

interface TransactionRowProps {
  tx: TransactionRecord;
  index: number;
}

function TransactionRow({ tx, index }: TransactionRowProps) {
  const typeColors: Record<string, string> = {
    buy_in: "bg-comic-blue",
    bet: "bg-comic-orange",
    pot_win: "bg-comic-green",
    settlement: "bg-comic-green",
    refund: "bg-comic-purple",
    sponsor: "bg-comic-pink",
  };

  // Get explorer URL
  const explorerUrl = tx.explorerUrl || (tx.txHash ? `https://explorer.aptoslabs.com/txn/${tx.txHash}?network=testnet` : null);

  const content = (
    <>
      {/* Status - confirmed icon */}
      <div className="w-6 h-6 flex items-center justify-center comic-border flex-shrink-0 bg-comic-green text-white">
        <CheckCircle className="h-4 w-4" />
      </div>

      {/* From -> To */}
      <div className="flex-1 min-w-0 flex items-center gap-1 text-[10px] font-bold">
        <span className="truncate max-w-[45px] uppercase">
          {formatAgentName(tx.from)}
        </span>
        <ArrowRight className="h-3 w-3 text-foreground flex-shrink-0" />
        <span className="truncate max-w-[45px] uppercase">
          {formatAgentName(tx.to)}
        </span>
      </div>

      {/* Amount in APT */}
      <div className="font-comic text-base flex-shrink-0 text-comic-green">
        {formatAmount(tx.amountOctas || tx.amount)} APT
      </div>

      {/* Type badge */}
      <div className={cn(
        "text-[8px] px-1.5 py-0.5 text-white font-bold uppercase comic-border flex-shrink-0 whitespace-nowrap",
        typeColors[tx.type] || "bg-foreground"
      )}>
        {tx.type === "settlement" ? "WIN" : tx.type.replace("_", " ")}
      </div>

      {/* Explorer link */}
      {explorerUrl && (
        <ExternalLink className="h-3 w-3 text-comic-blue flex-shrink-0 group-hover:scale-110 transition-transform" />
      )}
    </>
  );

  // Wrap in link if we have explorer URL
  if (explorerUrl) {
    return (
      <motion.a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="tx-item flex items-center gap-1.5 p-2 hover:translate-x-1 hover:-translate-y-1 transition-transform group cursor-pointer"
        initial={{ opacity: 0, y: 10, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.9 }}
        transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
      >
        {content}
      </motion.a>
    );
  }

  return (
    <motion.div
      className="tx-item flex items-center gap-1.5 p-2 hover:translate-x-1 hover:-translate-y-1 transition-transform group"
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
    >
      {content}
    </motion.div>
  );
}

function formatAgentName(id: string): string {
  if (id === "pot") return "POT";
  if (id.startsWith("agent_")) {
    const name = id.replace("agent_", "");
    return name.toUpperCase();
  }
  return formatAddress(id, 3);
}
