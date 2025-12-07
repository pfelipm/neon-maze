import React, { useRef, useState, useEffect } from 'react';
import { Direction } from '../types';

interface Props {
  onDirectionChange: (dir: Direction) => void;
}

export const VirtualJoystick: React.FC<Props> = ({ onDirectionChange }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setOrigin({ x: touch.clientX, y: touch.clientY });
    setPosition({ x: 0, y: 0 });
    setActive(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!active) return;
    const touch = e.touches[0];
    const dx = touch.clientX - origin.x;
    const dy = touch.clientY - origin.y;
    
    // Clamp
    const dist = Math.sqrt(dx*dx + dy*dy);
    const maxDist = 40;
    const scale = dist > maxDist ? maxDist / dist : 1;
    
    setPosition({ x: dx * scale, y: dy * scale });

    if (dist > 10) {
      if (Math.abs(dx) > Math.abs(dy)) {
        onDirectionChange(dx > 0 ? 'RIGHT' : 'LEFT');
      } else {
        onDirectionChange(dy > 0 ? 'DOWN' : 'UP');
      }
    }
  };

  const handleTouchEnd = () => {
    setActive(false);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div 
      ref={containerRef}
      className="fixed bottom-10 right-10 w-32 h-32 rounded-full border-2 border-cyan-500/30 bg-black/20 backdrop-blur-sm touch-none z-50 md:hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div 
        className="absolute w-12 h-12 bg-cyan-400/50 rounded-full shadow-[0_0_15px_rgba(34,211,238,0.8)]"
        style={{
          left: `calc(50% - 24px + ${position.x}px)`,
          top: `calc(50% - 24px + ${position.y}px)`,
          transition: active ? 'none' : 'all 0.2s ease-out'
        }}
      />
    </div>
  );
};