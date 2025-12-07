
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState, TileType, GhostState, Direction, LevelModifier, ItemType } from './types';
import { BASE_MAP, TILE_SIZE, THEMES, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { VirtualJoystick } from './components/VirtualJoystick';
import { audioManager } from './utils/audio';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const requestRef = useRef<number>(0);
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [inventory, setInventory] = useState<ItemType>(ItemType.NONE);
  
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);
  const [gameOverActionIndex, setGameOverActionIndex] = useState(0); // 0: Restart, 1: Menu

  const getThemeName = () => {
    if (!engineRef.current) return '';
    const idx = (selectedThemeIndex + engineRef.current.level - 1) % THEMES.length;
    return THEMES[idx].name;
  };

  const getModifierName = () => {
    if (!engineRef.current) return '';
    if (engineRef.current.modifier === LevelModifier.NONE) return '';
    return engineRef.current.modifier;
  };

  // Rendering Logic - Moved before animate to prevent ReferenceError
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (!engineRef.current) return;
    const engine = engineRef.current;
    
    const currentThemeIndex = (selectedThemeIndex + engine.level - 1) % THEMES.length;
    const theme = THEMES[currentThemeIndex];

    ctx.fillStyle = theme.bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = (Math.min(canvas.width, canvas.height) / (MAP_WIDTH * TILE_SIZE)) * 0.9;
    const offsetX = (canvas.width - MAP_WIDTH * TILE_SIZE * scale) / 2;
    const offsetY = (canvas.height - MAP_HEIGHT * TILE_SIZE * scale) / 2;

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    // 1. Draw Map
    ctx.lineWidth = 2;
    ctx.strokeStyle = theme.wallColor;
    ctx.shadowBlur = 10;
    ctx.shadowColor = theme.wallColor;
    
    if (engine.map && engine.map.length > 0) {
        const rows = engine.map.length;
        const cols = engine.map[0].length;
        
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const tile = engine.map[y][x];
            const px = x * TILE_SIZE;
            const py = y * TILE_SIZE;

            if (tile === TileType.WALL) {
              ctx.strokeRect(px + 4, py + 4, TILE_SIZE - 8, TILE_SIZE - 8);
            } else if (tile === TileType.DOT) {
              let alpha = 1.0;
              if (engine.modifier === LevelModifier.BLINKING_DOTS) {
                  alpha = 0.3 + 0.7 * Math.abs(Math.sin((Date.now() / 300) + x + y));
              }
              ctx.globalAlpha = alpha;
              ctx.fillStyle = theme.dotColor;
              ctx.shadowBlur = 5;
              ctx.shadowColor = theme.dotColor;
              ctx.beginPath();
              ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 2, 0, Math.PI * 2);
              ctx.fill();
              ctx.globalAlpha = 1.0;
            } else if (tile === TileType.POWER_PELLET) {
              if (Math.floor(Date.now() / 200) % 2 === 0) {
                  ctx.fillStyle = theme.dotColor;
                  ctx.shadowBlur = 15;
                  ctx.shadowColor = theme.dotColor;
                  ctx.beginPath();
                  ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 6, 0, Math.PI * 2);
                  ctx.fill();
              }
            } else if (tile === TileType.ITEM_SPEED) {
               // Draw Speed Bolt
               ctx.fillStyle = '#00ffff';
               ctx.shadowColor = '#00ffff';
               ctx.shadowBlur = 15;
               ctx.beginPath();
               ctx.moveTo(px + TILE_SIZE * 0.7, py + TILE_SIZE * 0.2);
               ctx.lineTo(px + TILE_SIZE * 0.3, py + TILE_SIZE * 0.6);
               ctx.lineTo(px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.6);
               ctx.lineTo(px + TILE_SIZE * 0.3, py + TILE_SIZE * 0.9);
               ctx.lineTo(px + TILE_SIZE * 0.7, py + TILE_SIZE * 0.5);
               ctx.lineTo(px + TILE_SIZE * 0.5, py + TILE_SIZE * 0.5);
               ctx.closePath();
               ctx.fill();
            } else if (tile === TileType.ITEM_PHASE) {
                // Draw Phase Eye
                ctx.fillStyle = '#ff00ff';
                ctx.shadowColor = '#ff00ff';
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE * 0.3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000';
                ctx.beginPath();
                ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, TILE_SIZE * 0.1, 0, Math.PI * 2);
                ctx.fill();
            }
          }
        }
    }

    // 2. Draw Particles
    engine.particles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
      ctx.beginPath();
      ctx.arc(p.x * TILE_SIZE, p.y * TILE_SIZE, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1.0;
    });

    const timeSec = Date.now() / 1000;

    // 3. Draw Player Trail
    const p = engine.player;
    if (p.trail && p.trail.length > 1) {
        ctx.lineCap = 'round';
        const segments = p.trail.slice(-10);
        for (let i = 0; i < segments.length - 1; i++) {
            const p1 = segments[i];
            const p2 = segments[i+1];
            const ratio = i / segments.length;
            const width = 2 + (ratio * TILE_SIZE * 0.8);
            const alpha = Math.pow(ratio, 2) * 0.6;

            ctx.beginPath();
            ctx.lineWidth = width;
            ctx.strokeStyle = p.activeEffect === ItemType.SPEED ? '#00ffff' : p.color;
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 15 * ratio;
            ctx.shadowColor = p.color;
            ctx.moveTo(p1.x * TILE_SIZE, p1.y * TILE_SIZE);
            ctx.lineTo(p2.x * TILE_SIZE, p2.y * TILE_SIZE);
            ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
    }

    // 4. Draw Player Orb (3D Style)
    if (engine.state !== 'DYING' || Math.random() > 0.5) {
        const px = p.x * TILE_SIZE;
        const py = p.y * TILE_SIZE;
        const radius = TILE_SIZE * 0.45;

        ctx.save();
        ctx.translate(px, py);

        let rotation = 0;
        let scaleY = 1;

        if (p.dir === 'UP') rotation = -Math.PI / 2;
        else if (p.dir === 'DOWN') rotation = Math.PI / 2;
        else if (p.dir === 'LEFT') {
             rotation = Math.PI;
             scaleY = -1; 
        }
        else if (p.dir === 'RIGHT') rotation = 0;
        
        ctx.rotate(rotation);
        ctx.scale(1, scaleY);

        const pulse = 1 + Math.sin(timeSec * 8) * 0.05;
        const gradient = ctx.createRadialGradient(-radius*0.3, -radius*0.3, radius*0.1, 0, 0, radius);
        
        let colorMain = p.color;
        let colorLight = '#ffffcc';
        let colorDark = '#b3b300'; 

        if (p.activeEffect === ItemType.PHASE) {
            colorMain = '#ff00ff';
            colorLight = '#ffccff';
            colorDark = '#b300b3';
        } else if (p.activeEffect === ItemType.SPEED) {
            colorMain = '#00ffff';
            colorLight = '#ccffff';
            colorDark = '#00b3b3';
        }

        gradient.addColorStop(0, colorLight);
        gradient.addColorStop(0.5, colorMain);
        gradient.addColorStop(1, colorDark);

        ctx.shadowColor = colorMain;
        ctx.shadowBlur = 20 * pulse;

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, radius * pulse, 0, Math.PI * 2);
        ctx.fill();

        const mouthOpen = 0.2 + Math.abs(Math.sin(timeSec * 15)) * 0.3; 
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, radius * pulse + 1, -mouthOpen * 0.5, mouthOpen * 0.5);
        ctx.fill();

        const eyeX = radius * 0.3;
        const eyeY = -radius * 0.5;
        
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#111';
        ctx.beginPath();
        ctx.arc(eyeX, eyeY, radius * 0.2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = colorLight;
        ctx.beginPath();
        ctx.arc(eyeX + 1, eyeY - 1, radius * 0.08, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    // 4.5 Draw Respawn Indicator for Eaten Ghosts
    if (engine.ghosts && engine.ghosts.some(g => g.state === GhostState.EATEN)) {
        const homeX = 9.5 * TILE_SIZE;
        const homeY = 9.5 * TILE_SIZE;
        const time = Date.now() / 1000;

        ctx.save();
        ctx.translate(homeX, homeY);

        // Pulsating Aura
        const pulse = (Math.sin(time * 5) + 1) / 2;
        const alpha = 0.1 + pulse * 0.2;
        
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffffff';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(0, 0, TILE_SIZE * 2, 0, Math.PI * 2);
        ctx.fill();

        // Spiraling Particles (Simulated)
        ctx.fillStyle = '#ffffff';
        for(let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i / 8) + (time * 3);
            const radius = TILE_SIZE * (1.5 - ((time * 2 + i/2) % 1.5)); // Move inwards
            const pAlpha = Math.max(0, radius / (TILE_SIZE * 1.5)); // Fade as they get close
            
            ctx.globalAlpha = pAlpha;
            ctx.beginPath();
            ctx.arc(Math.cos(angle) * radius, Math.sin(angle) * radius, 2, 0, Math.PI * 2);
            ctx.fill();
        }

        ctx.restore();
    }

    // 5. Draw Ghosts
    if (engine.ghosts) {
        engine.ghosts.forEach(g => {
            let color = g.color;
            if (g.state === GhostState.FRIGHTENED) color = '#0000ff';
            if (g.state === GhostState.EATEN) color = 'rgba(0,0,0,0)'; 

            if (g.state !== GhostState.EATEN) {
                const dist = Math.hypot(g.x - engine.player.x, g.y - engine.player.y);
                const proximity = Math.max(0, 1 - (dist / 8));
                const pulseSpeed = 2 + (proximity * 6); 
                const pulse = (Math.sin(timeSec * pulseSpeed) + 1) / 2;
                const auraRadius = TILE_SIZE * (0.6 + pulse * 0.1);
                
                ctx.save();
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.05 + (0.15 * proximity) + (0.05 * pulse); 
                ctx.shadowBlur = 10 + (10 * pulse);
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(g.x * TILE_SIZE, g.y * TILE_SIZE, auraRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            if (g.state !== GhostState.EATEN && g.trail.length > 1) {
              const trailColor = g.state === GhostState.FRIGHTENED ? '#0000ff' : g.color;
              ctx.lineCap = 'round';
              const len = g.trail.length;
              for (let i = 0; i < len - 1; i++) {
                const p1 = g.trail[i];
                const p2 = g.trail[i+1];
                const ratio = i / len;
                const alpha = Math.pow(ratio, 2) * 0.5;
                const width = 1 + (ratio * TILE_SIZE * 0.6);

                ctx.beginPath();
                ctx.lineWidth = width;
                ctx.strokeStyle = trailColor;
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = ratio * 15;
                ctx.shadowColor = trailColor;
                
                ctx.moveTo(p1.x * TILE_SIZE, p1.y * TILE_SIZE);
                ctx.lineTo(p2.x * TILE_SIZE, p2.y * TILE_SIZE);
                ctx.stroke();
              }
              ctx.globalAlpha = 1.0;
            }

            ctx.fillStyle = color;
            ctx.shadowColor = color;
            ctx.shadowBlur = g.state === GhostState.FRIGHTENED ? 5 : 15;
            
            const gx = g.x * TILE_SIZE;
            const gy = g.y * TILE_SIZE;
            
            ctx.beginPath();
            ctx.arc(gx, gy - 2, TILE_SIZE * 0.4, Math.PI, 0);
            ctx.lineTo(gx + TILE_SIZE * 0.4, gy + TILE_SIZE * 0.4);
            for(let i=1; i<=3; i++) {
            ctx.lineTo(gx + TILE_SIZE * 0.4 - (i * TILE_SIZE * 0.26), gy + (i%2==0 ? TILE_SIZE*0.4 : TILE_SIZE*0.3));
            }
            ctx.lineTo(gx - TILE_SIZE * 0.4, gy + TILE_SIZE * 0.4);
            ctx.fill();

            if (g.state !== GhostState.FRIGHTENED || Math.random() > 0.2) {
                ctx.fillStyle = 'white';
                ctx.shadowBlur = 0;
                ctx.beginPath();
                ctx.arc(gx - 4, gy - 4, 3, 0, Math.PI * 2);
                ctx.arc(gx + 4, gy - 4, 3, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'blue';
                ctx.beginPath();
                const lookX = g.dir === 'LEFT' ? -1 : g.dir === 'RIGHT' ? 1 : 0;
                const lookY = g.dir === 'UP' ? -1 : g.dir === 'DOWN' ? 1 : 0;
                ctx.arc(gx - 4 + lookX, gy - 4 + lookY, 1.5, 0, Math.PI * 2);
                ctx.arc(gx + 4 + lookX, gy - 4 + lookY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }

    // 6. Draw Countdown (READY / GO)
    // Only draw if we are actively playing (this hides it under Level Start overlay)
    if (gameState === GameState.PLAYING && engine.startTimer > 0) {
        ctx.save();
        
        // We are inside map transform (offsetX, offsetY, scale)
        // Find center of the map
        const cx = (MAP_WIDTH * TILE_SIZE) / 2;
        const cy = (MAP_HEIGHT * TILE_SIZE) / 2;

        const text = engine.startTimer > 1.0 ? "READY" : "GO!";
        const color = engine.startTimer > 1.0 ? "#ff0055" : "#00ff00";
        
        // Heartbeat animation
        const pulse = 1 + Math.sin(Date.now() / 100) * 0.1;

        ctx.translate(cx, cy);
        ctx.scale(pulse, pulse);
        
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 20;
        ctx.font = "bold 60px 'Press Start 2P'";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(text, 0, 0);
        
        ctx.lineWidth = 2;
        ctx.strokeStyle = "white";
        ctx.strokeText(text, 0, 0);
        
        ctx.restore();
    }

    ctx.restore();
  }, [selectedThemeIndex, gameState]);

  // Initialize Game Loop
  const animate = useCallback(() => {
    if (!engineRef.current) {
        engineRef.current = new GameEngine();
    }
    const engine = engineRef.current;
    
    if (gameState === GameState.PLAYING) {
      try {
        engine.update(0.016); 
      } catch (e) {
        console.error("Game Loop Error:", e);
      }
      
      if (engine.state === 'DYING') {
        setTimeout(() => {
          if (engine.lives > 0) {
            engine.resetPositions();
          } else {
            setGameState(GameState.GAME_OVER);
            setHighScore(prev => Math.max(prev, engine.score));
          }
        }, 2000);
      } else if (engine.checkLevelComplete()) {
         setGameState(GameState.LEVEL_COMPLETE);
         setTimeout(() => {
            engine.resetLevel(engine.level + 1);
            setGameState(GameState.LEVEL_START);
            setTimeout(() => {
                setGameState(GameState.PLAYING);
            }, 2000); // Reduced from 2500ms for better pacing
         }, 2000);
      }
    }

    // Sync React State periodically
    if (Math.random() < 0.1) {
       setScore(engine.score);
       setLives(engine.lives);
       setLevel(engine.level);
       setInventory(engine.player.inventory);
    }

    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, draw]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  useEffect(() => {
    const handleResize = () => {
       if (canvasRef.current) {
           canvasRef.current.width = window.innerWidth;
           canvasRef.current.height = window.innerHeight;
       }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); 
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const startGame = () => {
    audioManager.init();
    audioManager.resume(); 
    
    if (!engineRef.current) engineRef.current = new GameEngine();
    const engine = engineRef.current;
    
    engine.score = 0;
    engine.lives = 3;
    engine.resetLevel(1);
    
    setGameState(GameState.LEVEL_START);
    setTimeout(() => {
        setGameState(GameState.PLAYING);
    }, 2000); // Reduced from 2500ms for better pacing
  };

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Menu Navigation
      if (gameState === GameState.MENU) {
          if (e.code === 'ArrowLeft') {
              setSelectedThemeIndex((prev) => (prev - 1 + THEMES.length) % THEMES.length);
          }
          if (e.code === 'ArrowRight') {
              setSelectedThemeIndex((prev) => (prev + 1) % THEMES.length);
          }
          if (e.code === 'Space' || e.code === 'Enter') {
              startGame();
          }
          return;
      }

      // Game Over Navigation
      if (gameState === GameState.GAME_OVER) {
          if (e.code === 'ArrowUp' || e.code === 'ArrowDown') {
              setGameOverActionIndex(prev => prev === 0 ? 1 : 0);
          }
          if (e.code === 'Space' || e.code === 'Enter') {
              if (gameOverActionIndex === 0) startGame();
              else setGameState(GameState.MENU);
          }
          if (e.code === 'Escape') {
              setGameState(GameState.MENU);
          }
          return;
      }

      // Pause Handling
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (gameState === GameState.PLAYING) {
          setGameState(GameState.PAUSED);
          return;
        } else if (gameState === GameState.PAUSED) {
          setGameState(GameState.PLAYING);
          return;
        }
      }
      
      // PAUSED State Handling (Added Space/Enter Resume support)
      if (gameState === GameState.PAUSED) {
          if (e.code === 'Space' || e.code === 'Enter') {
              setGameState(GameState.PLAYING);
          }
          return;
      }

      const engine = engineRef.current;
      if (!engine) return;

      switch(e.key) {
        case 'ArrowUp': engine.player.nextDir = 'UP'; break;
        case 'ArrowDown': engine.player.nextDir = 'DOWN'; break;
        case 'ArrowLeft': engine.player.nextDir = 'LEFT'; break;
        case 'ArrowRight': engine.player.nextDir = 'RIGHT'; break;
        case ' ': // Spacebar for Item
          engine.activateItem();
          setInventory(ItemType.NONE); // Optimistic UI update
          break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, gameOverActionIndex]);

  const handleJoystickDir = (dir: Direction) => {
    if (engineRef.current && gameState === GameState.PLAYING) {
      engineRef.current.player.nextDir = dir;
    }
  };

  const handleMobileAction = () => {
    if (engineRef.current && gameState === GameState.PLAYING) {
        engineRef.current.activateItem();
        setInventory(ItemType.NONE);
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono text-white">
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full block"
      />

      <div className="absolute inset-0 pointer-events-none z-10 crt-scanline opacity-30 mix-blend-overlay" />
      <div className="absolute inset-0 pointer-events-none z-10 crt-flicker bg-gradient-to-br from-transparent to-black/40" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-20" />

      {/* HUD CONTAINER - Top Left */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-4 pointer-events-none">
         {/* SCORE & TITLE */}
         <div className="flex flex-col gap-2 chromatic-aberration">
            <h1 className="text-2xl md:text-5xl text-yellow-400 font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">NEON MAZE</h1>
            <div className="flex flex-col gap-1 mt-1">
                <div className="text-xl md:text-3xl text-cyan-300 drop-shadow-md font-bold">SCORE: {score}</div>
                <div className="text-lg md:text-2xl text-red-400 drop-shadow-md">HIGH: {highScore}</div>
            </div>
         </div>

         {/* INVENTORY SLOT - Moved here to be close but safe */}
         <div className="flex flex-row items-center gap-3 bg-black/40 p-2 rounded border border-gray-800/50 backdrop-blur-sm">
              <div className={`w-12 h-12 border-2 ${inventory !== ItemType.NONE ? 'border-white bg-white/10' : 'border-gray-700 bg-black/50'} flex items-center justify-center rounded transition-all`}>
                  {inventory === ItemType.SPEED && <span className="text-2xl text-cyan-400 drop-shadow-[0_0_5px_cyan]">⚡</span>}
                  {inventory === ItemType.PHASE && <span className="text-2xl text-pink-400 drop-shadow-[0_0_5px_pink]">👁️</span>}
                  {inventory === ItemType.NONE && <span className="text-gray-700 text-xs">EMPTY</span>}
              </div>
              <div className="flex flex-col justify-center">
                  <span className="text-gray-400 text-[10px] tracking-widest">INVENTORY</span>
                  {inventory !== ItemType.NONE && (
                      <span className="text-[10px] text-cyan-200 animate-pulse font-bold leading-tight">
                        PRESS SPACE<br/>TO USE
                      </span>
                  )}
              </div>
         </div>
      </div>

      {/* LIVES - Top Right */}
      <div className="absolute top-6 right-6 z-30 flex gap-3 pointer-events-none">
         {Array.from({length: Math.max(0, lives)}).map((_, i) => (
             <svg key={i} width="24" height="24" viewBox="0 0 24 24" className="filter drop-shadow-[0_0_5px_rgba(255,234,0,0.8)]">
                {/* Pacman Body Shape */}
                <path d="M12 12 L20.66 7 A 10 10 0 1 0 20.66 17 Z" fill="#ffea00" />
                {/* Inner Core */}
                <circle cx="12" cy="12" r="3" fill="white" className="opacity-80" />
                {/* Eye */}
                <circle cx="14" cy="6" r="2" fill="black" />
                <circle cx="14.5" cy="5.5" r="0.8" fill="white" />
             </svg>
         ))}
      </div>

      <div className="absolute bottom-6 left-6 z-30 text-2xl md:text-3xl text-cyan-500 font-bold tracking-wider drop-shadow-md pointer-events-none">
         LEVEL {level}
      </div>

      {/* Menus */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
           <h1 className="text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-purple-500 font-black mb-8 animate-pulse text-center p-4 filter drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">
             NEON MAZE<br/>RUNNER
           </h1>
           
           <div className="mb-8 flex flex-col items-center">
             <div className="text-gray-400 text-xs mb-2">SELECT STARTING THEME / MOVE</div>
             <div className="flex items-center gap-4">
               <button 
                 onClick={() => setSelectedThemeIndex((prev) => (prev - 1 + THEMES.length) % THEMES.length)}
                 className="p-2 text-cyan-400 hover:scale-110 transition"
               >
                 &lt;
               </button>
               <div className="flex flex-col items-center w-40">
                 <span 
                   className="text-lg font-bold"
                   style={{ color: THEMES[selectedThemeIndex].wallColor }}
                 >
                   {THEMES[selectedThemeIndex].name}
                 </span>
                 <div className="flex gap-2 mt-1">
                   <div className="w-4 h-4 rounded border border-white" style={{backgroundColor: THEMES[selectedThemeIndex].wallColor}}></div>
                   <div className="w-4 h-4 rounded border border-white" style={{backgroundColor: THEMES[selectedThemeIndex].dotColor}}></div>
                 </div>
               </div>
               <button 
                  onClick={() => setSelectedThemeIndex((prev) => (prev + 1) % THEMES.length)}
                  className="p-2 text-cyan-400 hover:scale-110 transition"
               >
                 &gt;
               </button>
             </div>
           </div>

           <button 
             onClick={startGame}
             className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 bg-cyan-900/50 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all text-xl tracking-widest"
           >
             INSERT COIN / START
           </button>
           <p className="mt-8 text-gray-400 text-xs md:text-sm text-center">
             ARROWS or SWIPE to Move<br/>SPACE to Use Powerup
           </p>
        </div>
      )}

      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
           <h2 className="text-4xl md:text-5xl text-cyan-400 font-bold mb-8 tracking-widest chromatic-aberration">PAUSED</h2>
           <button 
             onClick={() => setGameState(GameState.PLAYING)}
             className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 bg-cyan-900/50 scale-110 shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all text-xl tracking-widest"
           >
             RESUME
           </button>
        </div>
      )}

      {gameState === GameState.LEVEL_START && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
           <h2 className="text-4xl md:text-6xl text-yellow-400 font-black mb-2 tracking-widest chromatic-aberration animate-pulse">
             LEVEL {level}
           </h2>
           <div className="w-24 h-1 bg-cyan-500 mb-4 rounded shadow-[0_0_10px_cyan]"></div>
           <p className="text-xl md:text-2xl text-cyan-300 tracking-[0.2em] font-bold">
              {getThemeName()}
           </p>
           
           {getModifierName() && (
             <div className="mt-6 text-red-500 border border-red-500 px-4 py-2 animate-pulse bg-red-900/30">
                WARNING: {getModifierName()}
             </div>
           )}

           <p className="mt-8 text-sm text-gray-500 animate-pulse">READY?</p>
        </div>
      )}

      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-red-900/40 backdrop-blur-sm">
           <h2 className="text-5xl text-red-500 font-bold mb-4 chromatic-aberration">GAME OVER</h2>
           <p className="text-xl mb-4">FINAL SCORE: {score}</p>
           
           <div className="flex flex-col gap-4">
               <button 
                 onClick={startGame}
                 onMouseEnter={() => setGameOverActionIndex(0)}
                 className={`px-6 py-3 border-2 transition-all ${gameOverActionIndex === 0 ? 'border-cyan-400 text-cyan-400 bg-cyan-900/50 scale-110 shadow-[0_0_15px_cyan]' : 'border-gray-500 text-gray-500'}`}
               >
                 TRY AGAIN
               </button>
               <button 
                 onClick={() => setGameState(GameState.MENU)}
                 onMouseEnter={() => setGameOverActionIndex(1)}
                 className={`px-6 py-3 border-2 transition-all ${gameOverActionIndex === 1 ? 'border-cyan-400 text-cyan-400 bg-cyan-900/50 scale-110 shadow-[0_0_15px_cyan]' : 'border-gray-500 text-gray-500'}`}
               >
                 MAIN MENU
               </button>
           </div>

           <p className="mt-8 text-xs text-gray-400 animate-pulse">PRESS SPACE TO SELECT</p>
        </div>
      )}

      {gameState === GameState.LEVEL_COMPLETE && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-green-900/40 backdrop-blur-sm">
           <h2 className="text-4xl text-green-400 font-bold mb-4 animate-bounce">LEVEL CLEARED!</h2>
        </div>
      )}

      {/* Mobile Controls */}
      {gameState === GameState.PLAYING && (
        <>
            <VirtualJoystick onDirectionChange={handleJoystickDir} />
            {/* Action Button for Mobile */}
            <button 
                className={`fixed bottom-10 left-10 w-20 h-20 rounded-full border-4 flex items-center justify-center z-50 transition-all active:scale-95 touch-none md:hidden ${inventory !== ItemType.NONE ? 'border-cyan-400 bg-cyan-900/50 shadow-[0_0_20px_cyan]' : 'border-gray-600 bg-gray-900/50 opacity-50'}`}
                onTouchStart={(e) => { e.preventDefault(); handleMobileAction(); }}
            >
                <span className="text-2xl font-bold text-white">!</span>
            </button>
        </>
      )}
    </div>
  );
}
