
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export enum TileType {
  WALL = 0,
  DOT = 1,
  POWER_PELLET = 2,
  EMPTY = 3,
  GHOST_HOUSE = 4,
  ITEM_SPEED = 5,
  ITEM_PHASE = 6,
}

export enum GameState {
  MENU = 'MENU',
  LEVEL_START = 'LEVEL_START',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  GAME_OVER = 'GAME_OVER',
  LEVEL_COMPLETE = 'LEVEL_COMPLETE',
}

export interface Position {
  x: number;
  y: number;
}

export enum ItemType {
  NONE = 'NONE',
  SPEED = 'SPEED_BOOST',
  PHASE = 'PHASE_SHIFT',
}

export interface Entity {
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  speed: number;
  baseSpeed: number; // Added to reset speed after boost
  radius: number;
  color: string;
  inventory: ItemType;
  activeEffect: ItemType;
  effectTimer: number;
  trail: Position[];
}

export enum GhostType {
  AGGRESSIVE = 'AGGRESSIVE', // Blinky-ish
  AMBUSH = 'AMBUSH',         // Pinky-ish
  RANDOM = 'RANDOM',         // Clyde-ish
}

export enum GhostState {
  SCATTER = 'SCATTER',
  CHASE = 'CHASE',
  FRIGHTENED = 'FRIGHTENED',
  EATEN = 'EATEN',
}

export interface Ghost extends Entity {
  type: GhostType;
  state: GhostState;
  scaredTimer: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
}

export interface LevelTheme {
  name: string;
  wallColor: string;
  dotColor: string;
  bgColor: string;
}

export enum LevelModifier {
  NONE = 'NORMAL SYSTEMS',
  FAST_GHOSTS = 'HOSTILE OVERCLOCK', // Ghosts move faster
  SLOW_PLAYER = 'GRAVITY LEAK',      // Player moves slower
  BLINKING_DOTS = 'SENSOR GLITCH',   // Dots flicker in and out
  GHOST_FRENZY = 'HYPER AGGRESSION', // Ghosts switch modes faster
}
