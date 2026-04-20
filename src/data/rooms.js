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
    allowRespawn: false,
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
      { x: 360, y: 700, width: 260, height: 30 },
      { x: 780, y: 610, width: 280, height: 30 },
      { x: 1160, y: 560, width: 220, height: 30 }
    ],
    abilityGates: [],
    sliceTriggers: [],
    enemies: []
  },
  shaft: {
    id: "shaft",
    allowRespawn: false,
    bgColor: 0xc4cee6,
    spawns: {
      spawn_left: { x: 130, y: 700 },
      spawn_center: { x: 820, y: 560 },
      spawn_right: { x: 1470, y: 700 }
    },
    exits: {
      left: { toRoomId: "start", spawn: "spawn_right" },
      right: { toRoomId: "crypt", spawn: "spawn_left" }
    },
    platforms: [
      { x: 800, y: 860, width: 1600, height: 80 },
      { x: 340, y: 710, width: 230, height: 30 },
      { x: 620, y: 600, width: 230, height: 30 },
      { x: 900, y: 500, width: 230, height: 30 },
      { x: 1170, y: 620, width: 240, height: 30 },
      { x: 1320, y: 470, width: 220, height: 30 }
    ],
    abilityGates: [],
    sliceTriggers: [
      {
        id: "shaft-checkpoint",
        kind: "checkpoint",
        x: 820,
        y: 560,
        width: 120,
        height: 120,
        checkpointSpawn: "spawn_center"
      }
    ],
    enemies: [
      {
        id: "shaft-angel-1",
        type: "angel",
        x: 860,
        y: 470,
        patrol: { left: 700, right: 1080, y: 470 }
      }
    ]
  },
  crypt: {
    id: "crypt",
    allowRespawn: false,
    bgColor: 0x9db4d7,
    spawns: {
      spawn_left: { x: 130, y: 700 },
      spawn_inner: { x: 1240, y: 700 }
    },
    exits: {
      left: { toRoomId: "shaft", spawn: "spawn_right" }
    },
    platforms: [
      { x: 800, y: 860, width: 1600, height: 80 },
      { x: 300, y: 710, width: 230, height: 30 },
      { x: 560, y: 600, width: 230, height: 30 },
      { x: 830, y: 500, width: 230, height: 30 },
      { x: 1110, y: 560, width: 220, height: 30 },
      { x: 1330, y: 430, width: 240, height: 30 }
    ],
    abilityGates: [
      {
        x: 1165,
        y: 450,
        width: 70,
        height: 760,
        requiredAbility: ABILITY_IDS.FLAME_RING,
        directionHint: "inner-sanctum",
        style: "flame-wall"
      }
    ],
    sliceTriggers: [
      {
        id: "crypt-ritual",
        kind: "ritual",
        x: 1420,
        y: 370,
        width: 110,
        height: 130
      }
    ],
    enemies: [
      {
        id: "crypt-angel-1",
        type: "angel",
        x: 560,
        y: 560,
        patrol: { left: 420, right: 760, y: 560 }
      },
      {
        id: "crypt-angel-2",
        type: "angel",
        x: 900,
        y: 460,
        patrol: { left: 760, right: 1080, y: 460 }
      },
      {
        id: "crypt-angel-3",
        type: "angel",
        x: 1240,
        y: 390,
        patrol: { left: 1110, right: 1410, y: 390 }
      }
    ]
  }
};
