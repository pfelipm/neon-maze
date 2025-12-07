
import { BASE_MAP, MAP_HEIGHT, MAP_WIDTH, MOVEMENT_SPEED, GHOST_SPEED } from '../constants';
import { Direction, Entity, Ghost, GhostState, GhostType, Particle, TileType, LevelModifier, ItemType } from '../types';
import { audioManager } from '../utils/audio';

export class GameEngine {
  map: number[][] = [];
  player: Entity;
  ghosts: Ghost[] = [];
  particles: Particle[] = [];
  score: number = 0;
  lives: number = 3;
  level: number = 1;
  state: 'PLAYING' | 'DYING' = 'PLAYING';
  modifier: LevelModifier = LevelModifier.NONE;
  
  private modeTimer: number = 0;
  private dotsRemaining: number = 0;
  private itemSpawnTimer: number = 0; // Timer for spawning items

  constructor() {
    // Initial placeholder
    this.player = { 
      x: 9.5, y: 16.5, dir: 'NONE', nextDir: 'NONE', 
      speed: MOVEMENT_SPEED, baseSpeed: MOVEMENT_SPEED, 
      radius: 0.4, color: '#ffff00', 
      inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0,
      trail: [] 
    };
    this.resetLevel(1);
  }

  resetLevel(level: number) {
    this.level = level;
    // Deep copy map
    this.map = BASE_MAP.map(row => [...row]);
    this.dotsRemaining = 0;
    this.itemSpawnTimer = 0;
    
    // Pick Modifier
    if (this.level > 1) {
      const modifiers = Object.values(LevelModifier).filter(m => m !== LevelModifier.NONE);
      if (Math.random() > 0.5) {
        this.modifier = modifiers[Math.floor(Math.random() * modifiers.length)];
      } else {
        this.modifier = LevelModifier.NONE;
      }
    } else {
      this.modifier = LevelModifier.NONE;
    }

    // Count dots
    for(let y=0; y<MAP_HEIGHT; y++) {
      for(let x=0; x<MAP_WIDTH; x++) {
        if (this.map[y][x] === TileType.DOT || this.map[y][x] === TileType.POWER_PELLET) {
          this.dotsRemaining++;
        }
      }
    }

    this.resetPositions();
  }

  resetPositions() {
    // Determine speed based on modifier
    let playerSpeed = MOVEMENT_SPEED + (this.level * 0.01);
    if (this.modifier === LevelModifier.SLOW_PLAYER) playerSpeed *= 0.85;

    // Player Spawn
    this.player = { 
      x: 9.5, y: 16.5, dir: 'NONE', nextDir: 'NONE', 
      speed: playerSpeed, baseSpeed: playerSpeed,
      radius: 0.4, color: '#ffea00',
      // Keep inventory if surviving? No, reset for balance logic usually, but let's keep it fun
      inventory: this.player?.inventory || ItemType.NONE, 
      activeEffect: ItemType.NONE, 
      effectTimer: 0,
      trail: []
    };
    
    // Determine ghost speed based on modifier
    let ghostBaseSpeed = GHOST_SPEED + (Math.min(this.level, 10) * 0.005);
    if (this.modifier === LevelModifier.FAST_GHOSTS) ghostBaseSpeed *= 1.15;

    const ghostTypes = [GhostType.AGGRESSIVE, GhostType.AMBUSH, GhostType.RANDOM];
    const getRandomType = () => ghostTypes[Math.floor(Math.random() * ghostTypes.length)];
    
    // Base 5 Ghosts (Default)
    this.ghosts = [
      { x: 9.5, y: 8.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed, baseSpeed: ghostBaseSpeed, radius: 0.4, color: '#ff0000', type: GhostType.AGGRESSIVE, state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 },
      { x: 9.5, y: 9.5, dir: 'UP', nextDir: 'UP', speed: ghostBaseSpeed * 0.95, baseSpeed: ghostBaseSpeed * 0.95, radius: 0.4, color: '#ffb8ff', type: GhostType.AMBUSH, state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 },
      { x: 9.5, y: 10.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.9, baseSpeed: ghostBaseSpeed * 0.9, radius: 0.4, color: '#00ffff', type: GhostType.RANDOM, state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 },
      { x: 8.5, y: 10.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed * 0.92, baseSpeed: ghostBaseSpeed * 0.92, radius: 0.4, color: '#ffbf00', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 },
      { x: 10.5, y: 10.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.88, baseSpeed: ghostBaseSpeed * 0.88, radius: 0.4, color: '#39ff14', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 },
    ];

    // "Escalada de Caos" (Chaos Escalation) Logic
    const prob6 = Math.min(0.8, Math.max(0, 0.1 * (this.level - 1)));
    const prob7 = Math.min(0.5, Math.max(0, 0.05 * (this.level - 3)));

    let extrasToAdd = 0;
    
    if (Math.random() < prob6) {
        extrasToAdd++;
        if (Math.random() < prob7) {
            extrasToAdd++;
        }
    }

    if (extrasToAdd >= 1) {
      this.ghosts.push(
        { x: 7.5, y: 8.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed * 0.93, baseSpeed: ghostBaseSpeed * 0.93, radius: 0.4, color: '#bf00ff', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 }
      );
    }
    if (extrasToAdd >= 2) {
      this.ghosts.push(
        { x: 11.5, y: 8.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.94, baseSpeed: ghostBaseSpeed * 0.94, radius: 0.4, color: '#ff0055', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [], inventory: ItemType.NONE, activeEffect: ItemType.NONE, effectTimer: 0 }
      );
    }

    this.state = 'PLAYING';
  }

