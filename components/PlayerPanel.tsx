"use client";

import { SHOP_ITEMS } from "@/lib/items";
import { motion } from "framer-motion";
import { useRef } from "react";
import {
  Shield, Syringe, Globe, Skull, Crosshair,
  RefreshCcw, Network, Bomb, Cpu, Wifi, Lock, Zap
} from "lucide-react";

const ITEM_ICONS: Record<string, React.ReactNode> = {
  firewall:   <Shield    size={18} strokeWidth={1.5} />,
  patch:      <Syringe   size={18} strokeWidth={1.5} />,
  vpn:        <Globe     size={18} strokeWidth={1.5} />,
  trojan:     <Crosshair size={18} strokeWidth={1.5} />,
  phishing:   <Wifi      size={18} strokeWidth={1.5} />,
  reboot:     <RefreshCcw size={18} strokeWidth={1.5} />,
  zeroday:    <Skull     size={18} strokeWidth={1.5} />,
  ddos:       <Network   size={18} strokeWidth={1.5} />,
  ransomware: <Lock      size={18} strokeWidth={1.5} />,
  logicbomb:  <Bomb      size={18} strokeWidth={1.5} />,
};

const TYPE_COLOR: Record<string, string> = {
  defense: 'text-blue-400',
  heal:    'text-green-400',
  utility: 'text-yellow-400',
  attack:  'text-orange-400',
  fatal:   'text-red-400',
};

const TYPE_BORDER: Record<string, string> = {
  defense: 'rgba(59,130,246,0.4)',
  heal:    'rgba(34,197,94,0.4)',
  utility: 'rgba(234,179,8,0.4)',
  attack:  'rgba(249,115,22,0.4)',
  fatal:   'rgba(239,68,68,0.5)',
};

// Card suits for flavor
const SUITS = ['◈', '◇', '◆', '○'];

