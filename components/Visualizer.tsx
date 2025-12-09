import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
  mode: 'listening' | 'speaking' | 'idle' | 'thinking' | 'ready' | 'inactive';
}

const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume, mode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Idle or Ready Line
      if (!isActive || mode === 'ready' || mode === 'inactive') {
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = '#cbd5e1'; // slate-300
        ctx.lineWidth = 2;
        ctx.stroke();
        return;
      }

      // Thinking Animation (Pulsing Line)
      if (mode === 'thinking') {
        const pulse = (Math.sin(time * 0.1) + 1) / 2; // 0 to 1
        ctx.beginPath();
        ctx.moveTo(0, centerY);
        ctx.lineTo(width, centerY);
        ctx.strokeStyle = `rgba(245, 158, 11, ${0.4 + pulse * 0.6})`; // Amber pulsing
        ctx.lineWidth = 4;
        ctx.stroke();
        time += 1;
        animationId = requestAnimationFrame(draw);
        return;
      }

      // Active Waveform (Listening / Speaking)
      ctx.lineWidth = 3;
      ctx.strokeStyle = mode === 'listening' ? '#ef4444' : '#16a34a'; // Red or Green

      ctx.beginPath();
      ctx.moveTo(0, centerY);

      for (let x = 0; x < width; x++) {
        // Base amplitude modulated by volume
        const amplitude = (height / 3) * Math.max(0.1, volume * 2); 
        
        // Sine wave math
        const frequency = mode === 'listening' ? 0.05 : 0.03;
        const speed = mode === 'listening' ? 0.2 : 0.1;
        
        const y = centerY + Math.sin(x * frequency + time * speed) * amplitude * Math.sin(x / width * Math.PI);
        ctx.lineTo(x, y);
      }
      
      ctx.stroke();

      time += 1;
      animationId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, volume, mode]);

  return (
    <div className="w-full h-32 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center overflow-hidden">
      <canvas 
        ref={canvasRef} 
        width={300} 
        height={120} 
        className="w-full h-full"
      />
    </div>
  );
};

export default Visualizer;