  update(dt: number) {
    if (this.state === 'DYING') return;

    const time = Date.now() / 1000;
    
    // Mode Switching
    this.modeTimer += dt;
    const modeSwitchTime = this.modifier === LevelModifier.GHOST_FRENZY ? 10 : 20;
    if (this.modeTimer > modeSwitchTime) { 
      this.ghosts.forEach(g => {
        if (g.state !== GhostState.FRIGHTENED && g.state !== GhostState.EATEN) {
          g.state = g.state === GhostState.CHASE ? GhostState.SCATTER : GhostState.CHASE;
          g.nextDir = this.getOppositeDir(g.dir);
        }
      });
      this.modeTimer = 0;
    }

    // Item Spawning Logic
    this.updateItemSpawning(dt);

    this.updatePlayer(dt, time);
    this.updateGhosts(dt);
    this.updateParticles(dt);
  }

  private updateItemSpawning(dt: number) {
    this.itemSpawnTimer += dt;
    // Spawn item every 45 seconds
    if (this.itemSpawnTimer > 45) {
        this.itemSpawnTimer = 0;

        // Check how many items are currently on the map
        let currentItemCount = 0;
        for(let y=0; y<MAP_HEIGHT; y++) {
            for(let x=0; x<MAP_WIDTH; x++) {
                if (this.map[y][x] === TileType.ITEM_SPEED || this.map[y][x] === TileType.ITEM_PHASE) {
                    currentItemCount++;
                }
            }
        }

        // Cap at 2 items on map to prevent clutter
        if (currentItemCount >= 2) return;

        // Find empty spots
        const emptySpots: {x: number, y: number}[] = [];
        for(let y=1; y<MAP_HEIGHT-1; y++) {
            for(let x=1; x<MAP_WIDTH-1; x++) {
                if(this.map[y][x] === TileType.EMPTY) {
                    const originalTile = BASE_MAP[y][x];
                    if (originalTile === TileType.DOT || originalTile === TileType.POWER_PELLET) {
                        emptySpots.push({x, y});
                    }
                }
            }
        }
        
        if (emptySpots.length > 0) {
            const spot = emptySpots[Math.floor(Math.random() * emptySpots.length)];
            const type = Math.random() > 0.5 ? TileType.ITEM_SPEED : TileType.ITEM_PHASE;
            this.map[spot.y][spot.x] = type;
            this.spawnParticles(spot.x + 0.5, spot.y + 0.5, type === TileType.ITEM_SPEED ? '#00ffff' : '#ff00ff');
        }
    }
  }

  // Called from App.tsx on Spacebar/Button
  public activateItem() {
      if (this.player.inventory === ItemType.NONE) return;

      this.player.activeEffect = this.player.inventory;
      this.player.inventory = ItemType.NONE;
      this.player.effectTimer = 3.0; // 3 Seconds duration

      if (this.player.activeEffect === ItemType.SPEED) {
          this.player.speed = this.player.baseSpeed * 1.8; 
          audioManager.playPowerUp(); 
      } else if (this.player.activeEffect === ItemType.PHASE) {
          audioManager.playPowerUp();
      }
  }

