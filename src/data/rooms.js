import { ABILITY_IDS } from "./abilities";

const ROOM_WIDTH = 1600;
const ROOM_HEIGHT = 900;

export const ROOM_DIMENSIONS = {
  width: ROOM_WIDTH,
  height: ROOM_HEIGHT
};

export const ROOMS = {
  start: {
    id: "start",
    bgColor: 0xc8d7f2,
    spawns: {
      spawn_left: { x: 160, y: 700 },
      spawn_center: { x: 800, y: 450 },
      spawn_right: { x: 1430, y: 700 }
    },
    exits: {
      right: { toRoomId: "shaft", spawn: "spawn_left" }
    },
    platforms: [
      { x: 800, y: 860, width: 1600, height: 80 },
      { x: 400, y: 700, width: 260, height: 30 },
      { x: 900, y: 620, width: 300, height: 30 },
      { x: 1300, y: 530, width: 220, height: 30 }
    ],
    abilityGates: [],
    enemies: []
  },
  shaft: {
    id: "shaft",
    bgColor: 0xbdd2f1,
    spawns: {
      spawn_left: { x: 130, y: 700 },
      spawn_right: { x: 1470, y: 700 },
      spawn_top: { x: 800, y: 280 }
    },
    exits: {
      left: { toRoomId: "start", spawn: "spawn_right" },
      right: { toRoomId: "sanctum", spawn: "spawn_left" }
    },
    platforms: [
      { x: 800, y: 860, width: 1600, height: 80 },
      { x: 250, y: 740, width: 210, height: 30 },
      { x: 450, y: 600, width: 210, height: 30 },
      { x: 660, y: 470, width: 210, height: 30 },
      { x: 900, y: 350, width: 250, height: 30 },
      { x: 1200, y: 500, width: 210, height: 30 }
    ],
    abilityGates: [
      {
        x: 1160,
        y: 790,
        width: 60,
        height: 140,
        requiredAbility: ABILITY_IDS.DOUBLE_JUMP,
        directionHint: "right"
      }
    ],
    enemies: [
      { x: 540, y: 540, patrol: { left: 430, right: 700, y: 540 } },
      { x: 1100, y: 420, patrol: { left: 980, right: 1280, y: 420 } }
    ]
  },
  sanctum: {
    id: "sanctum",
    bgColor: 0xb4cceb,
    spawns: {
      spawn_left: { x: 130, y: 700 }
    },
    exits: {
      left: { toRoomId: "shaft", spawn: "spawn_right" }
    },
    platforms: [
      { x: 800, y: 860, width: 1600, height: 80 },
      { x: 620, y: 680, width: 350, height: 30 },
      { x: 950, y: 520, width: 300, height: 30 },
      { x: 1250, y: 360, width: 250, height: 30 }
    ],
    abilityGates: [],
    enemies: [{ x: 980, y: 470, patrol: { left: 840, right: 1180, y: 470 } }]
  }
};
