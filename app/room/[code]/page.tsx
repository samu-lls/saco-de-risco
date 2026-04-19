// @ts-nocheck
/* eslint-disable */
"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Playfair_Display, Inter } from "next/font/google";

const playfair = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"] });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"] });

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = String(params?.code || "");

  const hasInitialized = useRef(false);

  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null); // Novo Estado de Erro
  const [me, setMe] = useState<any>(null);
  const [room, setRoom] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const playerName = localStorage.getItem("playerName");
    if (!playerName) {
      router.push("/");
      return;
    }

    const initGame = async () => {
      try {
        let { data: roomData, error: roomError } = await supabase.from("rooms").select("*").eq("code", roomCode).maybeSingle();
        if (roomError) throw new Error("Erro ao buscar sala: " + roomError.message);

        if (!roomData) {
          const { data: newRoom, error: insertRoomError } = await supabase.from("rooms").insert({ code: roomCode }).select().single();
          if (insertRoomError) throw new Error("Erro ao criar sala: " + insertRoomError.message);
          roomData = newRoom;
        }
        
        let { data: playerData, error: playerError } = await supabase
          .from("players")
          .select("*")
          .eq("room_id", roomData.id)
          .eq("name", playerName)
          .maybeSingle();

        if (playerError) throw new Error("Erro de dados duplicados. Limpe o banco de dados.");

        if (!playerData) {
          if (roomData.status !== 'lobby') {
            alert("Partida em andamento! Você não pode entrar agora.");
            router.push("/");
            return;
          }

          const { data: newPlayer, error: insertPlayerError } = await supabase.from("players").insert({
            room_id: roomData.id,
            name: playerName,
          }).select().single();
          
          if (insertPlayerError) throw new Error("Erro ao criar jogador: " + insertPlayerError.message);
          playerData = newPlayer;
        }

        setRoom(roomData);
        setMe(playerData);

        const fetchPlayers = async () => {
          const { data } = await supabase.from("players").select("*").eq("room_id", roomData.id).order("joined_at", { ascending: true });
          if (data) setPlayers(data);
        };
        await fetchPlayers();
        setLoading(false);

        const channel = supabase.channel(`room_${roomData.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${roomData.id}` }, 
            (payload) => {
              if (payload.new.id === playerData.id) setMe(payload.new);
              fetchPlayers();
            }
          )
          .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${roomData.id}` }, 
            (payload) => setRoom(payload.new)
          )
          .subscribe();

        return () => { supabase.removeChannel(channel); };
      } catch (error: any) {
        console.error("Erro FATAL ao inicializar:", error);
        setErrorMsg(error.message); // Salva a mensagem para mostrar na tela
        setLoading(false); 
      }
    };

    initGame();
  }, [roomCode, router]);

  // ==========================================
  // LÓGICA DO LOBBY
  // ==========================================
  const handleToggleReady = async () => {
    const newReadyState = !me.is_ready;
    await supabase.from("players").update({ is_ready: newReadyState }).eq("id", me.id);

    const updatedPlayers = players.map(p => p.id === me.id ? { ...p, is_ready: newReadyState } : p);
    const allReady = updatedPlayers.length > 1 && updatedPlayers.every(p => p.is_ready);

    if (allReady && room.status === 'lobby') {
      const firstPlayer = updatedPlayers[0];
      await supabase.from("rooms").update({ 
        status: 'playing',
        current_turn_player_id: firstPlayer.id,
        round_count: 1
      }).eq("id", room.id);
    } else if (updatedPlayers.length === 1 && newReadyState) {
        alert("Aguarde mais jogadores para iniciar a partida.");
        await supabase.from("players").update({ is_ready: false }).eq("id", me.id);
    }
  };

  // ==========================================
  // LÓGICA DE JOGO BASE (V3.0)
  // ==========================================
  const isMyTurn = room?.current_turn_player_id === me?.id;
  const amIDead = me?.hp <= 0;
  
  const getNextAlivePlayer = () => {
    const myIndex = players.findIndex(p => p.id === me.id);
    for (let i = 1; i < players.length; i++) {
      const nextP = players[(myIndex + i) % players.length];
      if (nextP.hp > 0) return nextP;
    }
    return null;
  };

  const alivePlayers = players.filter(p => p.hp > 0);
  const isGameOver = alivePlayers.length === 1 && players.length > 1;
  const activePlayer = players.find(p => p.id === room?.current_turn_player_id);

  const handleDraw = async () => {
    if (!isMyTurn || amIDead || isGameOver) return;
    const totalInBag = room.bag_greens + room.bag_blues + room.bag_reds + room.bag_batteries + room.bag_viruses;
    if (totalInBag <= 0) return alert("O Saco está vazio!");

    const roll = Math.random() * totalInBag;
    let newBagGreens = room.bag_greens, newBagBlues = room.bag_blues, newBagReds = room.bag_reds;
    let newBagBatteries = room.bag_batteries, newBagViruses = room.bag_viruses;
    
    let newTurnGreens = me.turn_greens, newTurnBlues = me.turn_blues, newRedsInTurn = me.reds_in_turn;
    let newTurnBatteries = me.turn_batteries, newVirusesInTurn = me.viruses_in_turn;
    
    let newHp = me.hp;
    let newForcedDraws = Math.max(0, me.forced_draws - 1);
    
    let isExplosion = false;
    let isVirusSkip = false;

    if (roll < newBagGreens) { newBagGreens--; newTurnGreens++; }
    else if (roll < newBagGreens + newBagBlues) { newBagBlues--; newTurnBlues++; }
    else if (roll < newBagGreens + newBagBlues + newBagBatteries) { newBagBatteries--; newTurnBatteries++; }
    else if (roll < newBagGreens + newBagBlues + newBagBatteries + newBagViruses) { 
      newBagViruses--; newVirusesInTurn++;
      if (newVirusesInTurn >= 2) {
        isVirusSkip = true; newTurnGreens = 0; newTurnBlues = 0; newTurnBatteries = 0; newRedsInTurn = 0; newVirusesInTurn = 0; newForcedDraws = 0;
      }
    } else {
      newBagReds--; newRedsInTurn++;
      if (newRedsInTurn >= 2) {
        isExplosion = true; newHp--; newTurnGreens = 0; newTurnBlues = 0; newTurnBatteries = 0; newRedsInTurn = 0; newVirusesInTurn = 0; newForcedDraws = 0; 
      }
    }

    await supabase.from("rooms").update({ bag_greens: newBagGreens, bag_blues: newBagBlues, bag_reds: newBagReds, bag_batteries: newBagBatteries, bag_viruses: newBagViruses }).eq("id", room.id);
    await supabase.from("players").update({ hp: newHp, turn_greens: newTurnGreens, turn_blues: newTurnBlues, turn_batteries: newTurnBatteries, reds_in_turn: newRedsInTurn, viruses_in_turn: newVirusesInTurn, forced_draws: newForcedDraws }).eq("id", me.id);

    if (isExplosion) {
      alert("💥 CURTO-CIRCUITO! 2º Curto. 1 Dano e turno perdido.");
      if (newHp <= 0) {
         const nextP = getNextAlivePlayer();
         if (nextP) await supabase.from("rooms").update({ current_turn_player_id: nextP.id }).eq("id", room.id);
      } else { await handlePassTurn(true); }
    } else if (isVirusSkip) {
      alert("🦠 VÍRUS DETECTADO! 2º Vírus. Turno perdido (sem dano).");
      await handlePassTurn(true);
    }
  };

  const handlePassTurn = async (isFromExplosion = false) => {
    if (!isMyTurn || amIDead || isGameOver) return;
    if (!isFromExplosion && me.forced_draws > 0) return alert(`Saque mais ${me.forced_draws} vez(es)!`);

    const nextPlayer = getNextAlivePlayer();
    if (!nextPlayer) return;

    if (!isFromExplosion) {
      await supabase.from("players").update({ 
        greens: me.greens + me.turn_greens, 
        blues: me.blues + me.turn_blues, 
        batteries: me.batteries + me.turn_batteries,
        turn_greens: 0, turn_blues: 0, turn_batteries: 0, reds_in_turn: 0, viruses_in_turn: 0 
      }).eq("id", me.id);
    }
    await supabase.from("rooms").update({ current_turn_player_id: nextPlayer.id }).eq("id", room.id);
  };


  // ==========================================
  // RENDERIZAÇÃO DAS TELAS
  // ==========================================
  if (loading) return <div className={`min-h-screen bg-[#0a0a0a] flex items-center justify-center text-[rgba(255,255,255,0.5)] ${inter.className}`}>Conectando aos servidores...</div>;

  // TELA DE ERRO (Trava Anti-Fantasma)
  if (errorMsg || !room || !me) {
    return (
      <main className={`min-h-screen bg-[#0a0a0a] text-white flex flex-col items-center justify-center p-6 text-center ${inter.className}`}>
        <h1 className={`${playfair.className} text-4xl text-red-500 mb-4`}>Sessão Interrompida</h1>
        <p className="text-[rgba(255,255,255,0.6)] max-w-md mb-8">{errorMsg || "Não foi possível carregar os dados da sala."}</p>
        <button onClick={() => router.push("/")} className="bg-white text-black px-8 py-3 rounded-[6px] font-medium hover:bg-gray-200 transition-all">
          Voltar para o Início
        </button>
      </main>
    );
  }

  // TELA 1: LOBBY
  if (room.status === 'lobby') {
    return (
      <main className={`min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 flex flex-col items-center justify-center ${inter.className}`}>
        <div className="max-w-md w-full bg-[#111111] border border-[rgba(255,255,255,0.07)] rounded-[10px] p-8 text-center">
          <p className="text-[11px] tracking-[0.08em] text-[rgba(255,255,255,0.4)] uppercase mb-2">Código da Sala</p>
          <h1 className={`${playfair.className} text-5xl text-[#d4a853] tracking-tight mb-8`}>{room.code}</h1>
          
          <div className="flex flex-col gap-3 mb-8">
            <h3 className="text-[13px] text-left text-[rgba(255,255,255,0.5)] border-b border-[rgba(255,255,255,0.07)] pb-2 mb-2">Jogadores Conectados ({players.length})</h3>
            {players.map(p => (
              <div key={p.id} className="flex justify-between items-center bg-[#0a0a0a] p-3 rounded-[6px] border border-[rgba(255,255,255,0.02)]">
                <span className="font-medium text-[15px]">{p.name} {p.id === me.id && "(Você)"}</span>
                <span className={`text-xs px-2 py-1 rounded-[4px] ${p.is_ready ? 'bg-green-900/30 text-green-500' : 'bg-[#111111] text-[rgba(255,255,255,0.4)]'}`}>
                  {p.is_ready ? 'PRONTO' : 'AGUARDANDO'}
                </span>
              </div>
            ))}
          </div>

          <button 
            onClick={handleToggleReady}
            className={`w-full h-[52px] font-medium text-[15px] rounded-[6px] transition-all active:scale-[0.99] ${me.is_ready ? 'bg-[#1a1a1a] text-white border border-[rgba(255,255,255,0.1)] hover:bg-[#222]' : 'bg-white text-[#0a0a0a] hover:bg-gray-200'}`}
          >
            {me.is_ready ? 'Cancelar Pronto' : 'Estou Pronto'}
          </button>
          <p className="text-[11px] text-[rgba(255,255,255,0.3)] mt-4">A partida inicia quando todos estiverem prontos. (Mín. 2 jogadores)</p>
        </div>
      </main>
    );
  }

  // TELA 2: JOGO BASE
  return (
    <main className={`min-h-screen bg-[#0a0a0a] text-white p-6 md:p-12 ${inter.className}`}>
      
      {isGameOver && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <h1 className={`${playfair.className} text-6xl text-[#d4a853] mb-4`}>Sobrevivente</h1>
            <p className="text-white text-lg">{alivePlayers[0]?.name}</p>
          </div>
        </div>
      )}

      <header className="max-w-5xl mx-auto flex items-end justify-between border-b border-[rgba(255,255,255,0.07)] pb-6 mb-10">
        <div>
          <p className="text-[11px] tracking-[0.08em] text-[rgba(255,255,255,0.4)] uppercase mb-1">Partida em Andamento</p>
          <h1 className={`${playfair.className} text-3xl text-white tracking-tight`}>
            Sala <em className="text-[#d4a853] italic not-italic-numbers">{room.code}</em>
          </h1>
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

      <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
        
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
              
              <div className="flex gap-4 w-full max-w-md mt-2">
                <button onClick={handleDraw} disabled={!isMyTurn} className="flex-1 h-[52px] bg-white text-[#0a0a0a] font-medium text-[15px] rounded-[6px] hover:bg-gray-200 active:scale-[0.99] disabled:opacity-10 disabled:cursor-not-allowed transition-all">Sacar</button>
                <button onClick={() => handlePassTurn(false)} disabled={!isMyTurn || me?.forced_draws > 0} className="flex-1 h-[52px] bg-[#0f0f0f] border border-[rgba(255,255,255,0.12)] text-white font-medium text-[15px] rounded-[6px] hover:border-[rgba(255,255,255,0.35)] active:scale-[0.99] disabled:opacity-10 disabled:cursor-not-allowed transition-all">Passar & Guardar</button>
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-[11px] tracking-[0.08em] text-[rgba(255,255,255,0.4)] uppercase mb-2">Rede</h3>
          {players.map((p) => {
            const pIsActive = room?.current_turn_player_id === p.id;
            const pIsDead = p.hp <= 0;
            return (
              <div key={p.id} className={`bg-[#111111] border ${pIsActive && !pIsDead ? 'border-[#d4a853]' : 'border-[rgba(255,255,255,0.07)]'} rounded-[10px] p-4 relative overflow-hidden ${pIsDead ? 'opacity-30 grayscale' : ''}`}>
                {pIsActive && !pIsDead && <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#d4a853]" />}
                <div className="flex justify-between items-center mb-3 pl-2">
                  <span className="font-medium text-[15px]">{p.name}</span>
                  <span className="text-sm bg-[#0a0a0a] px-2 py-1 rounded-[4px] border border-[rgba(255,255,255,0.05)] text-white">HP: {p.hp}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs pl-2">
                  <div className="bg-[#0a0a0a] p-1 rounded border border-[rgba(255,255,255,0.02)] text-green-500">{p.greens}</div>
                  <div className="bg-[#0a0a0a] p-1 rounded border border-[rgba(255,255,255,0.02)] text-blue-500">{p.blues}</div>
                  <div className="bg-[#0a0a0a] p-1 rounded border border-[rgba(255,255,255,0.02)] text-yellow-500">{p.batteries}</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  );
}