  private updatePlayer(dt: number, time: number) {
    // Handle Active Effects
    if (this.player.activeEffect !== ItemType.NONE) {
        this.player.effectTimer -= dt;
        if (this.player.effectTimer <= 0) {
            // Reset stats
            this.player.speed = this.player.baseSpeed;
            this.player.activeEffect = ItemType.NONE;
        }
    }

    const oldX = this.player.x;
    const oldY = this.player.y;

    // Attempt to change direction
    if (this.player.nextDir !== 'NONE') {
        const cx = Math.floor(this.player.x) + 0.5;
        const cy = Math.floor(this.player.y) + 0.5;
        
        const tolerance = this.player.activeEffect === ItemType.SPEED ? 0.45 : 0.35;

        if (this.canMove(this.player.x, this.player.y, this.player.nextDir, false)) {
             if (Math.abs(this.player.x - cx) < tolerance && Math.abs(this.player.y - cy) < tolerance) {
                 this.player.x = cx;
                 this.player.y = cy;
                 this.player.dir = this.player.nextDir;
                 this.player.nextDir = 'NONE';
             }
        }
    }

    if (this.player.dir !== 'NONE') {
      if (this.canMove(this.player.x, this.player.y, this.player.dir, false)) {
        const dx = this.player.dir === 'LEFT' ? -1 : this.player.dir === 'RIGHT' ? 1 : 0;
        const dy = this.player.dir === 'UP' ? -1 : this.player.dir === 'DOWN' ? 1 : 0;
        
        this.player.x += dx * this.player.speed;
        this.player.y += dy * this.player.speed;

        // Warp Tunnel
        if (this.player.x < 0) this.player.x = MAP_WIDTH - 1;
        if (this.player.x >= MAP_WIDTH) this.player.x = 0;

        audioManager.playWaka(time);
      } else {
        // Snap to center
        this.player.x = Math.floor(this.player.x) + 0.5;
        this.player.y = Math.floor(this.player.y) + 0.5;
      }
    }

    // Update Player Trail
    if (Math.abs(this.player.x - oldX) > 2 || Math.abs(this.player.y - oldY) > 2) {
        this.player.trail = [];
    } else {
        this.player.trail.push({ x: this.player.x, y: this.player.y });
        // Keep trail shorter than ghosts generally, or dependent on speed
        const maxTrail = this.player.activeEffect === ItemType.SPEED ? 15 : 8;
        if (this.player.trail.length > maxTrail) this.player.trail.shift();
    }

    // Collision with items
    const gx = Math.floor(this.player.x);
    const gy = Math.floor(this.player.y);

    if (gx >= 0 && gx < MAP_WIDTH && gy >= 0 && gy < MAP_HEIGHT) {
      const tile = this.map[gy][gx];
      
      if (tile === TileType.DOT) {
        this.map[gy][gx] = TileType.EMPTY;
        this.score += 10;
        this.dotsRemaining--;
        this.spawnParticles(this.player.x, this.player.y, '#ffff00');
        audioManager.playEat();
      } else if (tile === TileType.POWER_PELLET) {
        this.map[gy][gx] = TileType.EMPTY;
        this.score += 50;
        this.dotsRemaining--;
        this.frightenGhosts();
        audioManager.playPowerUp();
      } else if (tile === TileType.ITEM_SPEED) {
          if (this.player.inventory === ItemType.NONE) {
            this.map[gy][gx] = TileType.EMPTY;
            this.player.inventory = ItemType.SPEED;
            this.score += 50;
            this.spawnParticles(this.player.x, this.player.y, '#00ffff');
            audioManager.playEatGhost(); // Satisfying sound
          }
      } else if (tile === TileType.ITEM_PHASE) {
          if (this.player.inventory === ItemType.NONE) {
            this.map[gy][gx] = TileType.EMPTY;
            this.player.inventory = ItemType.PHASE;
            this.score += 50;
            this.spawnParticles(this.player.x, this.player.y, '#ff00ff');
            audioManager.playEatGhost();
          }
      }
    }
  }

