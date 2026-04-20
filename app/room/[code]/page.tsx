// @ts-nocheck
/* eslint-disable */
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Playfair_Display } from "next/font/google";
import { motion, AnimatePresence } from "framer-motion";

import { SHOP_ITEMS } from "@/lib/items";
import TerminalLog from "@/components/TerminalLog";
import ShopCard from "@/components/ShopCard";
import PlayerPanel from "@/components/PlayerPanel";

import { playClick, playDraw, playError, playSuccess } from "@/lib/sounds";

const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"] });

// ─── Card Draw Flash ───────────────────────────────────────────────────────────
type DrawFlash = {
  text: string;
  sub: string;
  color: string;          // CSS color for text/glow
  bgColor: string;        // card back tint
  isHazard: boolean;
};

// Icons for draw flash card
const DRAW_ICONS: Record<string, string> = {
  'PCB':          '<path stroke-linecap="round" stroke-linejoin="round" d="M8.25 3v1.5M4.5 8.25H3m18 0h-1.5M4.5 12H3m18 0h-1.5m-15 3.75H3m18 0h-1.5M8.25 19.5V21M12 3v1.5m0 15V21m3.75-18v1.5m0 15V21m-9-1.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Zm.75-12h9v9h-9v-9Z" />',
  'BLUEPRINT':    '<path stroke-linecap="round" stroke-linejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />',
  'BATERIA':      '<path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z" />',
  'VÍRUS':        '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />',
  'VÍRUS ATIVO':  '<path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />',
  'CURTO':        '<path stroke-linecap="round" stroke-linejoin="round" d="M11.412 15.655 9.75 21.75l3.745-4.012M9.257 13.5H3.75l2.659-2.849m2.048-2.194L14.25 2.25 12 10.5h8.25l-4.707 4.707M3.96 17.955l2.75-2.956m7.08-7.604-2.75 2.955" />',
  'CURTO!':       '<path stroke-linecap="round" stroke-linejoin="round" d="M11.412 15.655 9.75 21.75l3.745-4.012M9.257 13.5H3.75l2.659-2.849m2.048-2.194L14.25 2.25 12 10.5h8.25l-4.707 4.707M3.96 17.955l2.75-2.956m7.08-7.604-2.75 2.955" />',
};

