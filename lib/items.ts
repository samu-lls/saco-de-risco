export const SHOP_ITEMS = [
  { id: 'firewall', name: 'Firewall', type: 'defense', cost: { green: 2, blue: 1, yellow: 0 }, desc: 'Absorve 1 Dano letal ou ataque inimigo e quebra. (MÁX: 1)' },
  { id: 'patch', name: 'Patch de Seg.', type: 'heal', cost: { green: 0, blue: 1, yellow: 2 }, desc: 'Recupera +1 HP instantaneamente.' },
  { id: 'vpn', name: 'VPN', type: 'utility', cost: { green: 1, blue: 1, yellow: 1 }, desc: 'Pula seu turno imediatamente com segurança.' },
  { id: 'trojan', name: 'Trojan', type: 'attack', cost: { green: 2, blue: 1, yellow: 0 }, desc: 'Força um alvo a sacar 3 vezes no turno dele.' },
  { id: 'phishing', name: 'Phishing', type: 'attack', cost: { green: 0, blue: 1, yellow: 2 }, desc: 'Rouba 2 itens do cofre de um inimigo.' },
  { id: 'reboot', name: 'Reboot', type: 'utility', cost: { green: 1, blue: 1, yellow: 1 }, desc: 'Devolve 2 Curtos/Vírus da sua mão pro Saco.' },
  { id: 'zeroday', name: 'Zero-Day', type: 'fatal', cost: { green: 1, blue: 1, yellow: 3 }, desc: 'Retira 1 HP do alvo instantaneamente.' },
  { id: 'ddos', name: 'DDoS Automático', type: 'fatal', cost: { green: 2, blue: 1, yellow: 2 }, desc: 'Aplica +2 Saques Obrigatórios em TODOS.' },
  { id: 'ransomware', name: 'Ransomware', type: 'fatal', cost: { green: 3, blue: 1, yellow: 2 }, desc: 'Rouba 1 HP do alvo (causa dano a ele e cura você).' },
  { id: 'logicbomb', name: 'Bomba Lógica', type: 'fatal', cost: { green: 2, blue: 1, yellow: 3 }, desc: 'Causa 1 Dano a TODOS (incluindo você). Ignora Firewall.' }
];