  private updateGhosts(dt: number) {
    this.ghosts.forEach(ghost => {
      // 1. Scared Timer Logic
      if (ghost.state === GhostState.FRIGHTENED) {
        ghost.scaredTimer -= dt;
        if (ghost.scaredTimer <= 0) {
          ghost.state = GhostState.CHASE;
          // Restore speed
          let base = GHOST_SPEED + (this.level * 0.005);
          if (this.modifier === LevelModifier.FAST_GHOSTS) base *= 1.15;
          ghost.speed = base; 
        }
      }

      const oldX = ghost.x;
      const oldY = ghost.y;

      // 2. Movement Calculations
      let moveSpeed = ghost.speed;
      if (ghost.state === GhostState.FRIGHTENED) moveSpeed *= 0.6;
      else if (ghost.state === GhostState.EATEN) moveSpeed *= 2.0;

      const dx = ghost.dir === 'LEFT' ? -1 : ghost.dir === 'RIGHT' ? 1 : 0;
      const dy = ghost.dir === 'UP' ? -1 : ghost.dir === 'DOWN' ? 1 : 0;
      
      const gx = ghost.x;
      const gy = ghost.y;
      const cx = Math.floor(gx) + 0.5;
      const cy = Math.floor(gy) + 0.5;

      const vX = cx - gx;
      const vY = cy - gy;
      const distToCenter = (vX * dx) + (vY * dy);
      
      // Robust Center Crossing
      if (distToCenter >= -0.001 && distToCenter <= moveSpeed + 0.001) {
          ghost.x = cx;
          ghost.y = cy;
          this.decideGhostDirection(ghost);
          const remaining = Math.max(0, moveSpeed - distToCenter);
          const ndx = ghost.dir === 'LEFT' ? -1 : ghost.dir === 'RIGHT' ? 1 : 0;
          const ndy = ghost.dir === 'UP' ? -1 : ghost.dir === 'DOWN' ? 1 : 0;
          ghost.x += ndx * remaining;
          ghost.y += ndy * remaining;
      } else {
          ghost.x += dx * moveSpeed;
          ghost.y += dy * moveSpeed;
      }
      
      if (ghost.x < 0) ghost.x = MAP_WIDTH - 1;
      if (ghost.x >= MAP_WIDTH) ghost.x = 0;

      if (Math.abs(ghost.x - oldX) > 2 || Math.abs(ghost.y - oldY) > 2) {
          ghost.trail = [];
      } else {
          ghost.trail.push({ x: ghost.x, y: ghost.y });
          if (ghost.trail.length > 20) ghost.trail.shift();
      }

      // Respawn Logic
      if (ghost.state === GhostState.EATEN && Math.abs(ghost.x - 9.5) < 1 && Math.abs(ghost.y - 9.5) < 1) {
          ghost.state = GhostState.SCATTER; 
          let base = GHOST_SPEED + (this.level * 0.005);
          if (this.modifier === LevelModifier.FAST_GHOSTS) base *= 1.15;
          ghost.speed = base;
          ghost.dir = 'UP';
          ghost.trail = []; 
      }

      // 6. Collision with Player
      const distToPlayer = Math.hypot(ghost.x - this.player.x, ghost.y - this.player.y);
      if (distToPlayer < 0.6) {
        if (ghost.state === GhostState.FRIGHTENED) {
          ghost.state = GhostState.EATEN;
          this.score += 200;
          this.spawnParticles(ghost.x, ghost.y, '#ffffff');
          audioManager.playEatGhost();
        } else if (ghost.state !== GhostState.EATEN) {
          // CHECK FOR PHASE SHIFT (INVISIBILITY)
          if (this.player.activeEffect === ItemType.PHASE) {
              // Pass through! Maybe spawn a small glitch particle to show contact
              if (Math.random() > 0.8) this.spawnParticles(this.player.x, this.player.y, '#ffffff');
          } else {
              this.handleDeath();
          }
        }
      }
    });
  }

  private decideGhostDirection(ghost: Ghost) {
    const gx = Math.floor(ghost.x);
    const gy = Math.floor(ghost.y);
    
    const possibleDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'].filter(d => 
      d !== this.getOppositeDir(ghost.dir) && this.canMove(ghost.x, ghost.y, d as Direction, true)
    ) as Direction[];

    const validDirs = possibleDirs.filter(d => {
        if (ghost.state === GhostState.EATEN) return true; 
        const dx = d === 'LEFT' ? -1 : d === 'RIGHT' ? 1 : 0;
        const dy = d === 'UP' ? -1 : d === 'DOWN' ? 1 : 0;
        const tx = gx + dx;
        const ty = gy + dy;
        const currentTile = this.map[gy][gx];
        const targetTile = this.map[ty]?.[tx];
        if (currentTile !== TileType.GHOST_HOUSE && targetTile === TileType.GHOST_HOUSE) return false;
        return true;
    });

