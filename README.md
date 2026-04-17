# Phaser Metroidvania Infrastructure

Starter infrastructure for a Metroidvania game using Phaser 3 + Vite.

## Included Foundation

- Scene flow: `Boot -> Menu -> Game + UI`
- Central game state store for room, health, progression
- Ability system and gate checks (progression locks)
- Player controller with jump, dash, and optional double-jump
- Room manager with:
  - room data definitions
  - static platforms
  - room transitions
  - per-room camera/world bounds
- Event bus for decoupled UI/world communication

## Project Layout

```txt
src/
  config/gameConfig.js
  core/{EventBus,GameState}.js
  data/{abilities,rooms}.js
  entities/Player.js
  scenes/{BootScene,MenuScene,GameScene,UIScene}.js
  systems/{AbilitySystem,PlayerController}.js
  world/RoomManager.js
```

## Run

```bash
npm install
npm run dev
```

## Controls

- Fly: `W/A/S/D` or arrow keys
- Dash: `Shift`
- Debug unlock double-jump: `U` (unused in flight mode)

## Extending This

- Replace generated textures in `BootScene` with sprites/tilesets.
- Swap static platform blocks for tilemaps in `RoomManager`.
- Add save/load serialization from `GameState`.
- Add enemy/NPC systems as separate entities and AI systems.
