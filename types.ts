export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT' | 'NONE';

export enum TileType {
  WALL = 0,
  DOT = 1,
  POWER_PELLET = 2,
  EMPTY = 3,
  GHOST_HOUSE = 4,
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

export interface Entity {
  x: number;
  y: number;
  dir: Direction;
  nextDir: Direction;
  speed: number;
  radius: number;
  color: string;
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
  trail: Position[];
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