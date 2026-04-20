"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

const getLogStyle = (log: string) => {
  if (log.includes('💥') || log.includes('DANO') || log.includes('ELIMINADO') || log.includes('💀'))
    return { color: '#ff4444', glow: 'rgba(255,68,68,0.4)' };
  if (log.includes('🦠') || log.includes('congelado') || log.includes('Vírus'))
    return { color: '#cc44ff', glow: 'rgba(204,68,255,0.4)' };
  if (log.includes('💣') || log.includes('Bomba') || log.includes('DDoS'))
    return { color: '#ff6600', glow: 'rgba(255,102,0,0.4)' };
  if (log.includes('🔧') || log.includes('craftou') || log.includes('Firewall'))
    return { color: '#00ff88', glow: 'rgba(0,255,136,0.3)' };
  if (log.includes('Mercado Negro') || log.includes('rodada') || log.includes('partida'))
    return { color: '#d4a853', glow: 'rgba(212,168,83,0.3)' };
  return { color: 'rgba(200,208,218,0.55)', glow: null };
};

export default function TerminalLog({ logs }: { logs: string[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div
      className="cyber-card mt-2"
      style={{ height: 240, display: 'flex', flexDirection: 'column' }}
    >
      {/* Terminal header bar */}
      <div
        className="flex items-center justify-between px-3 py-2"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', flexShrink: 0 }}
      >
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: '#ff3b30' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#ffcc00' }} />
            <span className="w-2 h-2 rounded-full" style={{ background: '#00ca4e' }} />
          </div>
          <span className="section-label" style={{ letterSpacing: '0.2em' }}>TERMINAL DE EVENTOS</span>
        </div>
        <span className="section-label mono">{logs.length} entries</span>
      </div>

      {/* Log content */}
      <div
        className="flex-1 overflow-y-auto px-3 py-2 flex flex-col gap-0.5"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {logs.length === 0 ? (
          <span
            className="text-[11px] italic mt-2"
            style={{ color: 'rgba(200,208,218,0.2)' }}
          >
            _ aguardando eventos...
            <span style={{ animation: 'terminalBlink 1s step-end infinite', display: 'inline-block', marginLeft: 2 }}>
              █
            </span>
          </span>
        ) : (
          logs.map((log, idx) => {
            const { color, glow } = getLogStyle(log);
            const isRecent = idx >= logs.length - 3;
            return (
              <motion.div
                key={idx}
                initial={isRecent ? { opacity: 0, x: -8 } : { opacity: 1, x: 0 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2 }}
                className="terminal-line"
                style={{
                  color,
                  textShadow: glow ? `0 0 8px ${glow}` : 'none',
                  fontSize: 11,
                }}
              >
                {log}
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
