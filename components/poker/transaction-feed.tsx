"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { TransactionRecord } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn, formatAddress, formatChips } from "@/lib/utils";
import { getExplorerUrl } from "@/lib/aptos-client";
import { 
  ArrowRight, 
  ExternalLink, 
  Receipt, 
  CheckCircle, 
  Clock, 
  XCircle,
  Zap
} from "lucide-react";

interface TransactionFeedProps {
  transactions: TransactionRecord[];
}

export function TransactionFeed({ transactions }: TransactionFeedProps) {
  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-comic-blue comic-border flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <h3 className="font-comic text-lg">TRANSACTIONS</h3>
        </div>
        <div className="comic-badge bg-comic-blue text-white px-2 py-0.5 text-xs">
          {transactions.length}
        </div>
      </div>
      
      {/* Transaction list */}
      <ScrollArea className="h-[200px] -mx-4 px-4">
        <AnimatePresence initial={false}>
          {transactions.length === 0 ? (
            <div className="text-center py-6 comic-card p-4">
              <Receipt className="h-8 w-8 mx-auto mb-2 text-comic-blue" />
              <p className="font-comic">NO TXS YET</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx, index) => (
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
  const statusConfig = {
    pending: { 
      icon: <Clock className="h-4 w-4" />, 
      color: "bg-comic-yellow",
      text: "text-foreground"
    },
    confirmed: { 
      icon: <CheckCircle className="h-4 w-4" />, 
      color: "bg-comic-green",
      text: "text-white"
    },
    failed: { 
      icon: <XCircle className="h-4 w-4" />, 
      color: "bg-comic-red",
      text: "text-white"
    },
  };
  
  const typeColors: Record<string, string> = {
    buy_in: "bg-comic-blue",
    bet: "bg-comic-orange",
    pot_win: "bg-comic-green",
    refund: "bg-comic-purple",
  };
  
  const status = statusConfig[tx.status];
  
  return (
    <motion.div
      className="tx-item flex items-center gap-2 p-2 hover:translate-x-1 hover:-translate-y-1 transition-transform group"
      initial={{ opacity: 0, y: 10, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.9 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 300, damping: 25 }}
    >
      {/* Status */}
      <div className={cn(
        "w-6 h-6 flex items-center justify-center comic-border flex-shrink-0",
        status.color,
        status.text
      )}>
        {status.icon}
      </div>
      
      {/* From -> To */}
      <div className="flex-1 min-w-0 flex items-center gap-1 text-xs font-bold">
        <span className="truncate max-w-[50px] uppercase">
          {formatAgentName(tx.from)}
        </span>
        <ArrowRight className="h-3 w-3 text-foreground flex-shrink-0" />
        <span className="truncate max-w-[50px] uppercase">
          {formatAgentName(tx.to)}
        </span>
      </div>
      
      {/* Amount */}
      <div className="font-comic text-lg">
        ${formatChips(tx.amount)}
      </div>
      
      {/* Type badge */}
      <div className={cn(
        "text-[9px] px-2 py-0.5 text-white font-bold uppercase comic-border",
        typeColors[tx.type] || "bg-foreground"
      )}>
        {tx.type.replace("_", " ")}
      </div>
      
      {/* Explorer link */}
      {tx.txHash && (
        <a
          href={getExplorerUrl(tx.txHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 bg-comic-blue comic-border flex items-center justify-center"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="h-3 w-3 text-white" />
        </a>
      )}
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
