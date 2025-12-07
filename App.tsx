import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameState, TileType, GhostState, Direction, LevelModifier } from './types';
import { BASE_MAP, TILE_SIZE, THEMES, MAP_HEIGHT, MAP_WIDTH } from './constants';
import { VirtualJoystick } from './components/VirtualJoystick';
import { audioManager } from './utils/audio';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Lazy initialize engine to avoid heavy lifting/errors during initial render pass
  const engineRef = useRef<GameEngine | null>(null);
  
  const requestRef = useRef<number>();
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [highScore, setHighScore] = useState(0);
  
  // New: User selected theme index
  const [selectedThemeIndex, setSelectedThemeIndex] = useState(0);

  // Initialize Game Loop
  const animate = useCallback(() => {
    // Ensure engine exists
    if (!engineRef.current) {
        engineRef.current = new GameEngine();
    }
    const engine = engineRef.current;
    
    // Only update game logic if strictly playing
    if (gameState === GameState.PLAYING) {
      try {
        engine.update(0.016); // Fixed time step approx 60fps
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
            }, 2500);
         }, 2000);
      }
    }

    // Sync React State periodically (every ~10 frames)
    if (Math.random() < 0.1) {
       setScore(engine.score);
       setLives(engine.lives);
       setLevel(engine.level);
    }

    draw();
    requestRef.current = requestAnimationFrame(animate);
  }, [gameState, selectedThemeIndex]); // Add selectedThemeIndex to dependency

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(requestRef.current!);
  }, [animate]);

  // Initialize and handle Resize
  useEffect(() => {
    const handleResize = () => {
       if (canvasRef.current) {
           canvasRef.current.width = window.innerWidth;
           canvasRef.current.height = window.innerHeight;
       }
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // Init size
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Input Handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
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

      if (gameState === GameState.MENU || gameState === GameState.GAME_OVER) {
        if (e.code === 'Space' || e.code === 'Enter') {
          startGame();
        }
        return;
      }
      
      // Don't process movement if paused
      if (gameState === GameState.PAUSED) return;

      const engine = engineRef.current;
      if (!engine) return;

      switch(e.key) {
        case 'ArrowUp': engine.player.nextDir = 'UP'; break;
        case 'ArrowDown': engine.player.nextDir = 'DOWN'; break;
        case 'ArrowLeft': engine.player.nextDir = 'LEFT'; break;
        case 'ArrowRight': engine.player.nextDir = 'RIGHT'; break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState]);

  const startGame = () => {
    audioManager.init();
    audioManager.resume(); // Vital for Chrome/Safari autoplay policies
    
    if (!engineRef.current) engineRef.current = new GameEngine();
    const engine = engineRef.current;
    
    engine.score = 0;
    engine.lives = 3;
    engine.resetLevel(1);
    
    // Go to Level Start sequence first
    setGameState(GameState.LEVEL_START);
    setTimeout(() => {
        setGameState(GameState.PLAYING);
    }, 2500);
  };

  const handleJoystickDir = (dir: Direction) => {
    if (engineRef.current && gameState === GameState.PLAYING) {
      engineRef.current.player.nextDir = dir;
    }
  };

  // Rendering Logic
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    if (!engineRef.current) return;
    const engine = engineRef.current;
    
    // Apply theme based on user selection + level offset
    const currentThemeIndex = (selectedThemeIndex + engine.level - 1) % THEMES.length;
    const theme = THEMES[currentThemeIndex];

    // Clear with trail effect
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
    
    // Safety check for map
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
              // Blinking Dots Modifier
              let alpha = 1.0;
              if (engine.modifier === LevelModifier.BLINKING_DOTS) {
                  // Random flicker or sinusoidal wave
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
              if (Math.floor(Date.now() / 200) % 2 === 0) { // Blink
                  ctx.fillStyle = theme.dotColor;
                  ctx.shadowBlur = 15;
                  ctx.shadowColor = theme.dotColor;
                  ctx.beginPath();
                  ctx.arc(px + TILE_SIZE/2, py + TILE_SIZE/2, 6, 0, Math.PI * 2);
                  ctx.fill();
              }
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

    // 3. Draw Player
    if (engine.state !== 'DYING' || Math.random() > 0.5) {
        const p = engine.player;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(p.x * TILE_SIZE, p.y * TILE_SIZE, TILE_SIZE * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Draw Ghosts
    if (engine.ghosts) {
        engine.ghosts.forEach(g => {
            let color = g.color;
            if (g.state === GhostState.FRIGHTENED) color = '#0000ff';
            if (g.state === GhostState.EATEN) color = 'rgba(0,0,0,0)'; 

            // NEW: Faint Pulsating Aura
            if (g.state !== GhostState.EATEN) {
                const pulse = (Math.sin(Date.now() / 200) + 1) / 2; // 0 to 1
                const auraRadius = TILE_SIZE * (0.5 + pulse * 0.25);
                
                ctx.save();
                ctx.fillStyle = color;
                ctx.globalAlpha = 0.15; // Faint
                ctx.shadowBlur = 20;
                ctx.shadowColor = color;
                ctx.beginPath();
                ctx.arc(g.x * TILE_SIZE, g.y * TILE_SIZE, auraRadius, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }

            // Draw Trail
            if (g.state !== GhostState.EATEN && g.trail.length > 1) {
              const trailColor = g.state === GhostState.FRIGHTENED ? '#0000ff' : g.color;
              ctx.lineCap = 'round';
              
              for (let i = 0; i < g.trail.length - 1; i++) {
                const p1 = g.trail[i];
                const p2 = g.trail[i+1];
                
                // Tapering width: Thinner at the tail (index 0), thicker at head
                const ratio = i / g.trail.length;
                const width = 2 + (ratio * TILE_SIZE * 0.4); 
                
                // Dynamic Opacity
                const alpha = ratio * 0.6; // Max 0.6 opacity

                ctx.beginPath();
                ctx.lineWidth = width;
                ctx.strokeStyle = trailColor;
                ctx.globalAlpha = alpha;
                ctx.shadowBlur = 15 * ratio;
                ctx.shadowColor = trailColor;
                ctx.moveTo(p1.x * TILE_SIZE, p1.y * TILE_SIZE);
                ctx.lineTo(p2.x * TILE_SIZE, p2.y * TILE_SIZE);
                ctx.stroke();
              }
              ctx.globalAlpha = 1.0;
            }

            // Draw Ghost Body
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

    ctx.restore();
  };

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

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-mono text-white">
      {/* Canvas Layer */}
      <canvas 
        ref={canvasRef} 
        className="absolute top-0 left-0 w-full h-full block"
      />

      {/* CRT Overlay */}
      <div className="absolute inset-0 pointer-events-none z-10 crt-scanline opacity-30 mix-blend-overlay" />
      <div className="absolute inset-0 pointer-events-none z-10 crt-flicker bg-gradient-to-br from-transparent to-black/40" />
      <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.9)] z-20" />

      {/* HUD - Resized for better visibility */}
      <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 chromatic-aberration pointer-events-none">
         <h1 className="text-2xl md:text-5xl text-yellow-400 font-bold tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">NEON MAZE</h1>
         <div className="flex flex-col gap-1 mt-1">
            <div className="text-xl md:text-3xl text-cyan-300 drop-shadow-md font-bold">SCORE: {score}</div>
            <div className="text-lg md:text-2xl text-red-400 drop-shadow-md">HIGH: {highScore}</div>
         </div>
         {gameState === GameState.PLAYING && (
           <div className="text-sm text-gray-500 mt-2 md:hidden">PRESS 'P' TO PAUSE</div>
         )}
      </div>

      <div className="absolute top-6 right-6 z-30 flex gap-3 pointer-events-none">
         {Array.from({length: Math.max(0, lives)}).map((_, i) => (
             <div key={i} className="w-6 h-6 rounded-full bg-yellow-400 shadow-[0_0_10px_yellow]" />
         ))}
      </div>

      <div className="absolute bottom-6 left-6 z-30 text-2xl md:text-3xl text-cyan-500 font-bold tracking-wider drop-shadow-md pointer-events-none">
         LEVEL {level}
      </div>

      {/* Menus */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
           <h1 className="text-4xl md:text-6xl text-transparent bg-clip-text bg-gradient-to-b from-cyan-300 to-purple-500 font-black mb-8 animate-pulse text-center p-4 filter drop-shadow-[0_0_10px_rgba(0,255,255,0.8)]">
             NEON<br/>RUNNER
           </h1>
           
           {/* Theme Selector */}
           <div className="mb-8 flex flex-col items-center">
             <div className="text-gray-400 text-xs mb-2">SELECT STARTING THEME</div>
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
             className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all text-xl tracking-widest shadow-[0_0_15px_rgba(34,211,238,0.5)]"
           >
             INSERT COIN / START
           </button>
           <p className="mt-8 text-gray-400 text-xs md:text-sm text-center">
             ARROWS or SWIPE to Move<br/>Avoid the Neon Ghosts
           </p>
        </div>
      )}

      {gameState === GameState.PAUSED && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
           <h2 className="text-4xl md:text-5xl text-cyan-400 font-bold mb-8 tracking-widest chromatic-aberration">PAUSED</h2>
           <button 
             onClick={() => setGameState(GameState.PLAYING)}
             className="px-8 py-4 border-2 border-cyan-400 text-cyan-400 hover:bg-cyan-400 hover:text-black transition-all text-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]"
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
           
           {/* Display Modifier if Active */}
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
           <p className="text-xl mb-8">FINAL SCORE: {score}</p>
           <button 
             onClick={() => setGameState(GameState.MENU)}
             className="px-6 py-3 border-2 border-white text-white hover:bg-white hover:text-red-900 transition-all"
           >
             MAIN MENU
           </button>
        </div>
      )}

      {gameState === GameState.LEVEL_COMPLETE && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-green-900/40 backdrop-blur-sm">
           <h2 className="text-4xl text-green-400 font-bold mb-4 animate-bounce">LEVEL CLEARED!</h2>
        </div>
      )}

      {/* Mobile Controls */}
      {gameState === GameState.PLAYING && (
        <VirtualJoystick onDirectionChange={handleJoystickDir} />
      )}
    </div>
  );
}