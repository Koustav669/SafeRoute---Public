import { useEffect, useRef } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';

interface MockMapProps {
  routes?: any[];
  selectedRoute?: any;
}

export function MockMap({ routes = [], selectedRoute }: MockMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Draw background (dark theme)
    ctx.fillStyle = '#12263A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid lines (like a map)
    ctx.strokeStyle = '#1a3a52';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw mock routes
    if (routes.length > 0) {
      const colors = ['#2EC4B6', '#F4D35E', '#999999'];
      const startX = canvas.width * 0.2;
      const startY = canvas.height * 0.5;
      const endX = canvas.width * 0.8;
      const endY = canvas.height * 0.5;

      routes.forEach((route, index) => {
        const color = colors[index] || '#999999';
        const isSelected = selectedRoute?.id === route.id;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = isSelected ? 6 : 3;
        ctx.globalAlpha = isSelected ? 0.9 : 0.4;
        
        // Draw curved path
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        
        const controlY = startY + (index - 1) * 80;
        const controlX = canvas.width * 0.5;
        ctx.quadraticCurveTo(controlX, controlY, endX, endY);
        
        ctx.stroke();
        ctx.globalAlpha = 1;
      });

      // Draw start marker
      ctx.fillStyle = '#2EC4B6';
      ctx.beginPath();
      ctx.arc(startX, startY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Arial';
      ctx.fillText('Start', startX - 15, startY - 15);

      // Draw end marker
      ctx.fillStyle = '#E63946';
      ctx.beginPath();
      ctx.arc(endX, endY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText('Destination', endX - 30, endY - 15);
    } else {
      // Draw placeholder text
      ctx.fillStyle = '#8B9DC3';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('Enter locations and click "Find Safe Routes"', canvas.width / 2, canvas.height / 2);
      ctx.fillText('to see routes displayed here', canvas.width / 2, canvas.height / 2 + 25);
    }
  }, [routes, selectedRoute]);

  return (
    <div className="relative w-full h-full">
      <Alert className="absolute top-4 left-4 right-4 z-10 bg-yellow-900/90 border-yellow-600">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-yellow-100">
          <strong>Demo Mode:</strong> Using mock map. Set up Google Maps API key for full functionality.
          <a href="/simple-test.html" className="underline ml-2" target="_blank" rel="noopener noreferrer">
            Test API Key
          </a>
        </AlertDescription>
      </Alert>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        style={{ minHeight: '400px' }}
      />
    </div>
  );
}