    const candidates = validDirs.length > 0 ? validDirs : possibleDirs;

    if (candidates.length > 0) {
      let targetX = this.player.x;
      let targetY = this.player.y;

      if (ghost.state === GhostState.EATEN) {
         targetX = 9.5; targetY = 9.5;
      } else if (ghost.state === GhostState.SCATTER) {
        if (ghost.type === GhostType.AGGRESSIVE) { targetX = MAP_WIDTH - 2; targetY = 1; }
        else if (ghost.type === GhostType.AMBUSH) { targetX = 1; targetY = 1; }
        else { targetX = 1; targetY = MAP_HEIGHT - 2; }
      } else if (ghost.state === GhostState.FRIGHTENED) {
        targetX = Math.random() * MAP_WIDTH;
        targetY = Math.random() * MAP_HEIGHT;
      } else if (ghost.type === GhostType.AMBUSH) {
        const d = this.player.nextDir !== 'NONE' ? this.player.nextDir : this.player.dir;
        const offset = 4;
        const pdx = d === 'LEFT' ? -offset : d === 'RIGHT' ? offset : 0;
        const pdy = d === 'UP' ? -offset : d === 'DOWN' ? offset : 0;
        targetX += pdx;
        targetY += pdy;
      } else if (ghost.type === GhostType.RANDOM) {
        const dist = Math.hypot(ghost.x - this.player.x, ghost.y - this.player.y);
        if (dist > 8) {
            targetX = this.player.x;
            targetY = this.player.y;
        } else {
            targetX = 1;
            targetY = MAP_HEIGHT - 2;
        }
      }

      ghost.dir = candidates.reduce((best, current) => {
        const dx = current === 'LEFT' ? -1 : current === 'RIGHT' ? 1 : 0;
        const dy = current === 'UP' ? -1 : current === 'DOWN' ? 1 : 0;
        const dist = Math.hypot((gx + dx) - targetX, (gy + dy) - targetY);
        
        const bestDx = best === 'LEFT' ? -1 : best === 'RIGHT' ? 1 : 0;
        const bestDy = best === 'UP' ? -1 : best === 'DOWN' ? 1 : 0;
        const bestDist = Math.hypot((gx + bestDx) - targetX, (gy + bestDy) - targetY);
        
        return dist < bestDist ? current : best;
      });
    } else {
       ghost.dir = this.getOppositeDir(ghost.dir);
    }
  }

  private handleDeath() {
    this.state = 'DYING';
    audioManager.playDie();
    this.lives--;
  }

  private frightenGhosts() {
    this.ghosts.forEach(g => {
      if (g.state !== GhostState.EATEN) {
        g.state = GhostState.FRIGHTENED;
        g.scaredTimer = 6;
        g.nextDir = this.getOppositeDir(g.dir); 
        g.dir = g.nextDir;
      }
    });
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
  }

  private spawnParticles(x: number, y: number, color: string) {
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 2 + Math.random();
      this.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.5,
        maxLife: 0.5,
        color
      });
    }
  }

  private canMove(x: number, y: number, dir: Direction, isGhost: boolean = false): boolean {
    const dx = dir === 'LEFT' ? -1 : dir === 'RIGHT' ? 1 : 0;
    const dy = dir === 'UP' ? -1 : dir === 'DOWN' ? 1 : 0;
    const tx = Math.floor(x) + dx;
    const ty = Math.floor(y) + dy;
    
    if (tx < 0 || tx >= MAP_WIDTH) return true; 
    if (ty < 0 || ty >= MAP_HEIGHT) return false;

    if (!this.map[ty] || this.map[ty][tx] === undefined) return false;

    const tile = this.map[ty][tx];
    if (isGhost) {
      return tile !== TileType.WALL;
    }
    return tile !== TileType.WALL && tile !== TileType.GHOST_HOUSE;
  }

  private getOppositeDir(dir: Direction): Direction {
    if (dir === 'UP') return 'DOWN';
    if (dir === 'DOWN') return 'UP';
    if (dir === 'LEFT') return 'RIGHT';
    if (dir === 'RIGHT') return 'LEFT';
    return 'NONE';
  }

  checkLevelComplete(): boolean {
    return this.dotsRemaining === 0;
  }
}
