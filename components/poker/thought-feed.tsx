"use client";

import { motion, AnimatePresence } from "framer-motion";
import type { ThoughtRecord } from "@/types";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { AGENT_CONFIGS } from "@/types/agents";
import { cn, formatAddress } from "@/lib/utils";
import { CheckCircle, Brain, Clock } from "lucide-react";
import { useState } from "react";

interface ThoughtFeedProps {
  thoughts: ThoughtRecord[];
}

export function ThoughtFeed({ thoughts }: ThoughtFeedProps) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-comic-purple comic-border flex items-center justify-center">
            <Brain className="h-4 w-4 text-white" />
          </div>
          <h2 className="font-comic text-xl">AGENT THOUGHTS</h2>
        </div>
        <div className="comic-badge bg-comic-yellow text-foreground px-3 py-1 text-sm">
          {thoughts.length}
        </div>
      </div>
      
      {/* Thought list */}
      <ScrollArea className="flex-1 -mx-4 px-4">
        <AnimatePresence initial={false}>
          {thoughts.length === 0 ? (
            <div className="text-center py-8 comic-card p-6">
              <Brain className="h-10 w-10 mx-auto mb-3 text-comic-purple" />
              <p className="font-comic text-lg">WAITING FOR THOUGHTS...</p>
              <div className="comic-loading mt-4">
                <span></span>
                <span></span>
                <span></span>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {thoughts.map((thought, index) => (
                <ThoughtCard key={`${thought.timestamp}-${index}`} thought={thought} />
              ))}
            </div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </div>
  );
}

interface ThoughtCardProps {
  thought: ThoughtRecord;
}

function ThoughtCard({ thought }: ThoughtCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const config = AGENT_CONFIGS[thought.agentId.replace("agent_", "") as keyof typeof AGENT_CONFIGS];
  
  const timeDiff = Math.floor((Date.now() - thought.timestamp) / 1000);
  const timeAgo = timeDiff < 60 
    ? `${timeDiff}s ago` 
    : timeDiff < 3600 
      ? `${Math.floor(timeDiff / 60)}m ago`
      : `${Math.floor(timeDiff / 3600)}h ago`;
  
  return (
    <motion.div
      className="thought-bubble p-4 cursor-pointer hover:translate-x-1 hover:-translate-y-1 transition-transform"
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -50, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      onClick={() => setShowDetails(!showDetails)}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div 
          className="w-10 h-10 comic-border flex items-center justify-center"
          style={{ backgroundColor: config?.color || "#666" }}
        >
          <span className="text-white text-sm font-bold">
            {config?.name?.slice(0, 2).toUpperCase() || "??"}
          </span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-comic text-lg">{config?.name || "Unknown"}</span>
            <div className="comic-badge bg-comic-green text-white px-2 py-0.5 text-[10px] flex items-center gap-1">
              <CheckCircle className="h-2.5 w-2.5" />
              SIGNED
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 font-bold">
            <Clock className="h-3 w-3" />
            <span>{timeAgo}</span>
            <span>•</span>
            <span 
              className="uppercase px-2 py-0.5 text-white"
              style={{ backgroundColor: config?.color || "#666" }}
            >
              {thought.action}
              {thought.amount > 0 && ` $${thought.amount}`}
            </span>
          </div>
        </div>
      </div>
      
      {/* Thought content */}
      <div className="mt-3 ml-13">
        <p className="text-sm leading-relaxed font-body italic">
          &ldquo;{thought.thoughts}&rdquo;
        </p>
        
        {/* Confidence meter */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-bold uppercase">Confidence</span>
          <div className="flex-1 max-w-24 h-3 bg-muted border-2 border-foreground overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all",
                thought.confidence > 0.7 ? "bg-comic-green" :
                thought.confidence > 0.4 ? "bg-comic-yellow" : "bg-comic-red"
              )}
              style={{ width: `${thought.confidence * 100}%` }}
            />
          </div>
          <span className={cn(
            "text-xs font-bold",
            thought.confidence > 0.7 ? "text-comic-green" :
            thought.confidence > 0.4 ? "text-comic-yellow" : "text-comic-red"
          )}>
            {Math.round(thought.confidence * 100)}%
          </span>
        </div>
      </div>
      
      {/* Expandable details */}
      <AnimatePresence>
        {showDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t-2 border-foreground mt-3 pt-3 space-y-1 text-xs">
              <DetailRow label="TURN" value={`#${thought.turn}`} />
              <DetailRow 
                label="STATE HASH" 
                value={formatAddress(thought.stateHash, 6)} 
                mono 
              />
              <DetailRow 
                label="SIGNATURE" 
                value={formatAddress(thought.signature, 8)} 
                mono 
              />
              <DetailRow 
                label="TIMESTAMP" 
                value={new Date(thought.timestamp).toLocaleTimeString()} 
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function DetailRow({ 
  label, 
  value, 
  mono = false 
}: { 
  label: string; 
  value: string; 
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-muted-foreground font-bold">
      <span>{label}</span>
      <span className={cn(mono && "font-mono", "text-foreground")}>{value}</span>
    </div>
  );
}
