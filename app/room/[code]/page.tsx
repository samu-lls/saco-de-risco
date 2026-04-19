// @ts-nocheck
/* eslint-disable */
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Playfair_Display, Inter } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"] });

// ==========================================
// BANCO DE DADOS DE ITENS (MERCADO NEGRO)
// ==========================================
const SHOP_ITEMS = [
  { id: 'firewall', name: 'Firewall', type: 'defense', cost: { green: 2, blue: 1, yellow: 0 }, desc: 'Absorve 1 Dano letal ou ataque inimigo e quebra.' },
  { id: 'patch', name: 'Patch de Seg.', type: 'heal', cost: { green: 0, blue: 1, yellow: 2 }, desc: 'Recupera +1 HP instantaneamente.' },
  { id: 'vpn', name: 'VPN', type: 'utility', cost: { green: 0, blue: 1, yellow: 1 }, desc: 'Pula seu turno imediatamente com segurança.' },
  { id: 'trojan', name: 'Trojan', type: 'attack', cost: { green: 1, blue: 1, yellow: 1 }, desc: 'Força um alvo a sacar 3 vezes no turno dele.' },
  { id: 'phishing', name: 'Phishing', type: 'attack', cost: { green: 2, blue: 1, yellow: 0 }, desc: 'Rouba 2 itens do cofre de um inimigo.' },
  { id: 'reboot', name: 'Reboot', type: 'utility', cost: { green: 0, blue: 1, yellow: 1 }, desc: 'Devolve 2 Curtos/Vírus da sua mão pro Saco.' },
  { id: 'zeroday', name: 'Zero-Day', type: 'fatal', cost: { green: 0, blue: 2, yellow: 3 }, desc: 'Retira 1 HP do alvo instantaneamente.' },
  { id: 'ddos', name: 'DDoS Automático', type: 'fatal', cost: { green: 2, blue: 2, yellow: 1 }, desc: 'Aplica +2 Saques Obrigatórios em TODOS.' }
];

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params?.code || "");

  const hasInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [me, setMe] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [targetingItem, setTargetingItem] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    const playerName = localStorage.getItem("playerName");
    if (!playerName) { router.push("/"); return; }

    const initGame = async () => {
      try {
        let { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle();
        if (roomError) throw new Error("Erro ao buscar sala: " + roomError.message);
        if (!roomData) {
          const { data: newRoom, error: insertRoomError } = await supabase.from("rooms").insert({ 
            code: roomCode, status: 'lobby', bag_greens: 15, bag_blues: 10, bag_reds: 5, bag_batteries: 15, bag_viruses: 5
          }).select().single();
          if (insertRoomError) throw new Error("Erro ao criar sala.");
          roomData = newRoom;
        }
        
        let { data: playerData, error: playerError } = await supabase.from("players").select("*").eq("room_id", roomData.id).eq("name", playerName).maybeSingle();
        if (playerError) throw new Error("Erro de dados duplicados. Limpe o banco.");

        if (!playerData) {
          if ((roomData.status || 'lobby') !== 'lobby') {
            alert("Partida em andamento!"); router.push("/"); return;
          }
          const { data: newPlayer, error: insertPlayerError } = await supabase.from("players").insert({
            room_id: roomData.id, name: playerName, is_ready: false, inventory: [], shop_slots: []
          }).select().single();
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

  // ==========================================
  // LÓGICA DE GERENCIAMENTO
  // ==========================================
  const handleQuit = async () => {
    if (!window.confirm("Tem certeza que deseja sair?")) return;
    setIsProcessing(true);
    try {
      if (room.status === 'lobby') {
        await supabase.from("players").delete().eq("id", me.id);
        router.push("/"); return;
      }
      if (room.current_turn_player_id === me.id && room.status === 'playing') {
        await supabase.from("rooms").update({
          bag_greens: room.bag_greens + me.turn_greens, bag_blues: room.bag_blues + me.turn_blues, bag_batteries: room.bag_batteries + me.turn_batteries, bag_reds: room.bag_reds + me.reds_in_turn, bag_viruses: room.bag_viruses + me.viruses_in_turn
        }).eq("id", room.id);
        const nextPlayer = getNextAlivePlayer(me.id);
        if (nextPlayer) await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
      }
      await supabase.from("players").update({ hp: 0 }).eq("id", me.id);
      router.push("/");
    } catch (e) { setIsProcessing(false); }
  };

  const handleKickOffline = async (targetPlayer: any) => {
    if (!window.confirm(`Eliminar ${targetPlayer.name}?`)) return;
    setIsProcessing(true);
    try {
      if (room.current_turn_player_id === targetPlayer.id && room.status === 'playing') {
        await supabase.from("rooms").update({
          bag_greens: room.bag_greens + targetPlayer.turn_greens, bag_blues: room.bag_blues + targetPlayer.turn_blues, bag_batteries: room.bag_batteries + targetPlayer.turn_batteries, bag_reds: room.bag_reds + targetPlayer.reds_in_turn, bag_viruses: room.bag_viruses + targetPlayer.viruses_in_turn
        }).eq("id", room.id);
        const nextPlayer = getNextAlivePlayer(targetPlayer.id);
        if (nextPlayer) await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
      }
      await supabase.from("players").update({ hp: 0 }).eq("id", targetPlayer.id);
    } finally { setIsProcessing(false); }
  };

  const handleReturnToLobby = async () => {
    setIsProcessing(true);
    try {
      await supabase.from("rooms").update({ status: 'lobby', bag_greens: 15, bag_blues: 10, bag_batteries: 15, bag_reds: 5, bag_viruses: 5, current_turn_player_id: null, round_count: 1 }).eq("id", room.id);
      for (const p of players) {
        await supabase.from("players").update({ hp: 3, greens: 0, blues: 0, batteries: 0, turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0, forced_draws: 0, is_ready: false, inventory: [], shop_slots: [], has_finished_crafting: false }).eq("id", p.id);
      }
    } finally { setIsProcessing(false); }
  };

  const isMyTurn = room?.current_turn_player_id === me?.id && room?.status === 'playing';
  const amIDead = me?.hp <= 0;
  
  const getNextAlivePlayer = (baseId = me.id) => {
    const baseIndex = players.findIndex(p => p.id === baseId);
    for (let i = 1; i < players.length; i++) {
      const nextP = players[(baseIndex + i) % players.length];
      if (nextP.hp > 0 && nextP.id !== baseId) return nextP;
    }
    return null;
  };

  const alivePlayers = players.filter(p => p.hp > 0);
  const isGameOver = alivePlayers.length === 1 && players.length > 1 && room?.status !== 'lobby';
  const activePlayer = players.find(p => p.id === room?.current_turn_player_id);

  // ==========================================
  // SISTEMA DE ITENS E COMBATE
  // ==========================================
  const handleItemClick = (itemId: string) => {
    const itemDef = SHOP_ITEMS.find(i => i.id === itemId);
    if (itemDef?.type === 'defense') return; 
    
    if (itemDef?.type === 'attack' || itemId === 'zeroday') {
      setTargetingItem(targetingItem === itemId ? null : itemId);
    } else {
      handleUseItem(itemId);
    }
  };

  const handleUseItem = async (itemId: string, targetId: string | null = null) => {
    if (isProcessing) return;
    setIsProcessing(true);
    setTargetingItem(null); 

    try {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      const { data: dbMe } = await supabase.from("players").select("*").eq("id", me.id).single();

      const invIdx = dbMe.inventory.indexOf(itemId);
      if (invIdx === -1) throw new Error("Item não encontrado no inventário.");

      let updatedMyInv = [...dbMe.inventory];
      updatedMyInv.splice(invIdx, 1);

      let targetDb = null;
      if (targetId) {
        const { data: t } = await supabase.from("players").select("*").eq("id", targetId).single();
        targetDb = t;
      }

      if (itemId === 'patch') {
        await supabase.from("players").update({ hp: dbMe.hp + 1, inventory: updatedMyInv }).eq("id", me.id);
        alert("🔧 Patch aplicado! +1 HP.");
      
      } else if (itemId === 'vpn') {
        const nextPlayer = getNextAlivePlayer(me.id);
        await supabase.from("rooms").update({
            bag_reds: dbRoom.bag_reds + dbMe.reds_in_turn, bag_viruses: dbRoom.bag_viruses + dbMe.viruses_in_turn, current_turn_player_id: nextPlayer.id
        }).eq("id", room.id);
        await supabase.from("players").update({
            greens: dbMe.greens + dbMe.turn_greens, blues: dbMe.blues + dbMe.turn_blues, batteries: dbMe.batteries + dbMe.turn_batteries,
            turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0, forced_draws: 0, inventory: updatedMyInv
        }).eq("id", me.id);
        alert("🛡️ VPN ativada! Turno pulado com segurança.");
      
      } else if (itemId === 'reboot') {
        let returnedReds = Math.min(2, dbMe.reds_in_turn);
        let returnedViruses = Math.min(2 - returnedReds, dbMe.viruses_in_turn);
        if (returnedReds === 0 && returnedViruses === 0) {
            alert("Você não tem Curtos ou Vírus em mãos para devolver.");
            setIsProcessing(false); return;
        }
        await supabase.from("rooms").update({ bag_reds: dbRoom.bag_reds + returnedReds, bag_viruses: dbRoom.bag_viruses + returnedViruses }).eq("id", room.id);
        await supabase.from("players").update({ reds_in_turn: dbMe.reds_in_turn - returnedReds, viruses_in_turn: dbMe.viruses_in_turn - returnedViruses, inventory: updatedMyInv }).eq("id", me.id);
        alert("🔄 Reboot concluído! Ameaças devolvidas ao Saco.");

      } else if (itemId === 'trojan' && targetDb) {
        await supabase.from("players").update({ forced_draws: targetDb.forced_draws + 3 }).eq("id", targetId);
        await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
        alert(`🐴 Trojan enviado! ${targetDb.name} sacará +3 itens obrigatórios.`);

      } else if (itemId === 'phishing' && targetDb) {
        let pool = [];
        for(let i=0; i<targetDb.greens; i++) pool.push('green');
        for(let i=0; i<targetDb.blues; i++) pool.push('blue');
        for(let i=0; i<targetDb.batteries; i++) pool.push('yellow');
        
        let stolen = { green: 0, blue: 0, yellow: 0 };
        for(let i=0; i<2; i++) {
            if (pool.length > 0) {
                let r = Math.floor(Math.random() * pool.length);
                stolen[pool[r]]++;
                pool.splice(r, 1);
            }
        }
        await supabase.from("players").update({ greens: targetDb.greens - stolen.green, blues: targetDb.blues - stolen.blue, batteries: targetDb.batteries - stolen.yellow }).eq("id", targetId);
        await supabase.from("players").update({ greens: dbMe.greens + stolen.green, blues: dbMe.blues + stolen.blue, batteries: dbMe.batteries + stolen.yellow, inventory: updatedMyInv }).eq("id", me.id);
        alert(`🎣 Phishing com sucesso! Você roubou materiais de ${targetDb.name}.`);

      } else if (itemId === 'zeroday' && targetDb) {
        let targetInv = [...(targetDb.inventory || [])];
        const fwIdx = targetInv.indexOf('firewall');
        if (fwIdx > -1) {
            targetInv.splice(fwIdx, 1);
            await supabase.from("players").update({ inventory: targetInv }).eq("id", targetId);
            alert(`O ataque falhou! O Firewall de ${targetDb.name} bloqueou o seu Zero-Day.`);
        } else {
            await supabase.from("players").update({ hp: targetDb.hp - 1 }).eq("id", targetId);
            alert(`☠️ Zero-Day executado! ${targetDb.name} perdeu 1 HP.`);
        }
        await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);

      } else if (itemId === 'ddos') {
        const { data: allPlayers } = await supabase.from("players").select("*").eq("room_id", room.id);
        for(const p of allPlayers) {
            if (p.id !== me.id && p.hp > 0) {
                await supabase.from("players").update({ forced_draws: p.forced_draws + 2 }).eq("id", p.id);
            }
        }
        await supabase.from("players").update({ inventory: updatedMyInv }).eq("id", me.id);
        alert("🌐 Ataque DDoS! Todos os inimigos receberam +2 Saques Obrigatórios.");
      }
    } catch (err) {
      console.error(err);
    } finally { setIsProcessing(false); }
  };

  // ==========================================
  // MOTOR DE JOGO (DRAW & PASS BLINDADOS)
  // ==========================================
  const handleDraw = async () => {
    if (!isMyTurn || amIDead || isGameOver || isProcessing) return;
    setIsProcessing(true);
    try {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      const { data: dbMe } = await supabase.from("players").select("*").eq("id", me.id).single();

      const totalInBag = dbRoom.bag_greens + dbRoom.bag_blues + dbRoom.bag_reds + dbRoom.bag_batteries + dbRoom.bag_viruses;
      if (totalInBag <= 0) return alert("Saco vazio!");

      let currentHp = dbMe.hp;
      const roll = Math.random() * totalInBag;
      
      let newBagGreens = dbRoom.bag_greens, newBagBlues = dbRoom.bag_blues, newBagReds = dbRoom.bag_reds;
      let newBagBatteries = dbRoom.bag_batteries, newBagViruses = dbRoom.bag_viruses;
      let newTurnGreens = dbMe.turn_greens, newTurnBlues = dbMe.turn_blues, newRedsInTurn = dbMe.reds_in_turn;
      let newTurnBatteries = dbMe.turn_batteries, newVirusesInTurn = dbMe.viruses_in_turn;
      let newForcedDraws = Math.max(0, dbMe.forced_draws - 1);
      
      let isExplosion = false, isVirusSkip = false;

      if (roll < newBagGreens) { newBagGreens--; newTurnGreens++; }
      else if (roll < newBagGreens + newBagBlues) { newBagBlues--; newTurnBlues++; }
      else if (roll < newBagGreens + newBagBlues + newBagBatteries) { newBagBatteries--; newTurnBatteries++; }
      else if (roll < newBagGreens + newBagBlues + newBagBatteries + newBagViruses) { 
        newBagViruses--; newVirusesInTurn++;
        if (newVirusesInTurn >= 2) isVirusSkip = true;
      } else {
        newBagReds--; newRedsInTurn++;
        if (newRedsInTurn >= 2) { isExplosion = true; currentHp--; }
      }

      let updatedMyInv = [...(dbMe.inventory || [])];
      let firewallTriggered = false;

      if (isExplosion) {
        const fwIdx = updatedMyInv.indexOf('firewall');
        if (fwIdx > -1) {
            updatedMyInv.splice(fwIdx, 1);
            currentHp++; 
            firewallTriggered = true;
        }
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
            alert("🔥 FIREWALL ATIVADO! Você perdeu a mão para o Curto, mas o Firewall salvou seu HP.");
            await executePassTurn(true);
        } else {
            alert("💥 CURTO-CIRCUITO! Você perdeu 1 HP e a mão.");
            if (currentHp <= 0) {
               const nextP = getNextAlivePlayer();
               if (nextP) await checkRoundAndPass(nextP);
            } else { await executePassTurn(true); }
        }
      } else if (isVirusSkip) {
        alert("🦠 VÍRUS! Turno perdido. Mão devolvida ao saco.");
        await executePassTurn(true);
      }
    } finally { setIsProcessing(false); }
  };

  const handlePassTurn = async () => {
    if (!isMyTurn || amIDead || isGameOver || isProcessing) return;
    setIsProcessing(true);
    try { await executePassTurn(false); } finally { setIsProcessing(false); }
  };

  const executePassTurn = async (isFromExplosion = false) => {
    const { data: dbMe } = await supabase.from("players").select("*").eq("id", me.id).single();
    if (!isFromExplosion && dbMe.forced_draws > 0) { alert(`Faltam ${dbMe.forced_draws} saques!`); return; }

    const nextPlayer = getNextAlivePlayer();
    if (!nextPlayer) return;

    if (!isFromExplosion) {
      const { data: dbRoom } = await supabase.from("rooms").select("*").eq("id", room.id).single();
      await supabase.from("rooms").update({ bag_reds: dbRoom.bag_reds + dbMe.reds_in_turn, bag_viruses: dbRoom.bag_viruses + dbMe.viruses_in_turn }).eq("id", room.id);
      await supabase.from("players").update({ 
        greens: dbMe.greens + dbMe.turn_greens, blues: dbMe.blues + dbMe.turn_blues, batteries: dbMe.batteries + dbMe.turn_batteries,
        turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0 
      }).eq("id", me.id);
    }
    
    await checkRoundAndPass(nextPlayer);
  };

  const checkRoundAndPass = async (nextPlayer: any) => {
    const myIndex = players.findIndex(p => p.id === me.id);
    const nextIndex = players.findIndex(p => p.id === nextPlayer.id);
    const isRoundOver = nextIndex <= myIndex;

    if (isRoundOver) {
      await supabase.from("rooms").update({ status: 'crafting', current_turn_player_id: nextPlayer.id }).eq("id", room.id);
    } else {
      await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
    }
  };

  // ==========================================
  // LÓGICA DO MERCADO NEGRO (CRAFTING)
  // ==========================================
  const handleToggleReady = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      const newReadyState = !me.is_ready;
      await supabase.from("players").update({ is_ready: newReadyState }).eq("id", me.id);
      const updatedPlayers = players.map(p => p.id === me.id ? { ...p, is_ready: newReadyState } : p);
      const allReady = updatedPlayers.length > 1 && updatedPlayers.every(p => p.is_ready);
      if (allReady && room.status === 'lobby') {
        const firstPlayer = updatedPlayers[0];
        await supabase.from("rooms").update({ status: 'playing', current_turn_player_id: firstPlayer.id, round_count: 1 }).eq("id", room.id);
      } else if (updatedPlayers.length === 1 && newReadyState) {
        alert("Aguarde mais jogadores.");
        await supabase.from("players").update({ is_ready: false }).eq("id", me.id);
      }
    } finally { setIsProcessing(false); }
  };

  useEffect(() => {
    if (room?.status === 'crafting' && me && !me.has_finished_crafting && (!me.shop_slots || me.shop_slots.length === 0)) {
      const shuffled = [...SHOP_ITEMS].sort(() => 0.5 - Math.random());
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
      
      await supabase.from("players").update({
        greens: me.greens - item.cost.green, blues: me.blues - item.cost.blue, batteries: me.batteries - item.cost.yellow,
        inventory: newInventory, shop_slots: newShopSlots
      }).eq("id", me.id);
    } finally { setIsProcessing(false); }
  };

  const handleFinishCrafting = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      await supabase.from("players").update({ has_finished_crafting: true }).eq("id", me.id);

      const updatedPlayers = players.map(p => p.id === me.id ? { ...p, has_finished_crafting: true } : p);
      const aliveP = updatedPlayers.filter(p => p.hp > 0);
      const allFinished = aliveP.every(p => p.has_finished_crafting);

      if (allFinished) {
        await supabase.from("rooms").update({ status: 'playing', round_count: room.round_count + 1 }).eq("id", room.id);
        for (const p of aliveP) {
          await supabase.from("players").update({ has_finished_crafting: false, shop_slots: [] }).eq("id", p.id);
        }
      }
    } finally { setIsProcessing(false); }
  };

  // ==========================================
  // RENDERIZAÇÃO DAS TELAS
  // ==========================================
  if (loading) return <div className={`min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[rgba(255,255,255,0.5)] ${inter.className}`}>Conectando...</div>;
  if (errorMsg || !room || !me) return <div className="text-white text-center mt-20">{errorMsg || "Erro."}</div>;

  const currentStatus = room.status || 'lobby';

  // ==========================================
  // TELA 1: LOBBY
  // ==========================================
  if (currentStatus === 'lobby') {
    return (
      <main className={`min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 flex flex-col items-center justify-center relative ${inter.className}`}>
        <button onClick={handleQuit} className="absolute top-6 left-6 text-xs text-red-500 border border-red-500/30 px-4 py-2 rounded hover:bg-red-500/10 uppercase">Sair</button>
        <div className="max-w-md w-full bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-8 text-center mt-10">
          <p className="text-[11px] tracking-[0.08em] text-[rgba(255,255,255,0.4)] uppercase mb-2">Código da Sala</p>
          <h1 className={`${playfair.className} text-5xl text-[#d4a853] tracking-tight mb-8`}>{room.code}</h1>
          <div className="flex flex-col gap-3 mb-8">
            <h3 className="text-[13px] text-left text-[rgba(255,255,255,0.5)] border-b border-[rgba(255,255,255,0.07)] pb-2 mb-2">Jogadores ({players.length})</h3>
            {players.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-[6px] border border-[rgba(255,255,255,0.02)]">
                <span className="font-medium text-[15px]">{p.name}</span>
                <span className={`text-xs px-2 py-1 rounded-[4px] ${p.is_ready ? 'bg-green-900/30 text-green-500' : 'bg-[#111111] text-[rgba(255,255,255,0.4)]'}`}>{p.is_ready ? 'PRONTO' : 'AGUARDANDO'}</span>
              </div>
            ))}
          </div>
          <button onClick={handleToggleReady} disabled={isProcessing} className={`w-full h-[52px] font-medium text-[15px] rounded-[6px] transition-all ${me.is_ready ? 'bg-[#1a1a1a] text-white border border-[rgba(255,255,255,0.1)]' : 'bg-white text-[#0a0a0a]'}`}>
            {isProcessing ? 'Processando...' : (me.is_ready ? 'Cancelar Pronto' : 'Estou Pronto')}
          </button>
        </div>
      </main>
    );
  }

  // ==========================================
  // TELA 2.5: MERCADO NEGRO (CRAFTING)
  // ==========================================
  if (currentStatus === 'crafting') {
    const myShopItems = SHOP_ITEMS.filter(i => (me.shop_slots || []).includes(i.id));

    return (
      <main className={`min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 flex flex-col items-center ${inter.className}`}>
        <div className="w-full max-w-4xl flex justify-between items-center mb-10 border-b border-[rgba(255,255,255,0.07)] pb-6">
          <div>
            <p className="text-[11px] tracking-[0.08em] text-[#d4a853] uppercase mb-1">Fim da Rodada {room.round_count}</p>
            <h1 className={`${playfair.className} text-4xl text-white tracking-tight`}>Mercado Negro</h1>
          </div>
          <div className="flex gap-4 text-sm font-medium bg-[#111111] p-3 rounded-[6px] border border-[rgba(255,255,255,0.05)]">
            <span className="text-[rgba(255,255,255,0.4)] mr-2 text-xs uppercase tracking-widest mt-0.5">Seu Cofre:</span>
            <span className="text-green-500">{me.greens} PCB</span>
            <span className="text-blue-500">{me.blues} Blue</span>
            <span className="text-yellow-500">{me.batteries} Bat</span>
          </div>
        </div>

        {me.has_finished_crafting ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 border-2 border-[#d4a853] border-t-transparent rounded-full animate-spin mb-6"></div>
            <h2 className={`${playfair.className} text-2xl text-[rgba(255,255,255,0.8)]`}>Transações Concluídas</h2>
            <p className="text-[rgba(255,255,255,0.4)] mt-2">Aguardando os outros jogadores terminarem as compras...</p>
          </div>
        ) : (
          <div className="w-full max-w-4xl flex flex-col">
            <p className="text-[rgba(255,255,255,0.5)] mb-6 text-center">Gaste seus recursos para craftar hardwares ilegais. Eles ficarão no seu inventário para uso futuro.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              {myShopItems.map(item => {
                const canAfford = me.greens >= item.cost.green && me.blues >= item.cost.blue && me.batteries >= item.cost.yellow;
                
                return (
                  <div key={item.id} className="bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-6 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-medium text-lg text-[#d4a853]">{item.name}</h3>
                      <span className="text-[10px] uppercase tracking-widest bg-[#0a0a0a] px-2 py-1 rounded text-[rgba(255,255,255,0.5)]">{item.type}</span>
                    </div>
                    
                    <p className="text-sm text-[rgba(255,255,255,0.7)] flex-1 min-h-[60px] leading-relaxed">{item.desc}</p>
                    
                    <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)]">
                      <p className="text-[10px] uppercase tracking-widest text-[rgba(255,255,255,0.4)] mb-2">Custo de Fabricação</p>
                      <div className="flex gap-3 text-sm font-medium mb-6">
                        {item.cost.green > 0 && <span className={me.greens >= item.cost.green ? 'text-green-500' : 'text-green-900'}>{item.cost.green} PCB</span>}
                        {item.cost.blue > 0 && <span className={me.blues >= item.cost.blue ? 'text-blue-500' : 'text-blue-900'}>{item.cost.blue} Blue</span>}
                        {item.cost.yellow > 0 && <span className={me.batteries >= item.cost.yellow ? 'text-yellow-500' : 'text-yellow-900'}>{item.cost.yellow} Bat</span>}
                      </div>
                      
                      <button 
                        onClick={() => handleBuyItem(item)} disabled={!canAfford || isProcessing}
                        className={`w-full py-3 rounded-[6px] text-sm font-medium transition-all ${canAfford ? 'bg-white text-black hover:bg-gray-200 active:scale-[0.98]' : 'bg-[#0f0f0f] text-[rgba(255,255,255,0.2)] border border-[rgba(255,255,255,0.05)] cursor-not-allowed'}`}
                      >
                        {canAfford ? 'Fabricar Item' : 'Recursos Insuficientes'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {myShopItems.length === 0 && (
                <div className="col-span-3 text-center py-20 text-[rgba(255,255,255,0.3)] border border-dashed border-[rgba(255,255,255,0.1)] rounded-[10px]">
                  Sua vitrine está vazia.
                </div>
              )}
            </div>

            <button onClick={handleFinishCrafting} disabled={isProcessing} className="self-center bg-[#d4a853] text-black px-12 py-4 rounded-[6px] font-medium hover:bg-[#e0b767] transition-all text-lg active:scale-[0.98] shadow-[0_0_20px_rgba(212,168,83,0.2)]">
              {isProcessing ? 'Processando...' : 'Finalizar Compras'}
            </button>
          </div>
        )}
      </main>
    );
  }

  // ==========================================
  // TELA 3: JOGO BASE
  // ==========================================
  return (
    <main className={`min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 ${inter.className}`}>
      
      {isGameOver && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <h1 className={`${playfair.className} text-6xl text-[#d4a853] mb-4`}>Sobrevivente</h1>
            <p className="text-white text-lg mb-8">{alivePlayers[0]?.name} venceu a partida!</p>
            <div className="flex gap-4 justify-center">
              <button onClick={handleReturnToLobby} disabled={isProcessing} className="bg-[#d4a853] text-black px-6 py-3 rounded hover:bg-[#e0b767]">Jogar Novamente</button>
            </div>
          </div>
        </div>
      )}

      <header className="max-w-5xl mx-auto flex items-end justify-between border-b border-[rgba(255,255,255,0.07)] pb-6 mb-10">
        <div>
          <p className="text-[11px] tracking-[0.08em] text-[#d4a853] uppercase mb-1">Rodada {room.round_count}</p>
          <div className="flex items-center gap-4">
            <h1 className={`${playfair.className} text-3xl text-white tracking-tight`}>Sala <em className="text-[#d4a853] italic not-italic-numbers">{room.code}</em></h1>
            <button onClick={handleQuit} className="text-[10px] text-red-500 border border-red-500/30 px-3 py-1 rounded hover:bg-red-500/10 uppercase mt-2">Sair</button>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[11px] tracking-[0.08em] text-[rgba(255,255,255,0.4)] uppercase mb-1">Saco de Risco</p>
          <div className="flex gap-4 text-sm font-medium">
            <span className="text-green-500">{room.bag_greens} V</span>
            <span className="text-blue-500">{room.bag_blues} A</span>
            <span className="text-yellow-500">{room.bag_batteries} B</span>
            <span className="text-red-500">{room.bag_reds} C</span>
            <span className="text-purple-500">{room.bag_viruses} Vi</span>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mt-10">
        <div className={`md:col-span-2 bg-[#111111] border rounded-[10px] p-8 flex flex-col items-center justify-center min-h-[400px] transition-colors ${isMyTurn && !amIDead ? 'border-[rgba(212,168,83,0.3)]' : 'border-[rgba(255,255,255,0.07)] opacity-80'}`}>
          {amIDead ? (
            <h2 className={`${playfair.className} text-3xl mb-2 text-red-500`}>Eliminado</h2>
          ) : (
            <>
              <h2 className={`${playfair.className} text-2xl mb-4`}>
                {isMyTurn ? "Sua Vez" : `Turno de ${activePlayer?.name || "..."}`}
              </h2>
              
              {activePlayer && (
                <div className="flex gap-4 mb-8 bg-[#0a0a0a] p-4 rounded-[6px] border border-[rgba(255,255,255,0.05)] text-sm">
                  <div className="text-green-500">{activePlayer.turn_greens} <span className="text-[rgba(255,255,255,0.5)]">PCB</span></div>
                  <div className="text-blue-500">{activePlayer.turn_blues} <span className="text-[rgba(255,255,255,0.5)]">Blue</span></div>
                  <div className="text-yellow-500">{activePlayer.turn_batteries} <span className="text-[rgba(255,255,255,0.5)]">Bat</span></div>
                  <div className={`${activePlayer.reds_in_turn > 0 ? 'text-red-500 animate-pulse' : 'text-red-900'}`}>{activePlayer.reds_in_turn}/2 <span className="text-[rgba(255,255,255,0.5)]">Cur</span></div>
                  <div className={`${activePlayer.viruses_in_turn > 0 ? 'text-purple-500 animate-pulse' : 'text-purple-900'}`}>{activePlayer.viruses_in_turn}/2 <span className="text-[rgba(255,255,255,0.5)]">Vir</span></div>
                </div>
              )}
              
              {!isMyTurn && activePlayer && !onlineUsers.includes(activePlayer.id) && (
                <div className="w-full max-w-md mt-4 p-4 border border-red-500/30 bg-red-900/10 rounded-[6px] text-center">
                  <button onClick={() => handleKickOffline(activePlayer)} className="bg-red-500/20 text-red-500 px-4 py-2 rounded text-xs uppercase w-full">Expulsar Offline</button>
                </div>
              )}

              {isMyTurn && (
                <div className="flex flex-col gap-4 w-full max-w-md mt-2">
                  <div className="flex gap-4">
                      <button onClick={handleDraw} disabled={isProcessing} className="flex-1 h-[52px] bg-white text-[#0a0a0a] font-medium rounded hover:bg-gray-200">Sacar</button>
                      <button onClick={handlePassTurn} disabled={me?.forced_draws > 0 || isProcessing} className="flex-1 h-[52px] bg-[#0f0f0f] border border-[rgba(255,255,255,0.12)] text-white font-medium rounded hover:border-[rgba(255,255,255,0.35)]">Passar</button>
                  </div>
                  {me?.forced_draws > 0 && <div className="text-center text-red-500 text-xs animate-pulse font-medium mt-1">SAQUES OBRIGATÓRIOS RESTANTES: {me.forced_draws}</div>}
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {targetingItem && <div className="bg-red-900/20 border border-red-500/50 text-red-400 p-2 rounded text-center text-xs animate-pulse">SELECIONE O ALVO INIMIGO</div>}
          
          {players.map((p) => {
            const pIsActive = room?.current_turn_player_id === p.id;
            const pIsDead = p.hp <= 0;
            const isOffline = !onlineUsers.includes(p.id) && p.id !== me.id;
            const isTargetable = targetingItem && p.id !== me.id && !pIsDead;

            return (
              <div key={p.id} onClick={() => isTargetable && handleUseItem(targetingItem, p.id)} className={`bg-[#111111] border rounded-[10px] p-4 relative overflow-hidden transition-all ${pIsDead ? 'opacity-30 grayscale border-[rgba(255,255,255,0.07)]' : isTargetable ? 'border-red-500 cursor-pointer hover:bg-red-900/20 hover:scale-[1.02]' : pIsActive ? 'border-[#d4a853]' : 'border-[rgba(255,255,255,0.07)]'}`}>
                {pIsActive && !pIsDead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#d4a853]" />}
                
                <div className="flex justify-between items-center mb-3 pl-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[15px]">{p.name}</span>
                    {isOffline && !pIsDead && <span className="text-[9px] bg-red-900/50 text-red-400 px-1.5 py-0.5 rounded">OFF</span>}
                    {!isOffline && !pIsDead && <span className="w-2 h-2 rounded-full bg-green-500"></span>}
                  </div>
                  <span className="text-sm bg-[#0a0a0a] px-2 py-1 rounded border border-[rgba(255,255,255,0.05)]">HP: {p.hp}</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-center text-xs pl-2 mb-3">
                  <div className="bg-[#0a0a0a] p-1 rounded text-green-500">{p.greens}</div>
                  <div className="bg-[#0a0a0a] p-1 rounded text-blue-500">{p.blues}</div>
                  <div className="bg-[#0a0a0a] p-1 rounded text-yellow-500">{p.batteries}</div>
                </div>

                {/* Exibição do Inventário e Botões de Ação */}
                {(p.inventory || []).length > 0 && (
                  <div className="pl-2 mt-2 pt-2 border-t border-[rgba(255,255,255,0.05)]">
                    <p className="text-[9px] text-[rgba(255,255,255,0.4)] uppercase tracking-wider mb-1">Inventário</p>
                    <div className="flex flex-wrap gap-1">
                      {p.inventory.map((itemId: string, i: number) => {
                        const itemDef = SHOP_ITEMS.find(x => x.id === itemId);
                        const isPassive = itemDef?.type === 'defense';
                        const isTargetingThis = targetingItem === itemId;
                        const canUse = isMyTurn && p.id === me.id && !isPassive && !isProcessing;

                        return (
                          <button key={i} disabled={!canUse} onClick={(e) => { e.stopPropagation(); canUse && handleItemClick(itemId); }} className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${isPassive ? 'bg-[#0a0a0a] text-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.05)] cursor-not-allowed' : isTargetingThis ? 'bg-red-500 text-white border-red-500 animate-pulse' : canUse ? 'bg-[rgba(212,168,83,0.1)] text-[#d4a853] border border-[#d4a853]/30 hover:bg-[#d4a853]/20 cursor-pointer' : 'bg-[rgba(212,168,83,0.05)] text-[#d4a853]/50 border border-[#d4a853]/10 cursor-not-allowed'}`}>
                            {itemDef?.name || itemId}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </main>
  );
}