export default function RoomPage() {
  const params   = useParams();
  const router   = useRouter();
  const roomCode = String(params?.code || "");

  const hasInitialized = useRef(false);

  const [loading,      setLoading]      = useState(true);
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);
  const [me,           setMe]           = useState<any>(null);
  const [room,         setRoom]         = useState<any>(null);
  const [players,      setPlayers]      = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [onlineUsers,  setOnlineUsers]  = useState<string[]>([]);
  const [targetingItem,setTargetingItem]= useState<string | null>(null);
  const [showGuide,    setShowGuide]    = useState(false);
  const [showRules,    setShowRules]    = useState(false);

  const [drawFlash,    setDrawFlash]    = useState<DrawFlash | null>(null);
  const [screenShake,  setScreenShake]  = useState(false);
  const [glitchAll,    setGlitchAll]    = useState(false);
  const [damagedPlayer,setDamagedPlayer]= useState<string | null>(null);

  // ─── Screen effects ──────────────────────────────────────────────────────────
  const triggerShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 500);
  };

  const triggerGlitch = () => {
    setGlitchAll(true);
    setTimeout(() => setGlitchAll(false), 350);
  };

  const triggerDamage = (playerId: string) => {
    setDamagedPlayer(playerId);
    setTimeout(() => setDamagedPlayer(null), 700);
  };

  const showFlash = (flash: DrawFlash) => {
    setDrawFlash(flash);
    setTimeout(() => setDrawFlash(null), 1300);
  };

  // ─── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const playerName = localStorage.getItem("playerName");
    if (!playerName) { router.push("/"); return; }

    const initGame = async () => {
      try {
        let { data: roomData, error: roomError } = await supabase
          .from("rooms").select("*").eq("code", roomCode).maybeSingle();
        if (roomError) throw new Error("Erro ao buscar sala: " + roomError.message);
        if (!roomData) {
          const { data: newRoom, error: insertRoomError } = await supabase
            .from("rooms")
            .insert({ code: roomCode, status: 'lobby', bag_greens: 15, bag_blues: 10, bag_reds: 5, bag_batteries: 15, bag_viruses: 5, game_log: [] })
            .select().single();
          if (insertRoomError) throw new Error("Erro ao criar sala.");
          roomData = newRoom;
        }

        let { data: playerData } = await supabase
          .from("players").select("*").eq("room_id", roomData.id).ilike("name", playerName.trim()).maybeSingle();

        if (!playerData) {
          if ((roomData.status || 'lobby') !== 'lobby') {
            alert("Partida em andamento! Você só pode reconectar se usar o nome exato."); router.push("/"); return;
          }
          const { data: newPlayer, error: insertPlayerError } = await supabase
            .from("players")
            .insert({ room_id: roomData.id, name: playerName.trim(), is_ready: false, inventory: [], shop_slots: [] })
            .select().single();
          if (insertPlayerError) throw new Error("Erro ao criar jogador.");
          playerData = newPlayer;
        }

        setRoom(roomData); setMe(playerData);

        const fetchPlayers = async () => {
          const { data } = await supabase.from("players").select("*").eq("room_id", roomData.id).order("joined_at", { ascending: true });
          if (data) setPlayers(data);
        };
        await fetchPlayers();
        setLoading(false);

        const channel = supabase.channel(`room_${roomData.id}`, { config: { presence: { key: playerData.id } } });
        channel
          .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomData.id}` },
            (payload) => { if (payload.new.id === playerData.id) setMe(payload.new); fetchPlayers(); }
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomData.id}` },
            (payload) => setRoom(payload.new)
          )
          .on("presence", { event: "sync" }, () => { setOnlineUsers(Object.keys(channel.presenceState())); })
          .subscribe(async (status) => { if (status === 'SUBSCRIBED') await channel.track({ online_at: new Date().toISOString() }); });

        return () => { supabase.removeChannel(channel); };
      } catch (error: any) { setErrorMsg(error.message); setLoading(false); }
    };

    initGame();
  }, [roomCode, router]);

  // ─── Helpers ─────────────────────────────────────────────────────────────────
  const writeLog = async (message: string) => {
    try {
      const { data: currentRoom } = await supabase.from("rooms").select("game_log, round_count").eq("id", room.id).single();
      const currentLog = currentRoom?.game_log || [];
      const newLog = [...currentLog, `[R${currentRoom.round_count}] ${message}`].slice(-40);
      await supabase.from("rooms").update({ game_log: newLog }).eq("id", room.id);
    } catch (e) { console.error("Erro ao log", e); }
  };

  const handleMenuClick = () => playClick();

  const isMyTurn  = room?.current_turn_player_id === me?.id && room?.status === 'playing';
  const amIDead   = me?.hp <= 0;
  const alivePlayers = players.filter(p => p.hp > 0);
  const isGameOver   = alivePlayers.length === 1 && players.length > 1 && room?.status !== 'lobby';
  const activePlayer = players.find(p => p.id === room?.current_turn_player_id);
  // Build podium: winner first, then dead players sorted by when they died (hp=0 last)
  const podium = isGameOver
    ? [
        ...alivePlayers,
        ...[...players.filter(p => p.hp <= 0)].reverse()
      ]
    : [];

  const getNextAlivePlayer = (baseId = me.id) => {
    const baseIndex = players.findIndex(p => p.id === baseId);
    for (let i = 1; i < players.length; i++) {
      const nextP = players[(baseIndex + i) % players.length];
      if (nextP.hp > 0 && nextP.id !== baseId) return nextP;
    }
    return null;
  };

  // ─── Quit / Kick ──────────────────────────────────────────────────────────────
  const handleQuit = async () => {
    handleMenuClick();
    if (!window.confirm("Tem certeza que deseja sair?")) return;
    setIsProcessing(true);
    try {
      if (room.status === 'lobby') { await supabase.from("players").delete().eq("id", me.id); router.push("/"); return; }
      if (room.current_turn_player_id === me.id && room.status === 'playing') {
        await supabase.from("rooms").update({ bag_greens: room.bag_greens + me.turn_greens, bag_blues: room.bag_blues + me.turn_blues, bag_batteries: room.bag_batteries + me.turn_batteries, bag_reds: room.bag_reds + me.reds_in_turn, bag_viruses: room.bag_viruses + me.viruses_in_turn }).eq("id", room.id);
        const nextPlayer = getNextAlivePlayer(me.id);
        if (nextPlayer) await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
      }
      await writeLog(`${me.name} abandonou a partida.`);
      await supabase.from("players").update({ hp: 0 }).eq("id", me.id);
      router.push("/");
    } catch (e) { setIsProcessing(false); }
  };

  const handleKickOffline = async (targetPlayer: any) => {
    handleMenuClick();
    if (!window.confirm(`Eliminar ${targetPlayer.name} por inatividade?`)) return;
    setIsProcessing(true);
    try {
      if (room.current_turn_player_id === targetPlayer.id && (room.status === 'playing' || room.status === 'crafting')) {
        await supabase.from("rooms").update({ bag_greens: room.bag_greens + targetPlayer.turn_greens, bag_blues: room.bag_blues + targetPlayer.turn_blues, bag_batteries: room.bag_batteries + targetPlayer.turn_batteries, bag_reds: room.bag_reds + targetPlayer.reds_in_turn, bag_viruses: room.bag_viruses + targetPlayer.viruses_in_turn }).eq("id", room.id);
        const nextPlayer = getNextAlivePlayer(targetPlayer.id);
        if (nextPlayer && room.status === 'playing') await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
      }
      await writeLog(`${targetPlayer.name} foi eliminado por inatividade.`);
      await supabase.from("players").update({ hp: 0 }).eq("id", targetPlayer.id);
      if (room.status === 'crafting') handleFinishCrafting(true);
    } finally { setIsProcessing(false); }
  };

  const handleReturnToLobby = async () => {
    handleMenuClick();
    setIsProcessing(true);
    try {
      await supabase.from("rooms").update({ status: 'lobby', bag_greens: 15, bag_blues: 10, bag_batteries: 15, bag_reds: 5, bag_viruses: 5, current_turn_player_id: null, round_count: 1, game_log: [] }).eq("id", room.id);
      for (const p of players) await supabase.from("players").update({ hp: 3, greens: 0, blues: 0, batteries: 0, turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0, forced_draws: 0, is_ready: false, inventory: [], shop_slots: [], has_finished_crafting: false }).eq("id", p.id);
    } finally { setIsProcessing(false); }
  };

  // ─── Items ────────────────────────────────────────────────────────────────────
  const handleItemClick = (itemId: string) => {
    playClick();
    const itemDef = SHOP_ITEMS.find(i => i.id === itemId);
    if (itemDef?.type === 'defense') return;
    if (itemDef?.type === 'attack' || itemId === 'zeroday' || itemId === 'ransomware') {
      setTargetingItem(targetingItem === itemId ? null : itemId);
    } else { handleUseItem(itemId); }
  };

  const handleUseItem = async (itemId: string, targetId: string | null = null) => {
    if (isProcessing) return;
    setIsProcessing(true); setTargetingItem(null);
    try {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      const { data: dbMe }   = await supabase.from("players").select("*").eq("id", me.id).single();
      const invIdx = dbMe.inventory.indexOf(itemId);
      if (invIdx === -1) throw new Error("Item não encontrado.");

      let updatedMyInv = [...dbMe.inventory];
      updatedMyInv.splice(invIdx, 1);
      const itemDef = SHOP_ITEMS.find(i => i.id === itemId);

      let targetDb = null;
      if (targetId) targetDb = (await supabase.from("players").select("*").eq("id", targetId).single()).data;

      await writeLog(`${me.name} usou [${itemDef?.name}].`);
      playSuccess();

      if (itemId === 'patch') {
        await supabase.from("players").update({ hp: dbMe.hp + 1, inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'vpn') {
        const nextPlayer = getNextAlivePlayer(me.id);
        await supabase.from("rooms").update({ bag_reds: dbRoom.bag_reds + dbMe.reds_in_turn, bag_viruses: dbRoom.bag_viruses + dbMe.viruses_in_turn, current_turn_player_id: nextPlayer.id }).eq("id", room.id);
        await supabase.from("players").update({ greens: dbMe.greens + dbMe.turn_greens, blues: dbMe.blues + dbMe.turn_blues, batteries: dbMe.batteries + dbMe.turn_batteries, turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0, forced_draws: 0, inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'reboot') {
        let returnedReds = Math.min(2, dbMe.reds_in_turn);
        let returnedViruses = Math.min(2 - returnedReds, dbMe.viruses_in_turn);
        if (returnedReds === 0 && returnedViruses === 0) { setIsProcessing(false); return; }
        await supabase.from("rooms").update({ bag_reds: dbRoom.bag_reds + returnedReds, bag_viruses: dbRoom.bag_viruses + returnedViruses }).eq("id", room.id);
        await supabase.from("players").update({ reds_in_turn: dbMe.reds_in_turn - returnedReds, viruses_in_turn: dbMe.viruses_in_turn - returnedViruses, inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'trojan' && targetDb) {
        // Glitch effect for attacked player
        triggerGlitch();
        await supabase.from("players").update({ forced_draws: targetDb.forced_draws + 3 }).eq("id", targetId);
        await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'phishing' && targetDb) {
        triggerGlitch();
        let pool = [];
        for(let i=0; i<targetDb.greens; i++) pool.push('green');
        for(let i=0; i<targetDb.blues; i++) pool.push('blue');
        for(let i=0; i<targetDb.batteries; i++) pool.push('yellow');
        let stolen = { green: 0, blue: 0, yellow: 0 };
        for(let i=0; i<2; i++) {
          if (pool.length > 0) { let r = Math.floor(Math.random() * pool.length); stolen[pool[r]]++; pool.splice(r, 1); }
        }
        await supabase.from("players").update({ greens: targetDb.greens - stolen.green, blues: targetDb.blues - stolen.blue, batteries: targetDb.batteries - stolen.yellow }).eq("id", targetId);
        await supabase.from("players").update({ greens: dbMe.greens + stolen.green, blues: dbMe.blues + stolen.blue, batteries: dbMe.batteries + stolen.yellow, inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'zeroday' && targetDb) {
        let targetInv = [...(targetDb.inventory || [])];
        const fwIdx = targetInv.indexOf('firewall');
        if (fwIdx > -1) {
          targetInv.splice(fwIdx, 1);
          await supabase.from("players").update({ inventory: targetInv }).eq("id", targetId);
          await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
          await writeLog(`O Firewall de ${targetDb.name} bloqueou o ataque.`);
        } else {
          triggerShake(); triggerDamage(targetId);
          await supabase.from("players").update({ hp: targetDb.hp - 1 }).eq("id", targetId);
          await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
          await writeLog(`${targetDb.name} sofreu 1 Dano.`);
        }
      } else if (itemId === 'ransomware' && targetDb) {
        let targetInv = [...(targetDb.inventory || [])];
        const fwIdx = targetInv.indexOf('firewall');
        if (fwIdx > -1) {
          targetInv.splice(fwIdx, 1);
          await supabase.from("players").update({ inventory: targetInv }).eq("id", targetId);
          await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
          await writeLog(`O Firewall de ${targetDb.name} bloqueou o Ransomware.`);
        } else {
          triggerShake(); triggerDamage(targetId);
          await supabase.from("players").update({ hp: targetDb.hp - 1 }).eq("id", targetId);
          await supabase.from("players").update({ hp: dbMe.hp + 1, inventory: updatedMyInv }).eq("id", me.id);
          await writeLog(`${me.name} sugou 1 HP de ${targetDb.name}.`);
        }
      } else if (itemId === 'ddos') {
        triggerGlitch(); triggerShake();
        const { data: allPlayers } = await supabase.from("players").select("*").eq("room_id", room.id);
        for(const p of allPlayers) {
          if (p.id !== me.id && p.hp > 0) await supabase.from("players").update({ forced_draws: p.forced_draws + 2 }).eq("id", p.id);
        }
        await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
      } else if (itemId === 'logicbomb') {
        triggerShake(); triggerGlitch();
        const { data: allPlayers } = await supabase.from("players").select("*").eq("room_id", room.id);
        for(const p of allPlayers) {
          if (p.hp > 0 && p.id !== me.id) await supabase.from("players").update({ hp: p.hp - 1 }).eq("id", p.id);
        }
        await supabase.from("players").update({ hp: dbMe.hp - 1, inventory: updatedMyInv }).eq("id", me.id);
        await writeLog(`Bomba Lógica! TODOS perderam 1 HP.`);
      }
    } catch (err) { console.error(err); } finally { setIsProcessing(false); }
  };

  // ─── Draw ─────────────────────────────────────────────────────────────────────
  const handleDraw = async () => {
    if (!isMyTurn || amIDead || isGameOver || isProcessing) return;
    setIsProcessing(true);
    try {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      const { data: dbMe }   = await supabase.from("players").select("*").eq("id", me.id).single();

      const totalInBag = dbRoom.bag_greens + dbRoom.bag_blues + dbRoom.bag_reds + dbRoom.bag_batteries + dbRoom.bag_viruses;
      if (totalInBag <= 0) return alert("Saco vazio!");

      let currentHp = dbMe.hp;
      const roll = Math.random() * totalInBag;

      let newBagGreens    = dbRoom.bag_greens,   newBagBlues    = dbRoom.bag_blues;
      let newBagReds      = dbRoom.bag_reds,      newBagBatteries= dbRoom.bag_batteries;
      let newBagViruses   = dbRoom.bag_viruses;
      let newTurnGreens   = dbMe.turn_greens,     newTurnBlues   = dbMe.turn_blues;
      let newRedsInTurn   = dbMe.reds_in_turn,    newTurnBatteries=dbMe.turn_batteries;
      let newVirusesInTurn= dbMe.viruses_in_turn;
      let newForcedDraws  = Math.max(0, dbMe.forced_draws - 1);

      let isExplosion = false, isVirusSkip = false;

      if (roll < newBagGreens) {
        newBagGreens--; newTurnGreens++;
        playDraw();
        showFlash({ text: 'PCB', sub: 'Placa de Circuito', color: '#00ff88', bgColor: '#001a0a', isHazard: false });
      } else if (roll < newBagGreens + newBagBlues) {
        newBagBlues--; newTurnBlues++;
        playDraw();
        showFlash({ text: 'BLUEPRINT', sub: 'Projeto Técnico', color: '#00aaff', bgColor: '#000d1a', isHazard: false });
      } else if (roll < newBagGreens + newBagBlues + newBagBatteries) {
        newBagBatteries--; newTurnBatteries++;
        playDraw();
        showFlash({ text: 'BATERIA', sub: 'Célula de Energia', color: '#eab308', bgColor: '#1a1000', isHazard: false });
      } else if (roll < newBagGreens + newBagBlues + newBagBatteries + newBagViruses) {
        newBagViruses--; newVirusesInTurn++;
        if (newVirusesInTurn >= 2) {
          isVirusSkip = true;
          playError();
          showFlash({ text: 'VÍRUS ATIVO', sub: 'Sistema Congelado', color: '#cc44ff', bgColor: '#0d0014', isHazard: true });
        } else {
          playDraw();
          showFlash({ text: 'VÍRUS', sub: 'Ameaça Detectada', color: '#cc44ff', bgColor: '#0d0014', isHazard: false });
        }
      } else {
        newBagReds--; newRedsInTurn++;
        if (newRedsInTurn >= 2) {
          isExplosion = true; currentHp--;
          playError(); triggerShake(); triggerDamage(me.id);
          showFlash({ text: 'CURTO!', sub: 'Dano Letal Recebido', color: '#ff3333', bgColor: '#1a0000', isHazard: true });
        } else {
          playDraw();
          showFlash({ text: 'CURTO', sub: 'Tensão Alta', color: '#ff6666', bgColor: '#140000', isHazard: false });
        }
      }

      if (newBagGreens <= 0 || newBagBlues <= 0 || newBagBatteries <= 0) {
        newBagGreens += 6; newBagBlues += 4; newBagBatteries += 6;
        await writeLog(`A IA reabasteceu o Saco com materiais.`);
      }

      let updatedMyInv = [...(dbMe.inventory || [])];
      let firewallTriggered = false;

      if (isExplosion) {
        const fwIdx = updatedMyInv.indexOf('firewall');
        if (fwIdx > -1) { updatedMyInv.splice(fwIdx, 1); currentHp++; firewallTriggered = true; }
      }

      if (isExplosion || isVirusSkip) {
        newBagGreens += newTurnGreens; newBagBlues += newTurnBlues; newBagBatteries += newTurnBatteries;
        newBagReds += newRedsInTurn; newBagViruses += newVirusesInTurn;
        newTurnGreens = 0; newTurnBlues = 0; newTurnBatteries = 0; newRedsInTurn = 0; newVirusesInTurn = 0; newForcedDraws = 0;
      }

      await supabase.from("rooms").update({ bag_greens: newBagGreens, bag_blues: newBagBlues, bag_reds: newBagReds, bag_batteries: newBagBatteries, bag_viruses: newBagViruses }).eq("id", room.id);
      await supabase.from("players").update({ hp: currentHp, turn_greens: newTurnGreens, turn_blues: newTurnBlues, turn_batteries: newTurnBatteries, reds_in_turn: newRedsInTurn, viruses_in_turn: newVirusesInTurn, forced_draws: newForcedDraws, inventory: updatedMyInv }).eq("id", me.id);

      if (isExplosion) {
        if (firewallTriggered) {
          await writeLog(`${me.name} ativou o Firewall para sobreviver ao Curto-Circuito!`);
          await executePassTurn(true);
        } else {
          await writeLog(`💥 ${me.name} sofreu 1 DANO por Curto-Circuito!`);
          if (currentHp <= 0) {
            await writeLog(`💀 ${me.name} FOI ELIMINADO!`);
            const nextP = getNextAlivePlayer();
            if (nextP) await checkRoundAndPass(nextP);
          } else { await executePassTurn(true); }
        }
      } else if (isVirusSkip) {
        await writeLog(`🦠 ${me.name} foi congelado por Vírus.`);
        await executePassTurn(true);
      }
    } finally { setIsProcessing(false); }
  };

  // ─── Pass / Round ─────────────────────────────────────────────────────────────
  const handlePassTurn = async () => {
    playClick();
    if (!isMyTurn || amIDead || isGameOver || isProcessing) return;
    setIsProcessing(true);
    try { await executePassTurn(false); } finally { setIsProcessing(false); }
  };

  const executePassTurn = async (isFromExplosion = false) => {
    const { data: dbMe } = await supabase.from("players").select("*").eq("id", me.id).single();
    if (!isFromExplosion && dbMe.forced_draws > 0) return;
    const nextPlayer = getNextAlivePlayer();
    if (!nextPlayer) return;
    if (!isFromExplosion) {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      await supabase.from("rooms").update({ bag_reds: dbRoom.bag_reds + dbMe.reds_in_turn, bag_viruses: dbRoom.bag_viruses + dbMe.viruses_in_turn }).eq("id", room.id);
      await supabase.from("players").update({ greens: dbMe.greens + dbMe.turn_greens, blues: dbMe.blues + dbMe.turn_blues, batteries: dbMe.batteries + dbMe.turn_batteries, turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0 }).eq("id", me.id);
      await writeLog(`${me.name} passou a vez.`);
    }
    await checkRoundAndPass(nextPlayer);
  };

  const checkRoundAndPass = async (nextPlayer: any) => {
    const myIndex   = players.findIndex(p => p.id === me.id);
    const nextIndex = players.findIndex(p => p.id === nextPlayer.id);
    const isRoundOver = nextIndex <= myIndex;
    if (isRoundOver) {
      await writeLog(`Mercado Negro aberto.`);
      await supabase.from("rooms").update({ status: 'crafting', current_turn_player_id: nextPlayer.id }).eq("id", room.id);
    } else {
      await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
    }
  };

  // ─── Lobby ────────────────────────────────────────────────────────────────────
  const handleToggleReady = async () => {
    playClick();
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const newReadyState = !me.is_ready;
      await supabase.from("players").update({ is_ready: newReadyState }).eq("id", me.id);
      const updatedPlayers = players.map(p => p.id === me.id ? { ...p, is_ready: newReadyState } : p);
      const allReady = updatedPlayers.length > 1 && updatedPlayers.every(p => p.is_ready);
      if (allReady && room.status === 'lobby') {
        const firstPlayer = updatedPlayers[0];
        const pCount = updatedPlayers.length;
        await supabase.from("rooms").update({ status: 'playing', current_turn_player_id: firstPlayer.id, round_count: 1, bag_greens: pCount * 6, bag_blues: pCount * 4, bag_batteries: pCount * 6, bag_reds: pCount * 1, bag_viruses: pCount * 1 }).eq("id", room.id);
        await writeLog(`A partida começou.`);
      } else if (updatedPlayers.length === 1 && newReadyState) {
        await supabase.from("players").update({ is_ready: false }).eq("id", me.id);
      }
    } finally { setIsProcessing(false); }
  };

  // ─── Shop slots ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (room?.status === 'crafting' && me && !me.has_finished_crafting && (!me.shop_slots || me.shop_slots.length === 0)) {
      let possibleItems = [...SHOP_ITEMS];
      if ((me.inventory || []).includes('firewall')) possibleItems = possibleItems.filter(item => item.id !== 'firewall');
      const shuffled = possibleItems.sort(() => 0.5 - Math.random());
      const selectedIds = shuffled.slice(0, 3).map(item => item.id);
      supabase.from("players").update({ shop_slots: selectedIds }).eq("id", me.id).then();
    }
  }, [room?.status, me]);

  const handleBuyItem = async (item: typeof SHOP_ITEMS[0]) => {
    if (me.greens < item.cost.green || me.blues < item.cost.blue || me.batteries < item.cost.yellow) return;
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const newInventory = [...(me.inventory || []), item.id];
      const newShopSlots = me.shop_slots.filter((id: string) => id !== item.id);
      await supabase.from("players").update({ greens: me.greens - item.cost.green, blues: me.blues - item.cost.blue, batteries: me.batteries - item.cost.yellow, inventory: newInventory, shop_slots: newShopSlots }).eq("id", me.id);
      await writeLog(`${me.name} craftou [${item.name}].`);
    } finally { setIsProcessing(false); }
  };

  const handleFinishCrafting = async (isForced = false) => {
    playClick();
    if (isProcessing && !isForced) return;
    setIsProcessing(true);
    try {
      if (!isForced) await supabase.from("players").update({ has_finished_crafting: true }).eq("id", me.id);
      const { data: freshPlayers } = await supabase.from("players").select("*").eq("room_id", room.id);
      const aliveP = freshPlayers.filter(p => p.hp > 0);
      const allFinished = aliveP.every(p => p.has_finished_crafting);
      if (allFinished) {
        await writeLog(`Início da Rodada ${room.round_count + 1}`);
        await supabase.from("rooms").update({ status: 'playing', round_count: room.round_count + 1 }).eq("id", room.id);
        for (const p of aliveP) await supabase.from("players").update({ has_finished_crafting: false, shop_slots: [] }).eq("id", p.id);
      }
    } finally { setIsProcessing(false); }
  };

  // ─── Loading / Error ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="text-center">
        <div className="w-8 h-8 border border-[#d4a853] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <span className="mono text-sm" style={{ color: 'rgba(212,168,83,0.6)' }}>Conectando ao servidor...</span>
      </div>
    </div>
  );

  if (errorMsg || !room || !me) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <p className="mono text-red-400">{errorMsg || "Erro desconhecido."}</p>
    </div>
  );

  const currentStatus = room.status || 'lobby';

  // ─── Shared modal style ───────────────────────────────────────────────────────
  const ModalWrap = ({ children, borderColor = 'rgba(212,168,83,0.25)' }: any) => (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12"
      style={{ background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(8px)', overflowY: 'auto' }}
      onClick={(e) => { if (e.target === e.currentTarget) { setShowGuide(false); setShowRules(false); }}}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="cyber-card w-full max-w-3xl p-6 md:p-10 relative my-8"
        style={{ borderColor, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </motion.div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <motion.div
      animate={screenShake ? { x: [-4, 4, -6, 6, -3, 3, 0], rotate: [-0.4, 0.4, -0.3, 0.3, 0] } : {}}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      {/* Glitch overlay */}
      {glitchAll && <div className="glitch-overlay" />}

      {/* ── Card Draw Flash ── */}
      <AnimatePresence>
        {drawFlash && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none"
          >
            {/* Darkened bg */}
            <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.75)' }} />

            {/* Card */}
            <motion.div
              initial={{ scale: 0.3, rotate: -15, y: 60 }}
              animate={{ scale: 1, rotate: [-8, 8, -4, 4, 0], y: 0 }}
              exit={{ scale: 1.15, opacity: 0, y: -40 }}
              transition={{ duration: 0.45, ease: [0.2, 1.4, 0.6, 1] }}
              className="relative z-10 flex flex-col items-center justify-between rounded-2xl"
              style={{
                width: 200,
                height: 280,
                background: drawFlash.bgColor,
                border: `2px solid ${drawFlash.color}66`,
                boxShadow: `0 0 60px ${drawFlash.color}55, inset 0 0 40px ${drawFlash.color}11`,
                padding: '20px 16px',
              }}
            >
              {/* Corner suit top-left */}
              <div className="self-start mono text-xs" style={{ color: `${drawFlash.color}60` }}>◈</div>

              {/* Main text */}
              <div className="text-center">
                {/* SVG Icon */}
                {DRAW_ICONS[drawFlash.text] && (
                  <div className="flex justify-center mb-3">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.2}
                      stroke={drawFlash.color}
                      width={42}
                      height={42}
                      style={{ filter: `drop-shadow(0 0 8px ${drawFlash.color}88)` }}
                      dangerouslySetInnerHTML={{ __html: DRAW_ICONS[drawFlash.text] }}
                    />
                  </div>
                )}
                <h1
                  className="font-black tracking-tight leading-none"
                  style={{
                    fontFamily: "'Share Tech Mono', monospace",
                    fontSize: drawFlash.text.length > 6 ? 28 : 40,
                    color: drawFlash.color,
                    textShadow: `0 0 20px ${drawFlash.color}, 0 0 40px ${drawFlash.color}88`,
                  }}
                >
                  {drawFlash.text}
                </h1>
                <p
                  className="mt-3 tracking-[0.25em] uppercase"
                  style={{
                    fontSize: 10,
                    color: `${drawFlash.color}80`,
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                  }}
                >
                  {drawFlash.sub}
                </p>
              </div>

              {/* Hazard warning */}
              {drawFlash.isHazard && (
                <motion.div
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ repeat: Infinity, duration: 0.4 }}
                  className="section-label"
                  style={{ color: drawFlash.color, letterSpacing: '0.3em' }}
                >
                  ⚠ ALERTA
                </motion.div>
              )}

              {/* Corner suit bottom-right */}
              <div
                className="self-end mono text-xs"
                style={{ color: `${drawFlash.color}60`, transform: 'rotate(180deg)' }}
              >
                ◈
              </div>

              {/* Horizontal line deco */}
              <div
                className="absolute left-4 right-4"
                style={{ top: '38%', height: 1, background: `linear-gradient(90deg, transparent, ${drawFlash.color}30, transparent)` }}
              />
              <div
                className="absolute left-4 right-4"
                style={{ top: '62%', height: 1, background: `linear-gradient(90deg, transparent, ${drawFlash.color}30, transparent)` }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Guide Modal ── */}
      {showGuide && (
        <ModalWrap>
          <button onClick={() => { handleMenuClick(); setShowGuide(false); }} className="absolute top-5 right-5 text-gray-500 hover:text-white text-xl font-bold">&times;</button>
          <h2 className={`${playfair.className} text-3xl mb-1 text-center`} style={{ color: '#d4a853' }}>Guia de Hardwares</h2>
          <p className="section-label text-center mb-8" style={{ letterSpacing: '0.2em' }}>— itens disponíveis no mercado negro —</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SHOP_ITEMS.map((item, idx) => (
              <div key={idx} className="cyber-card p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-white">{item.name}</span>
                  <span className="section-label bg-[rgba(255,255,255,0.04)] px-2 py-0.5 rounded">{item.type}</span>
                </div>
                <p className="text-xs mb-3" style={{ color: 'rgba(200,208,218,0.6)' }}>{item.desc}</p>
                <div className="flex gap-2 text-[10px] font-bold mono">
                  {item.cost.green  > 0 && <span style={{ color: '#00ff88' }}>{item.cost.green} PCB</span>}
                  {item.cost.blue   > 0 && <span style={{ color: '#00aaff' }}>{item.cost.blue} BLUE</span>}
                  {item.cost.yellow > 0 && <span style={{ color: '#eab308' }}>{item.cost.yellow} BAT</span>}
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={() => { handleMenuClick(); setShowGuide(false); }}
            className="btn-primary w-full mt-8"
          >
            Fechar Guia
          </button>
        </ModalWrap>
      )}

      {/* ── Rules Modal ── */}
      {showRules && (
        <ModalWrap borderColor="rgba(59,130,246,0.3)">
          <button onClick={() => { handleMenuClick(); setShowRules(false); }} className="absolute top-5 right-5 text-gray-500 hover:text-white text-xl font-bold">&times;</button>
          <h2 className={`${playfair.className} text-3xl mb-8 text-center text-blue-400`}>Como Sobreviver</h2>
          <div className="space-y-3 text-sm" style={{ color: 'rgba(200,208,218,0.8)' }}>
            <p>O objetivo é ser o último jogador vivo. Em seu turno, você deve sacar itens do Saco de Risco ou passar a vez.</p>
            <ul className="space-y-2 pl-1">
              <li><span className="text-white font-bold">Passar a Vez:</span> Guarda todos os Materiais e devolve as Ameaças ao Saco.</li>
              <li><span className="text-red-400 font-bold">2× Curto-Circuito:</span> Explosão! Perde 1 HP e todos os itens do turno.</li>
              <li><span className="text-purple-400 font-bold">2× Vírus:</span> Congelamento! Perde a vez e todos os itens do turno.</li>
              <li><span style={{ color: '#d4a853' }} className="font-bold">Mercado Negro:</span> Use recursos para comprar vantagens no fim da rodada.</li>
            </ul>
          </div>
          <button
            onClick={() => { handleMenuClick(); setShowRules(false); }}
            className="mt-8 w-full h-12 rounded font-bold tracking-widest uppercase text-sm transition-all"
            style={{ background: 'rgba(59,130,246,0.8)', color: 'white', fontFamily: 'var(--font-ui)', fontSize: 13 }}
          >
            Entendi
          </button>
        </ModalWrap>
      )}

      {/* ══════════════════════════════════════════════════════
          GAME OVER
      ══════════════════════════════════════════════════════ */}
      {isGameOver && (
        <main className="min-h-screen flex flex-col items-center justify-center p-8" style={{ background: 'var(--bg)' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl"
          >
            {/* Title */}
            <div className="text-center mb-10">
              <p className="section-label mb-3" style={{ color: 'rgba(212,168,83,0.5)', letterSpacing: '0.35em' }}>SISTEMA FINALIZADO</p>
              <h1 className={`${playfair.className} text-6xl text-glow-gold`} style={{ color: '#d4a853' }}>
                {alivePlayers[0]?.name}
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'rgba(200,208,218,0.4)' }}>sobreviveu ao Mercado Negro</p>
            </div>

            {/* Podium */}
            <div className="cyber-card p-6 mb-6" style={{ borderColor: 'rgba(212,168,83,0.2)' }}>
              <p className="section-label mb-4" style={{ letterSpacing: '0.2em' }}>— classificação final —</p>
              <div className="flex flex-col gap-2">
                {podium.map((p, idx) => {
                  const medals = ['🥇', '🥈', '🥉'];
                  const medal = medals[idx] || `#${idx + 1}`;
                  const isWinner = idx === 0;
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between px-4 py-3 rounded"
                      style={{
                        background: isWinner ? 'rgba(212,168,83,0.08)' : 'var(--bg)',
                        border: isWinner ? '1px solid rgba(212,168,83,0.25)' : '1px solid rgba(255,255,255,0.04)',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">{medal}</span>
                        <span
                          className="font-bold"
                          style={{
                            fontFamily: 'var(--font-ui)',
                            fontSize: isWinner ? 18 : 15,
                            color: isWinner ? '#d4a853' : 'rgba(200,208,218,0.7)',
                          }}
                        >
                          {p.name}
                        </span>
                      </div>
                      <span className="mono text-sm" style={{ color: isWinner ? '#d4a853' : 'rgba(200,208,218,0.4)' }}>
                        {p.hp > 0 ? `${p.hp} HP` : 'eliminado'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Game log */}
            {room?.game_log?.length > 0 && (
              <div className="cyber-card mb-8" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                <div
                  className="flex items-center justify-between px-4 py-2.5"
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: '#ff3b30' }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: '#ffcc00' }} />
                      <span className="w-2 h-2 rounded-full" style={{ background: '#00ca4e' }} />
                    </div>
                    <span className="section-label" style={{ letterSpacing: '0.2em' }}>LOG DA PARTIDA</span>
                  </div>
                  <span className="section-label mono">{room.game_log.length} events</span>
                </div>
                <div
                  className="px-4 py-3 max-h-48 overflow-y-auto flex flex-col gap-0.5"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {room.game_log.map((log: string, idx: number) => {
                    const isRed    = log.includes('💥') || log.includes('💀') || log.includes('DANO') || log.includes('ELIMINADO');
                    const isPurple = log.includes('🦠') || log.includes('congelado');
                    const isGold   = log.includes('Mercado') || log.includes('Rodada') || log.includes('partida');
                    const isGreen  = log.includes('craftou') || log.includes('Firewall');
                    const color = isRed ? '#ff4444' : isPurple ? '#cc44ff' : isGold ? '#d4a853' : isGreen ? '#00ff88' : 'rgba(200,208,218,0.5)';
                    return (
                      <div key={idx} className="terminal-line" style={{ color, fontSize: 11 }}>{log}</div>
                    );
                  })}
                </div>
              </div>
            )}

            <button onClick={handleReturnToLobby} disabled={isProcessing} className="btn-primary w-full">
              Nova Partida
            </button>
          </motion.div>
        </main>
      )}

      {/* ══════════════════════════════════════════════════════
          LOBBY
      ══════════════════════════════════════════════════════ */}
      {currentStatus === 'lobby' && !isGameOver && (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 relative" style={{ background: 'var(--bg)' }}>
          {/* Top nav */}
          <div className="absolute top-6 left-6 flex gap-2">
            <button onClick={handleQuit} className="section-label px-4 py-2 rounded border transition-colors" style={{ borderColor: 'rgba(255,51,51,0.3)', color: '#ff4444' }}>Sair</button>
            <button onClick={() => { handleMenuClick(); setShowGuide(true); }} className="section-label px-4 py-2 rounded border transition-colors" style={{ borderColor: 'rgba(212,168,83,0.3)', color: '#d4a853' }}>Guia Hacker</button>
            <button onClick={() => { handleMenuClick(); setShowRules(true); }} className="section-label px-4 py-2 rounded border transition-colors" style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa' }}>Regras</button>
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            className="cyber-card corner-tl corner-br max-w-md w-full p-8 text-center mt-10"
            style={{ boxShadow: '0 0 40px rgba(0,0,0,0.8)' }}
          >
            <p className="section-label mb-2" style={{ letterSpacing: '0.25em' }}>Código da Sala</p>
            <h1 className={`${playfair.className} text-5xl mb-8 text-glow-gold`} style={{ color: '#d4a853' }}>
              {room.code.toUpperCase()}
            </h1>

            <div className="flex flex-col gap-2.5 mb-8">
              <h3 className="section-label text-left pb-2 mb-1" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', letterSpacing: '0.2em' }}>
                Jogadores ({players.length})
              </h3>
              {players.map(p => {
                const isOff = !onlineUsers.includes(p.id) && p.id !== me.id;
                return (
                  <div key={p.id} className="flex justify-between items-center rounded-[4px] px-3 py-2.5" style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div className="flex items-center gap-2">
                      {!isOff
                        ? <span className="w-1.5 h-1.5 rounded-full bg-green-500" style={{ boxShadow: '0 0 5px rgba(34,197,94,0.8)' }} />
                        : <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                      <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-ui)', color: p.id === me.id ? '#d4a853' : '#c8d0da' }}>
                        {p.name} {p.id === me.id && <span className="section-label ml-1">YOU</span>}
                      </span>
                    </div>
                    <span
                      className="section-label px-2 py-0.5 rounded"
                      style={{
                        background: p.is_ready ? 'rgba(34,197,94,0.1)' : 'rgba(255,255,255,0.04)',
                        color: p.is_ready ? '#22c55e' : 'rgba(200,208,218,0.35)',
                        letterSpacing: '0.15em'
                      }}
                    >
                      {p.is_ready ? 'PRONTO' : 'AGUARD.'}
                    </span>
                    {isOff && p.id !== me.id && (
                      <button onClick={() => handleKickOffline(p)} className="section-label px-2 py-0.5 rounded ml-2" style={{ color: '#ff4444', border: '1px solid rgba(255,68,68,0.3)' }}>
                        KICK
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <button
              onClick={handleToggleReady}
              disabled={isProcessing}
              className={`btn-ready ${me.is_ready ? 'is-ready' : ''}`}
            >
              {isProcessing ? '...' : me.is_ready ? 'Cancelar Pronto' : 'Estou Pronto'}
            </button>
          </motion.div>
        </main>
      )}

      {/* ══════════════════════════════════════════════════════
          CRAFTING / SHOP
      ══════════════════════════════════════════════════════ */}
      {currentStatus === 'crafting' && !isGameOver && (
        <main className="min-h-screen p-6 md:p-12 flex flex-col items-center" style={{ background: 'var(--bg)' }}>
          {/* Top nav */}
          <div className="absolute top-6 left-6 flex gap-2">
            <button onClick={() => { handleMenuClick(); setShowGuide(true); }} className="section-label px-4 py-2 rounded border" style={{ borderColor: 'rgba(212,168,83,0.3)', color: '#d4a853' }}>Guia Hacker</button>
          </div>

          <div className="w-full max-w-4xl">
            {/* Header */}
            <div
              className="flex justify-between items-end mb-10 pb-6 mt-12 md:mt-0"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
            >
              <div>
                <p className="section-label mb-1" style={{ color: 'rgba(212,168,83,0.6)', letterSpacing: '0.2em' }}>
                  Fim da Rodada {room.round_count}
                </p>
                <h1 className={`${playfair.className} text-4xl`} style={{ color: '#e8edf2' }}>
                  Mercado Negro
                </h1>
              </div>
              <div className="cyber-card px-5 py-3 flex items-center gap-4">
                <span className="section-label" style={{ letterSpacing: '0.2em' }}>Cofre:</span>
                <span className="mono font-bold text-sm" style={{ color: '#00ff88' }}>{me.greens} PCB</span>
                <span className="mono font-bold text-sm" style={{ color: '#00aaff' }}>{me.blues} BLUE</span>
                <span className="mono font-bold text-sm" style={{ color: '#eab308' }}>{me.batteries} BAT</span>
              </div>
            </div>

            {me.has_finished_crafting ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-10 h-10 border border-[#d4a853] border-t-transparent rounded-full animate-spin mb-6" />
                <h2 className={`${playfair.className} text-2xl mb-2`} style={{ color: 'rgba(212,168,83,0.8)' }}>Transações Concluídas</h2>
                <p className="section-label" style={{ letterSpacing: '0.15em' }}>Aguardando os outros operadores...</p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm mb-8" style={{ color: 'rgba(200,208,218,0.4)' }}>
                  Gaste seus recursos. Itens irão para o seu inventário para uso futuro.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
                  {SHOP_ITEMS.filter(i => (me.shop_slots || []).includes(i.id)).map((item, i) => (
                    <ShopCard
                      key={i}
                      itemId={item.id}
                      myGreens={me.greens}
                      myBlues={me.blues}
                      myYellows={me.batteries}
                      onBuy={handleBuyItem}
                      isProcessing={isProcessing}
                    />
                  ))}
                </div>
                <div className="flex justify-center">
                  <button
                    onClick={() => handleFinishCrafting(false)}
                    disabled={isProcessing}
                    className="btn-secondary px-16"
                  >
                    Sair da Loja
                  </button>
                </div>
              </>
            )}
          </div>
        </main>
      )}

      {/* ══════════════════════════════════════════════════════
          PLAYING
      ══════════════════════════════════════════════════════ */}
      {currentStatus === 'playing' && !isGameOver && (
        <main className="min-h-screen p-5 md:p-10" style={{ background: 'var(--bg)' }}>
          {/* Header */}
          <header
            className="max-w-5xl mx-auto flex items-end justify-between pb-5 mb-8"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div>
              <p className="section-label mb-1" style={{ color: 'rgba(212,168,83,0.5)', letterSpacing: '0.2em' }}>
                Rodada {room.round_count}
              </p>
              <div className="flex items-center gap-4 flex-wrap">
                <h1 className={`${playfair.className} text-3xl`} style={{ color: '#e8edf2' }}>
                  Sala <em style={{ color: '#d4a853' }}>{room.code.toUpperCase()}</em>
                </h1>
                <div className="flex gap-2">
                  <button onClick={handleQuit} className="section-label px-3 py-1 rounded border" style={{ borderColor: 'rgba(255,51,51,0.3)', color: '#ff4444' }}>Sair</button>
                  <button onClick={() => { handleMenuClick(); setShowGuide(true); }} className="section-label px-3 py-1 rounded border" style={{ borderColor: 'rgba(212,168,83,0.3)', color: '#d4a853' }}>Guia</button>
                  <button onClick={() => { handleMenuClick(); setShowRules(true); }} className="section-label px-3 py-1 rounded border" style={{ borderColor: 'rgba(59,130,246,0.3)', color: '#60a5fa' }}>Regras</button>
                </div>
              </div>
            </div>

            {/* Bag */}
            <div className="text-right">
              <p className="section-label mb-2" style={{ letterSpacing: '0.15em' }}>Saco de Risco</p>
              <div className="flex gap-4">
                <span className="bag-item" style={{ color: '#00ff88' }}>{room.bag_greens}<span className="section-label ml-1">V</span></span>
                <span className="bag-item" style={{ color: '#00aaff' }}>{room.bag_blues}<span className="section-label ml-1">A</span></span>
                <span className="bag-item" style={{ color: '#eab308' }}>{room.bag_batteries}<span className="section-label ml-1">B</span></span>
                <span className="bag-item" style={{ color: '#ff4444' }}>{room.bag_reds}<span className="section-label ml-1">C</span></span>
                <span className="bag-item" style={{ color: '#cc44ff' }}>{room.bag_viruses}<span className="section-label ml-1">Vi</span></span>
              </div>
            </div>
          </header>

          {/* Main grid */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Action area */}
            <motion.div
              className="md:col-span-2 cyber-card flex flex-col items-center justify-center min-h-[380px] p-8"
              animate={isMyTurn
                ? { borderColor: ['rgba(212,168,83,0.4)', 'rgba(212,168,83,0.9)', 'rgba(212,168,83,0.4)'] }
                : { borderColor: 'rgba(255,255,255,0.06)' }}
              transition={isMyTurn ? { repeat: Infinity, duration: 2 } : {}}
              style={{
                boxShadow: isMyTurn ? '0 0 30px rgba(212,168,83,0.12)' : 'none',
                opacity: !isMyTurn ? 0.7 : 1,
              }}
            >
              {amIDead ? (
                <div className="text-center">
                  <h2 className={`${playfair.className} text-4xl text-red-500 mb-3 text-glow-red`}>Eliminado</h2>
                  <p className="section-label" style={{ letterSpacing: '0.2em' }}>aguardando o fim da partida...</p>
                </div>
              ) : (
                <>
                  <p className="section-label mb-2" style={{ color: 'rgba(200,208,218,0.3)', letterSpacing: '0.2em' }}>
                    {isMyTurn ? '— sua vez —' : `— turno de ${activePlayer?.name || '...'} —`}
                  </p>
                  <h2
                    className={`${playfair.className} text-3xl mb-6`}
                    style={{ color: isMyTurn ? '#d4a853' : '#c8d0da', textShadow: isMyTurn ? '0 0 20px rgba(212,168,83,0.4)' : 'none' }}
                  >
                    {isMyTurn ? 'Sua Vez' : activePlayer?.name || '...'}
                  </h2>

                  {/* Current turn stats */}
                  {activePlayer && (
                    <div
                      className="flex gap-3 mb-8 p-4 rounded-lg"
                      style={{ background: 'var(--bg)', border: '1px solid rgba(255,255,255,0.04)' }}
                    >
                      <div className="stat-chip">
                        <span className="stat-val" style={{ color: '#00ff88' }}>{activePlayer.turn_greens}</span>
                        <span className="stat-lbl">PCB</span>
                      </div>
                      <div className="stat-chip">
                        <span className="stat-val" style={{ color: '#00aaff' }}>{activePlayer.turn_blues}</span>
                        <span className="stat-lbl">Blue</span>
                      </div>
                      <div className="stat-chip">
                        <span className="stat-val" style={{ color: '#eab308' }}>{activePlayer.turn_batteries}</span>
                        <span className="stat-lbl">Bat</span>
                      </div>
                      <div className="stat-chip">
                        <span
                          className="stat-val"
                          style={{
                            color: activePlayer.reds_in_turn > 0 ? '#ff4444' : 'rgba(255,68,68,0.2)',
                            textShadow: activePlayer.reds_in_turn > 0 ? '0 0 8px rgba(255,68,68,0.8)' : 'none',
                          }}
                        >
                          {activePlayer.reds_in_turn}/2
                        </span>
                        <span className="stat-lbl">Curto</span>
                      </div>
                      <div className="stat-chip">
                        <span
                          className="stat-val"
                          style={{
                            color: activePlayer.viruses_in_turn > 0 ? '#cc44ff' : 'rgba(204,68,255,0.2)',
                            textShadow: activePlayer.viruses_in_turn > 0 ? '0 0 8px rgba(204,68,255,0.8)' : 'none',
                          }}
                        >
                          {activePlayer.viruses_in_turn}/2
                        </span>
                        <span className="stat-lbl">Vírus</span>
                      </div>
                    </div>
                  )}

                  {isMyTurn && (
                    <div className="flex flex-col gap-3 w-full max-w-sm">
                      <div className="flex gap-3">
                        <button
                          onClick={handleDraw}
                          disabled={isProcessing}
                          className="btn-primary flex-1"
                        >
                          Sacar Item
                        </button>
                        <button
                          onClick={handlePassTurn}
                          disabled={me?.forced_draws > 0 || isProcessing}
                          className="btn-secondary flex-1"
                        >
                          Passar Vez
                        </button>
                      </div>
                      {me?.forced_draws > 0 && (
                        <motion.div
                          animate={{ opacity: [0.7, 1, 0.7] }}
                          transition={{ repeat: Infinity, duration: 0.7 }}
                          className="text-center py-2 rounded"
                          style={{ background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.25)', color: '#ff4444' }}
                        >
                          <span className="section-label" style={{ letterSpacing: '0.15em' }}>
                            ⚠ SAQUES OBRIGATÓRIOS: {me.forced_draws}
                          </span>
                        </motion.div>
                      )}
                    </div>
                  )}
                </>
              )}
            </motion.div>

            {/* Right column: players + terminal */}
            <div className="flex flex-col gap-3">
              {targetingItem && (
                <motion.div
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="text-center py-3 rounded"
                  style={{ background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.4)', color: '#ff4444' }}
                >
                  <span className="section-label" style={{ letterSpacing: '0.2em' }}>⊕ SELECIONE O ALVO</span>
                </motion.div>
              )}

              {players.map((p) => {
                const pIsActive  = room?.current_turn_player_id === p.id;
                const pIsDead    = p.hp <= 0;
                const isOffline  = !onlineUsers.includes(p.id) && p.id !== me.id;
                const isTargetable = !!(targetingItem && p.id !== me.id && !pIsDead);
                const isDamaged  = damagedPlayer === p.id;

                return (
                  <div
                    key={p.id}
                    className={isDamaged ? 'red-flash' : ''}
                  >
                    <PlayerPanel
                      player={p}
                      meId={me.id}
                      isActive={pIsActive}
                      isDead={pIsDead}
                      isOffline={isOffline}
                      targetingItem={targetingItem}
                      isTargetable={isTargetable}
                      onTarget={handleUseItem}
                      onItemClick={handleItemClick}
                      isProcessing={isProcessing}
                      isMyTurn={isMyTurn}
                    />
                    {isOffline && !pIsDead && (
                      <button
                        onClick={() => handleKickOffline(p)}
                        disabled={isProcessing}
                        className="w-full mt-1 py-1.5 rounded section-label transition-colors"
                        style={{ background: 'rgba(255,51,51,0.06)', border: '1px solid rgba(255,51,51,0.25)', color: '#ff4444', letterSpacing: '0.2em' }}
                      >
                        ⊘ EXPULSAR {p.name.toUpperCase()}
                      </button>
                    )}
                  </div>
                );
              })}

              <TerminalLog logs={room?.game_log || []} />
            </div>
          </div>
        </main>
      )}
    </motion.div>
  );
}
