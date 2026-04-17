export const ABILITY_IDS = {
  DASH: "dash",
  DOUBLE_JUMP: "double_jump",
  WALL_CLIMB: "wall_climb"
};

export const ABILITIES = {
  [ABILITY_IDS.DASH]: {
    id: ABILITY_IDS.DASH,
    label: "Dash",
    description: "Short horizontal burst."
  },
  [ABILITY_IDS.DOUBLE_JUMP]: {
    id: ABILITY_IDS.DOUBLE_JUMP,
    label: "Double Jump",
    description: "Add one extra jump in air."
  },
  [ABILITY_IDS.WALL_CLIMB]: {
    id: ABILITY_IDS.WALL_CLIMB,
    label: "Wall Climb",
    description: "Scale vertical shafts."
  }
};