export default function PlayerPanel({
  player, meId, isActive, isDead, isOffline, targetingItem, isTargetable,
  onTarget, onItemClick, isProcessing, isMyTurn
}: any) {
  const isMe = player.id === meId;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
      onClick={() => isTargetable && onTarget(targetingItem, player.id)}
      className={`cyber-card corner-tl corner-br relative transition-all duration-300 ${
        isDead
          ? 'opacity-25 grayscale'
          : isTargetable
          ? 'cursor-pointer'
          : isActive
          ? 'is-active-turn'
          : ''
      }`}
      style={
        isTargetable
          ? { borderColor: '#ff3333', boxShadow: '0 0 25px rgba(255,51,51,0.35)' }
          : undefined
      }
    >
      {/* Active turn left bar */}
      {isActive && !isDead && (
        <div
          className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l"
          style={{ background: 'linear-gradient(180deg, transparent, #d4a853, transparent)' }}
        />
      )}

      {/* Targeting crosshair overlay */}
      {isTargetable && (
        <motion.div
          className="absolute inset-0 rounded-[8px] pointer-events-none z-10"
          animate={{ opacity: [0.3, 0.7, 0.3] }}
          transition={{ repeat: Infinity, duration: 0.8 }}
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,51,51,0.08) 0%, transparent 70%)' }}
        />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-3 pl-2">
          <div className="flex items-center gap-2.5">
            <span
              className="font-bold text-[17px] tracking-wide"
              style={{ fontFamily: 'var(--font-ui)', color: isActive ? '#d4a853' : '#e8edf2' }}
            >
              {player.name}
            </span>
            {isMe && (
              <span className="section-label bg-[rgba(212,168,83,0.1)] text-[#d4a853] px-1.5 py-0.5 rounded">
                YOU
              </span>
            )}
            {isOffline && !isDead && (
              <span className="section-label bg-red-900/30 text-red-400 px-1.5 py-0.5 rounded">
                OFF
              </span>
            )}
            {!isOffline && !isDead && (
              <span
                className="w-2 h-2 rounded-full bg-green-500"
                style={{ boxShadow: '0 0 6px rgba(34,197,94,0.8)' }}
              />
            )}
          </div>

          {/* HP */}
          <div className="hp-display">
            <span className="section-label" style={{ color: '#d4a853', letterSpacing: '0.15em' }}>HP</span>
            <span
              className="mono font-bold text-lg leading-none"
              style={{ color: player.hp <= 1 ? '#ff3333' : '#e8edf2' }}
            >
              {player.hp}
            </span>
          </div>
        </div>

        {/* Resources */}
        <div className="grid grid-cols-3 gap-2 pl-2">
          <div className="res-badge" style={{ borderBottomColor: 'rgba(0,255,136,0.5)' }}>
            <span className="mono font-bold text-lg" style={{ color: '#00ff88' }}>{player.greens}</span>
            <span className="section-label" style={{ color: 'rgba(0,255,136,0.5)' }}>PCB</span>
          </div>
          <div className="res-badge" style={{ borderBottomColor: 'rgba(0,170,255,0.5)' }}>
            <span className="mono font-bold text-lg" style={{ color: '#00aaff' }}>{player.blues}</span>
            <span className="section-label" style={{ color: 'rgba(0,170,255,0.5)' }}>BLUE</span>
          </div>
          <div className="res-badge" style={{ borderBottomColor: 'rgba(234,179,8,0.5)' }}>
            <span className="mono font-bold text-lg" style={{ color: '#eab308' }}>{player.batteries}</span>
            <span className="section-label" style={{ color: 'rgba(234,179,8,0.5)' }}>BAT</span>
          </div>
        </div>

        {/* Inventory */}
        {(player.inventory || []).length > 0 && (
          <div className="pl-2 mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
            <p className="section-label mb-3">Hardwares</p>
            <div className="flex flex-wrap gap-2">
              {player.inventory.map((itemId: string, i: number) => {
                const itemDef = SHOP_ITEMS.find(x => x.id === itemId);
                const isPassive = itemDef?.type === 'defense';
                const isTargetingThis = targetingItem === itemId;
                const canUse = isMyTurn && isMe && !isPassive && !isProcessing;
                const suit = SUITS[i % SUITS.length];
                const borderColor = itemDef ? TYPE_BORDER[itemDef.type] : 'rgba(255,255,255,0.1)';
                const iconColor = itemDef ? TYPE_COLOR[itemDef.type] : 'text-gray-500';

                return (
                  <motion.button
                    key={`${itemId}-${i}`}
                    whileHover={canUse ? { y: -5, scale: 1.06 } : {}}
                    whileTap={canUse ? { scale: 0.93 } : {}}
                    disabled={!canUse}
                    onClick={(e) => { e.stopPropagation(); canUse && onItemClick(itemId); }}
                    data-suit={suit}
                    className={`item-card ${canUse ? 'usable' : ''} ${isTargetingThis ? 'targeting' : ''} 
                      flex flex-col items-center justify-between
                      w-[68px] h-[90px] p-2
                      ${isPassive ? 'opacity-50 cursor-not-allowed' : canUse ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}
                    `}
                    style={canUse ? { borderColor } : undefined}
                  >
                    {/* Top suit mark */}
                    <span className="self-start text-[8px] mono opacity-20">{suit}</span>

                    {/* Icon */}
                    <span className={`${iconColor} ${canUse ? '' : 'opacity-30'}`}>
                      {ITEM_ICONS[itemId] || <Cpu size={18} strokeWidth={1.5} />}
                    </span>

                    {/* Name */}
                    <span
                      className="text-[8px] font-bold uppercase tracking-wider text-center leading-tight"
                      style={{ color: canUse ? 'rgba(212,168,83,0.9)' : 'rgba(255,255,255,0.25)' }}
                    >
                      {itemDef?.name || itemId}
                    </span>

                    {/* Bottom suit mark */}
                    <span className="self-end text-[8px] mono opacity-20" style={{ transform: 'rotate(180deg)' }}>
                      {suit}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
