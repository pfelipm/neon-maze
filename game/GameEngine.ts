import { BASE_MAP, MAP_HEIGHT, MAP_WIDTH, MOVEMENT_SPEED, GHOST_SPEED } from '../constants';
import { Direction, Entity, Ghost, GhostState, GhostType, Particle, TileType, LevelModifier } from '../types';
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

  constructor() {
    // Initial placeholder, will be reset immediately
    this.player = { x: 9.5, y: 16.5, dir: 'NONE', nextDir: 'NONE', speed: MOVEMENT_SPEED, radius: 0.4, color: '#ffff00' };
    this.resetLevel(1);
  }

  resetLevel(level: number) {
    this.level = level;
    // Deep copy map
    this.map = BASE_MAP.map(row => [...row]);
    this.dotsRemaining = 0;
    
    // Pick Modifier
    if (this.level > 1) {
      const modifiers = Object.values(LevelModifier).filter(m => m !== LevelModifier.NONE);
      // 50% chance of a modifier
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

    // Player Spawn at (9.5, 16.5) - Row 16 is safe, Row 15 was a wall
    this.player = { x: 9.5, y: 16.5, dir: 'NONE', nextDir: 'NONE', speed: playerSpeed, radius: 0.4, color: '#ffea00' };
    
    // Determine ghost speed based on modifier
    let ghostBaseSpeed = GHOST_SPEED + (Math.min(this.level, 10) * 0.005);
    if (this.modifier === LevelModifier.FAST_GHOSTS) ghostBaseSpeed *= 1.15;

    const ghostTypes = [GhostType.AGGRESSIVE, GhostType.AMBUSH, GhostType.RANDOM];
    const getRandomType = () => ghostTypes[Math.floor(Math.random() * ghostTypes.length)];
    
    // Base 5 Ghosts (Default)
    this.ghosts = [
      // 1. Outside Ghost (Aggressive) - Above house
      { x: 9.5, y: 8.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed, radius: 0.4, color: '#ff0000', type: GhostType.AGGRESSIVE, state: GhostState.SCATTER, scaredTimer: 0, trail: [] },
      
      // 2. Center Ghost (Ambush) - Inside House
      { x: 9.5, y: 9.5, dir: 'UP', nextDir: 'UP', speed: ghostBaseSpeed * 0.95, radius: 0.4, color: '#ffb8ff', type: GhostType.AMBUSH, state: GhostState.SCATTER, scaredTimer: 0, trail: [] },
      
      // 3. Bottom Ghost (Random) - Inside House
      { x: 9.5, y: 10.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.9, radius: 0.4, color: '#00ffff', type: GhostType.RANDOM, state: GhostState.SCATTER, scaredTimer: 0, trail: [] },
      
      // 4. Extra Ghost 1 - Inside House Left
      { x: 8.5, y: 10.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed * 0.92, radius: 0.4, color: '#ffbf00', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [] },
      
      // 5. Extra Ghost 2 - Inside House Right
      { x: 10.5, y: 10.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.88, radius: 0.4, color: '#39ff14', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [] },
    ];

    // Randomly determine if we add extra ghosts (Max 2 extras)
    // 60% Chance of 5 ghosts (Default)
    // 25% Chance of 6 ghosts
    // 15% Chance of 7 ghosts
    let extrasToAdd = 0;
    const r = Math.random();
    if (r > 0.60) extrasToAdd = 1;
    if (r > 0.85) extrasToAdd = 2;

    // 6. Optional Ghost 1 - Outside Left (Safe spot)
    if (extrasToAdd >= 1) {
      this.ghosts.push(
        { x: 7.5, y: 8.5, dir: 'LEFT', nextDir: 'LEFT', speed: ghostBaseSpeed * 0.93, radius: 0.4, color: '#bf00ff', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [] }
      );
    }

    // 7. Optional Ghost 2 - Outside Right (Safe spot)
    if (extrasToAdd >= 2) {
      this.ghosts.push(
        { x: 11.5, y: 8.5, dir: 'RIGHT', nextDir: 'RIGHT', speed: ghostBaseSpeed * 0.94, radius: 0.4, color: '#ff0055', type: getRandomType(), state: GhostState.SCATTER, scaredTimer: 0, trail: [] }
      );
    }

    this.state = 'PLAYING';
  }

  update(dt: number) {
    if (this.state === 'DYING') return;

    const time = Date.now() / 1000;
    
    // Mode Switching (Scatter/Chase)
    this.modeTimer += dt;
    // Faster mode switching if modifier active
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

    this.updatePlayer(dt, time);
    this.updateGhosts(dt);
    this.updateParticles(dt);
  }

  private updatePlayer(dt: number, time: number) {
    // Attempt to change direction
    if (this.player.nextDir !== 'NONE') {
        const cx = Math.floor(this.player.x) + 0.5;
        const cy = Math.floor(this.player.y) + 0.5;
        
        // We can only turn if we are close to the center AND the target tile is valid
        if (this.canMove(this.player.x, this.player.y, this.player.nextDir, false)) {
             // Loosen the turn tolerance to 0.35 to make it snappier
             if (Math.abs(this.player.x - cx) < 0.35 && Math.abs(this.player.y - cy) < 0.35) {
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
        // Snap to center if hit wall
        this.player.x = Math.floor(this.player.x) + 0.5;
        this.player.y = Math.floor(this.player.y) + 0.5;
      }
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
          // Restore speed based on modifier
          let base = GHOST_SPEED + (this.level * 0.005);
          if (this.modifier === LevelModifier.FAST_GHOSTS) base *= 1.15;
          ghost.speed = base; 
        }
      }

      const oldX = ghost.x;
      const oldY = ghost.y;

      // 2. Movement Calculations
      // Determine effective speed
      let moveSpeed = ghost.speed;
      if (ghost.state === GhostState.FRIGHTENED) moveSpeed *= 0.6;
      else if (ghost.state === GhostState.EATEN) moveSpeed *= 2.0;

      const dx = ghost.dir === 'LEFT' ? -1 : ghost.dir === 'RIGHT' ? 1 : 0;
      const dy = ghost.dir === 'UP' ? -1 : ghost.dir === 'DOWN' ? 1 : 0;
      
      const gx = ghost.x;
      const gy = ghost.y;
      const cx = Math.floor(gx) + 0.5;
      const cy = Math.floor(gy) + 0.5;

      // Calculate vector from current pos to center
      const vX = cx - gx;
      const vY = cy - gy;

      // Calculate distance along the movement axis
      // Dot product: if > 0, we are moving towards the center.
      // if < 0, we are moving away.
      const distToCenter = (vX * dx) + (vY * dy);
      
      // Check if we cross the center this frame
      // We cross if we are approaching (dist >= 0) AND distance is less than speed
      // Added 0.001 epsilon for float precision
      let turned = false;

      if (distToCenter >= -0.001 && distToCenter <= moveSpeed + 0.001) {
          // --- ARRIVE AT TILE CENTER ---
          ghost.x = cx;
          ghost.y = cy;
          
          // RUN AI
          this.decideGhostDirection(ghost);

          // Apply remaining movement in NEW direction
          const remaining = Math.max(0, moveSpeed - distToCenter);
          const ndx = ghost.dir === 'LEFT' ? -1 : ghost.dir === 'RIGHT' ? 1 : 0;
          const ndy = ghost.dir === 'UP' ? -1 : ghost.dir === 'DOWN' ? 1 : 0;
          
          ghost.x += ndx * remaining;
          ghost.y += ndy * remaining;
          turned = true;
      } else {
          // --- MOVE NORMALLY ---
          ghost.x += dx * moveSpeed;
          ghost.y += dy * moveSpeed;
      }
      
      // 3. Wrap Around (Tunnel)
      if (ghost.x < 0) ghost.x = MAP_WIDTH - 1;
      if (ghost.x >= MAP_WIDTH) ghost.x = 0;

      // 4. Update Trail
      // If we warped or snapped far (shouldn't happen often), reset trail
      if (Math.abs(ghost.x - oldX) > 2 || Math.abs(ghost.y - oldY) > 2) {
          ghost.trail = [];
      } else {
          ghost.trail.push({ x: ghost.x, y: ghost.y });
          if (ghost.trail.length > 20) ghost.trail.shift();
      }

      // 5. Respawn Logic (Eaten -> House)
      if (ghost.state === GhostState.EATEN && Math.abs(ghost.x - 9.5) < 1 && Math.abs(ghost.y - 9.5) < 1) {
          ghost.state = GhostState.SCATTER; 
          
          let base = GHOST_SPEED + (this.level * 0.005);
          if (this.modifier === LevelModifier.FAST_GHOSTS) base *= 1.15;
          ghost.speed = base;
          
          ghost.dir = 'UP'; // Force them to move out
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
          this.handleDeath();
        }
      }
    });
  }

  private decideGhostDirection(ghost: Ghost) {
    const gx = Math.floor(ghost.x);
    const gy = Math.floor(ghost.y);
    
    // Find all possible moves excluding reverse
    const possibleDirs: Direction[] = ['UP', 'DOWN', 'LEFT', 'RIGHT'].filter(d => 
      d !== this.getOppositeDir(ghost.dir) && this.canMove(ghost.x, ghost.y, d as Direction, true)
    ) as Direction[];

    // Special Rule: If NOT eaten, do not re-enter ghost house (Tile 4) from a non-house tile
    const validDirs = possibleDirs.filter(d => {
        if (ghost.state === GhostState.EATEN) return true; 
        
        const dx = d === 'LEFT' ? -1 : d === 'RIGHT' ? 1 : 0;
        const dy = d === 'UP' ? -1 : d === 'DOWN' ? 1 : 0;
        const tx = gx + dx;
        const ty = gy + dy;
        
        const currentTile = this.map[gy][gx];
        const targetTile = this.map[ty]?.[tx];
        
        if (currentTile !== TileType.GHOST_HOUSE && targetTile === TileType.GHOST_HOUSE) {
            return false;
        }
        return true;
    });

    // Use validDirs if available, else fallback to possibleDirs (in case trapped)
    const candidates = validDirs.length > 0 ? validDirs : possibleDirs;

    if (candidates.length > 0) {
      let targetX = this.player.x;
      let targetY = this.player.y;

      // AI Targeting Logic
      if (ghost.state === GhostState.EATEN) {
         targetX = 9.5; targetY = 9.5; // Return to house center
      } else if (ghost.state === GhostState.SCATTER) {
        if (ghost.type === GhostType.AGGRESSIVE) { targetX = MAP_WIDTH - 2; targetY = 1; }
        else if (ghost.type === GhostType.AMBUSH) { targetX = 1; targetY = 1; }
        else { targetX = 1; targetY = MAP_HEIGHT - 2; }
      } else if (ghost.state === GhostState.FRIGHTENED) {
        targetX = Math.random() * MAP_WIDTH;
        targetY = Math.random() * MAP_HEIGHT;
      } else if (ghost.type === GhostType.AMBUSH) {
        // IMPROVED AMBUSH (Pinky): Target 4 tiles ahead of player
        const d = this.player.nextDir !== 'NONE' ? this.player.nextDir : this.player.dir;
        const offset = 4;
        const pdx = d === 'LEFT' ? -offset : d === 'RIGHT' ? offset : 0;
        const pdy = d === 'UP' ? -offset : d === 'DOWN' ? offset : 0;
        targetX += pdx;
        targetY += pdy;
      } else if (ghost.type === GhostType.RANDOM) {
        // IMPROVED RANDOM (Clyde): "Feigned Ignorance"
        const dist = Math.hypot(ghost.x - this.player.x, ghost.y - this.player.y);
        if (dist > 8) {
            targetX = this.player.x;
            targetY = this.player.y;
        } else {
            // Scatter target (Bottom Left)
            targetX = 1;
            targetY = MAP_HEIGHT - 2;
        }
      }

      // Choose best direction minimizing distance to target
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
       // Dead end or trapped: Force reverse
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
    
    if (tx < 0 || tx >= MAP_WIDTH) return true; // Tunnel
    if (ty < 0 || ty >= MAP_HEIGHT) return false;

    // Safety check for map bounds
    if (!this.map[ty] || this.map[ty][tx] === undefined) return false;

    const tile = this.map[ty][tx];
    if (isGhost) {
      // Ghosts can walk through walls if Eaten (to get home fast)? 
      // No, usually they follow path. But here we only block WALLs.
      // They can walk on HOUSE (4), EMPTY (3), DOT (1), PELLET (2).
      return tile !== TileType.WALL;
    }
    // Player cannot enter Ghost House
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