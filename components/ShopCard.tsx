"use client";

import { SHOP_ITEMS } from "@/lib/items";
import { motion } from "framer-motion";
import { playSuccess, playError } from "@/lib/sounds";
import {
  Shield, Syringe, Globe, Skull, Crosshair,
  RefreshCcw, Network, Bomb, Lock, Wifi, Zap
} from "lucide-react";

const ITEM_ICONS: Record<string, React.ReactNode> = {
  firewall:   <Shield    size={28} strokeWidth={1.2} />,
  patch:      <Syringe   size={28} strokeWidth={1.2} />,
  vpn:        <Globe     size={28} strokeWidth={1.2} />,
  trojan:     <Crosshair size={28} strokeWidth={1.2} />,
  phishing:   <Wifi      size={28} strokeWidth={1.2} />,
  reboot:     <RefreshCcw size={28} strokeWidth={1.2} />,
  zeroday:    <Skull     size={28} strokeWidth={1.2} />,
  ddos:       <Network   size={28} strokeWidth={1.2} />,
  ransomware: <Lock      size={28} strokeWidth={1.2} />,
  logicbomb:  <Bomb      size={28} strokeWidth={1.2} />,
};

const TYPE_CONFIG: Record<string, { label: string; color: string; accent: string }> = {
  defense: { label: 'DEFESA',    color: '#3b82f6', accent: 'rgba(59,130,246,0.15)' },
  heal:    { label: 'CURA',      color: '#22c55e', accent: 'rgba(34,197,94,0.15)'  },
  utility: { label: 'UTILIDADE', color: '#eab308', accent: 'rgba(234,179,8,0.15)' },
  attack:  { label: 'ATAQUE',    color: '#f97316', accent: 'rgba(249,115,22,0.15)' },
  fatal:   { label: 'FATAL',     color: '#ef4444', accent: 'rgba(239,68,68,0.18)'  },
};

export default function ShopCard({
  itemId, myGreens, myBlues, myYellows, onBuy, isProcessing
}: any) {
  const item = SHOP_ITEMS.find(i => i.id === itemId);
  if (!item) return null;

  const canAfford =
    myGreens >= item.cost.green &&
    myBlues  >= item.cost.blue  &&
    myYellows >= item.cost.yellow;

  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.utility;

  const handlePurchase = () => {
    if (canAfford && !isProcessing) { playSuccess(); onBuy(item); }
    else { playError(); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={canAfford ? { y: -4, scale: 1.015 } : {}}
      transition={{ duration: 0.2 }}
      className="cyber-card corner-tl corner-br flex flex-col"
      style={{
        borderColor: canAfford ? `${cfg.color}44` : 'rgba(255,255,255,0.05)',
        background: canAfford
          ? `linear-gradient(160deg, ${cfg.accent} 0%, var(--bg-card) 45%)`
          : 'var(--bg-card)',
        boxShadow: canAfford
          ? `0 4px 20px ${cfg.color}18, inset 0 1px 0 ${cfg.color}15`
          : 'none',
        opacity: canAfford ? 1 : 0.65,
      }}
    >
      <div className="p-5 flex flex-col flex-1">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-3">
            {/* Icon */}
            <div
              className="w-10 h-10 rounded flex items-center justify-center flex-shrink-0"
              style={{
                background: `${cfg.color}12`,
                border: `1px solid ${cfg.color}30`,
                color: canAfford ? cfg.color : 'rgba(255,255,255,0.2)',
              }}
            >
              {ITEM_ICONS[itemId]}
            </div>
            <div>
              <h3
                className="font-bold text-[17px] tracking-wide leading-none"
                style={{
                  fontFamily: 'var(--font-ui)',
                  color: canAfford ? '#e8edf2' : 'rgba(255,255,255,0.35)',
                }}
              >
                {item.name}
              </h3>
              <span
                className="section-label mt-1 block"
                style={{ color: cfg.color, opacity: canAfford ? 0.8 : 0.3 }}
              >
                {cfg.label}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        <p
          className="text-sm leading-relaxed flex-1"
          style={{ color: canAfford ? 'rgba(200,208,218,0.75)' : 'rgba(200,208,218,0.3)', minHeight: 52 }}
        >
          {item.desc}
        </p>

        {/* Cost */}
        <div
          className="mt-4 pt-4"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <p className="section-label mb-2.5">Custo de Fabricação</p>
          <div className="flex gap-2 mb-4">
            {item.cost.green > 0 && (
              <span
                className="mono text-xs font-bold px-2.5 py-1.5 rounded"
                style={{
                  background: 'var(--bg)',
                  borderBottom: `2px solid ${myGreens >= item.cost.green ? '#00ff88' : '#052012'}`,
                  color: myGreens >= item.cost.green ? '#00ff88' : 'rgba(0,255,136,0.2)',
                }}
              >
                {item.cost.green} PCB
              </span>
            )}
            {item.cost.blue > 0 && (
              <span
                className="mono text-xs font-bold px-2.5 py-1.5 rounded"
                style={{
                  background: 'var(--bg)',
                  borderBottom: `2px solid ${myBlues >= item.cost.blue ? '#00aaff' : '#001428'}`,
                  color: myBlues >= item.cost.blue ? '#00aaff' : 'rgba(0,170,255,0.2)',
                }}
              >
                {item.cost.blue} BLUE
              </span>
            )}
            {item.cost.yellow > 0 && (
              <span
                className="mono text-xs font-bold px-2.5 py-1.5 rounded"
                style={{
                  background: 'var(--bg)',
                  borderBottom: `2px solid ${myYellows >= item.cost.yellow ? '#eab308' : '#1a1200'}`,
                  color: myYellows >= item.cost.yellow ? '#eab308' : 'rgba(234,179,8,0.2)',
                }}
              >
                {item.cost.yellow} BAT
              </span>
            )}
          </div>

          <motion.button
            whileTap={canAfford ? { scale: 0.96 } : { x: [-3, 3, -3, 3, 0] }}
            onClick={handlePurchase}
            disabled={isProcessing}
            className={`w-full h-12 rounded font-bold text-[13px] tracking-[0.18em] uppercase transition-all ${
              canAfford
                ? 'btn-primary'
                : 'cursor-not-allowed'
            }`}
            style={
              !canAfford
                ? {
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.15)',
                    fontFamily: 'var(--font-ui)',
                    fontSize: 13,
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }
                : undefined
            }
          >
            {isProcessing ? '...' : canAfford ? 'Fabricar' : 'Sem Recursos'}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
