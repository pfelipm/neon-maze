import { LevelTheme, TileType } from './types';

export const TILE_SIZE = 24; // Base tile size, will be scaled
export const MAP_WIDTH = 19;
export const MAP_HEIGHT = 20;

// 19x20 Grid
// 0: Wall, 1: Dot, 2: Power, 3: Empty, 4: House
export const BASE_MAP: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,2,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,2,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,1,0],
  [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,1,0,0,0,3,0,3,0,0,0,1,0,0,0,0],
  [3,3,3,0,1,0,3,3,3,3,3,3,3,0,1,0,3,3,3],
  [0,0,0,0,1,0,3,0,0,4,0,0,3,0,1,0,0,0,0],
  [3,3,3,3,1,3,3,0,4,4,4,0,3,3,1,3,3,3,3],
  [0,0,0,0,1,0,3,0,0,0,0,0,3,0,1,0,0,0,0],
  [3,3,3,0,1,0,3,3,3,3,3,3,3,0,1,0,3,3,3],
  [0,0,0,0,1,0,1,0,0,0,0,0,1,0,1,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,1,0,0,0,1,0,1,0,0,0,1,0,0,1,0],
  [0,2,1,0,1,1,1,1,1,1,1,1,1,1,1,0,1,2,0],
  [0,0,1,0,1,0,1,0,0,0,0,0,1,0,1,0,1,0,0],
  [0,1,1,1,1,0,1,1,1,0,1,1,1,0,1,1,1,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export const THEMES: LevelTheme[] = [
  { // Level 1: Cyber Blue
    name: 'CYBER BLUE',
    wallColor: '#00d9ff',
    dotColor: '#ff0099',
    bgColor: '#050505'
  },
  { // Level 2: Matrix Green
    name: 'MATRIX GREEN',
    wallColor: '#00ff41',
    dotColor: '#e0ff00',
    bgColor: '#001100'
  },
  { // Level 3: Hellscape Red
    name: 'NEON INFERNO',
    wallColor: '#ff2a00',
    dotColor: '#ffcc00',
    bgColor: '#1a0505'
  },
  { // Level 4: Vaporwave
    name: 'VAPORWAVE',
    wallColor: '#ff71ce',
    dotColor: '#01cdfe',
    bgColor: '#050510'
  }
];

export const MOVEMENT_SPEED = 0.15; // Grid cells per tick
export const GHOST_SPEED = 0.08;