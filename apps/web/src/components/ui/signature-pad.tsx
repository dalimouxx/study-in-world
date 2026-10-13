'use client';

import { Eraser } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Button } from './button';

/**
 * Zone de signature au tracé (souris ou tactile), sans bibliothèque externe — juste l'API Canvas du
 * navigateur (section 36 : signature « tactile » ou « souris »). Exporte un PNG en data URL.
 */
export function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const t = useTranslations('candidates');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * canvas.width, y: ((e.clientY - rect.top) / rect.height) * canvas.height };
  };

  const start = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    drawing.current = true;
    lastPoint.current = point(e);
  };

  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const current = point(e);
    ctx.strokeStyle = '#111827';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(lastPoint.current!.x, lastPoint.current!.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    lastPoint.current = current;
    if (!hasDrawn) setHasDrawn(true);
  };

  const end = () => {
    drawing.current = false;
    if (canvasRef.current) onChange(hasDrawn ? canvasRef.current.toDataURL('image/png') : null);
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full touch-none rounded-md border border-border bg-white"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={() => drawing.current && end()}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{t('signatureHint')}</p>
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <Eraser className="h-3.5 w-3.5" aria-hidden />{t('clearSignature')}
        </Button>
      </div>
    </div>
  );
}
