# Risk Bag

[Português](README.pt-BR.md) | [English](README.md)

<p align="center">
  <img src="public/screenshots/hero-banner.png" alt="Risk Bag — Hacker Terminal Gameplay" width="800">
</p>

<p align="center">
  <em>It's not just probability. It's psychology, tension, and the right call at the wrong moment.</em><br>
  <strong>A real-time multiplayer strategy and risk game inspired by the aesthetics of underground casinos and cyberpunk corporate terminals.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-000000?style=flat&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white" alt="Supabase">
  <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat&logo=tailwind-css&logoColor=white" alt="TailwindCSS">
  <img src="https://img.shields.io/badge/Framer_Motion-0055FF?style=flat&logo=framer&logoColor=white" alt="Framer Motion">
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="MIT">
</p>

---

## What Is This?

**Risk Bag** is a digital, real-time multiplayer board game. Players take on the role of hackers at a high-stakes betting table, where every round demands a choice: pull more components from the bag, or walk away with what you already have before everything blows up.

Greed kills. But playing it too safe leaves you without resources. You decide.

> **Note:** The game works best on stable connections. Since all state is synchronized in real time via Supabase, unstable networks may cause delays between players.

## Features

| Feature | Description |
|---------|-------------|
| ⚡ **Real-Time Sync** | Table state synchronized instantly for all players via Supabase Realtime. |
| 🃏 **Card System** | Inventory items rendered as TCG-style playing cards with icons, types, and hover animations. |
| 🛒 **Black Market** | Between-round crafting phase with a 60-second timer — buy weapons, heals, and utilities with your resources. |
| 💥 **Visual Feedback** | Screen shake on damage, glitch effect on area attacks, card flash animation when drawing from the bag. |
| 🔊 **Synthesized Audio** | Sounds generated via Web Audio API — no external files, zero latency. |
| 🎲 **Fair Turn Order** | First player of each match and each round's opener are randomly drawn. |
| 📋 **Match Log** | Real-time event terminal and full podium with match history at game over. |
| 📱 **Responsive** | Interface optimized for both desktop and mobile. |

## The Game

### Core Loop

```text
Lobby (all players mark Ready)
        │
        ▼
Round begins with a randomly drawn player
        │
        ▼
Your turn: Draw from the bag  ──►  Good material? → stacks in your hand
        │                           Short-Circuit? → 1 is fine, 2 = 💥 -1 HP
        │                           Virus? → 1 is fine, 2 = 🦠 lose your turn
        ▼
Pass turn → materials go to the Vault, threats return to the Bag
        │
        ▼
All players played once → Black Market (60s) → craft items with resources
        │
        ▼
New round with a different starter → repeats until 1 player remains
```

### Black Market Items

| Item | Type | Effect |
|------|------|--------|
| 🛡️ Firewall | Defense | Absorbs 1 lethal hit or attack. Breaks after use. |
| 💉 Sec. Patch | Heal | Instantly recovers +1 HP. |
| 🌐 VPN | Utility | Safely skips your turn, keeping all gathered materials. |
| 🔁 Reboot | Utility | Returns 2 Short-Circuits/Viruses from your hand to the Bag. |
| 🎯 Trojan | Attack | Forces an enemy to draw 3 times on their next turn. |
| 📡 Phishing | Attack | Steals 2 resources from an enemy's vault. |
| 💀 Zero-Day | Fatal | Instantly removes 1 HP from a target. |
| 🌐 DDoS Attack | Fatal | Applies +2 forced draws to ALL enemies. |
| 🔒 Ransomware | Fatal | Steals 1 HP from a target (heals you simultaneously). |
| 💣 Logic Bomb | Fatal | Deals 1 damage to EVERYONE (including you). Ignores Firewall. |

## Screenshots

| Home Screen | Lobby |
|:---:|:---:|
| <img src="public/screenshots/hero-banner.png" width="400"> | <img src="public/screenshots/lobby.png" width="400"> |
| **Game Table** | **Black Market** |
| <img src="public/screenshots/gameplay.png" width="400"> | <img src="public/screenshots/shop.png" width="400"> |

## Tech Stack

- **Framework:** Next.js 15 (App Router) + TypeScript
- **Database / Realtime:** Supabase (PostgreSQL + Realtime subscriptions)
- **Styling:** Tailwind CSS + CSS custom properties
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Audio:** Web Audio API (native synthesizer, no external assets)
- **Deployment:** Vercel (automated CI/CD via GitHub)

## Technical Challenges

- **Race Conditions:** Turn logic performs a fresh database read before every write to prevent conflicts when multiple players interact with the bag simultaneously.
- **Unwanted Scroll:** The terminal's `scrollIntoView` was moving the entire `window`. Fixed by using `scrollTop` directly on the inner container.
- **Fair Turn Order:** A shuffled `turn_order` array is persisted in the database with a rotating index between rounds, ensuring no player opens two consecutive rounds.
- **Synchronized Timer:** Local 60-second countdown in the Black Market with safe `clearInterval` cleanup and automatic fallback to `handleFinishCrafting`.

## Running Locally

```bash
# 1. Clone the repository
git clone https://github.com/samu-lls/saco-de-risco.git

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials:
# NEXT_PUBLIC_SUPABASE_URL=your_url
# NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key

# 4. Start the development server
npm run dev
```

Open `http://localhost:3000`, launch two tabs with different player names, and create a room to test multiplayer locally.

## Project Structure

```text
risk-bag/
├── app/
│   ├── page.tsx                  # Home screen and login
│   ├── layout.tsx                # Root layout
│   ├── globals.css               # Design system and animations
│   └── room/[code]/
│       └── page.tsx              # Full match logic
├── components/
│   ├── PlayerPanel.tsx           # Player card with TCG inventory
│   ├── ShopCard.tsx              # Black Market item card
│   └── TerminalLog.tsx           # Real-time event terminal
└── lib/
    ├── items.ts                  # Definitions for all 10 game items
    ├── patchnotes.ts             # Version history (editable)
    ├── sounds.ts                 # Audio synthesizer via Web Audio API
    └── supabase.ts               # Configured Supabase client
```

## About the Author

I'm **Samuel**, an IT Analyst and tech enthusiast. I built Risk Bag as a personal project to explore real-time synchronization, game system design, and the intersection between software engineering and user experience.

If you want to talk development, games, or tech setups, let's connect.

## Connect

[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=for-the-badge&logo=linkedin&logoColor=white)](https://www.linkedin.com/in/samu-lls/)
[![Behance](https://img.shields.io/badge/Behance-1769FF?style=for-the-badge&logo=behance&logoColor=white)](https://www.behance.net/samuellelles)
[![Email](https://img.shields.io/badge/Email-0078D4?style=for-the-badge&logo=microsoft-outlook&logoColor=white)](mailto:samu.lls@outlook.com)
[![GitHub](https://img.shields.io/badge/GitHub-100000?style=for-the-badge&logo=github&logoColor=white)](https://github.com/samu-lls)
