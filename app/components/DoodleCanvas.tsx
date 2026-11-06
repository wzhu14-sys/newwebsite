"use client";

import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from "react";

export interface DoodleCanvasRef {
  getCanvas: () => HTMLCanvasElement | null;
  isEmpty: () => boolean;
  clear: () => void;
}

interface Props {
  width: number;
  height: number;
  className?: string;
  onStrokeChange?: () => void;
}

const PALETTE = [
  { name: "White", color: "#FFFFFF" },
  { name: "Black", color: "#111827" },
  { name: "Mint Green", color: "#10B981" },
  { name: "Neon Lime", color: "#A3E635" },
  { name: "Hot Pink", color: "#EC4899" },
  { name: "Sunny Yellow", color: "#FDE047" },
  { name: "Electric Blue", color: "#38BDF8" },
];

export const DoodleCanvas = forwardRef<DoodleCanvasRef, Props>(function DoodleCanvas(
  { width, height, className = "", onStrokeChange },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [color, setColor] = useState<string>("#10B981");
  const [lineWidth, setLineWidth] = useState<number>(6);
  const [isEraser, setIsEraser] = useState<boolean>(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const isDrawingRef = useRef<boolean>(false);
  const lastPosRef = useRef<{ x: number; y: number } | null>(null);

  useImperativeHandle(ref, () => ({
    getCanvas: () => canvasRef.current,
    isEmpty: () => history.length === 0,
    clear: handleClear,
  }));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
  }, [width, height]);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, width, height);
    setHistory((prev) => [...prev.slice(-15), data]);
    onStrokeChange?.();
  };

  const handleUndo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const newHistory = [...history];
    newHistory.pop();

    if (newHistory.length > 0) {
      const prevData = newHistory[newHistory.length - 1];
      ctx.putImageData(prevData, 0, 0);
    } else {
      ctx.clearRect(0, 0, width, height);
    }
    setHistory(newHistory);
    onStrokeChange?.();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    setHistory([]);
    onStrokeChange?.();
  };

  const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getCoordinates(e);
    isDrawingRef.current = true;
    lastPosRef.current = pos;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = lineWidth;

    if (isEraser) {
      ctx.globalCompositeOperation = "destination-out";
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !lastPosRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const currentPos = getCoordinates(e);

    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    lastPosRef.current = currentPos;
  };

  const handlePointerUp = () => {
    if (isDrawingRef.current) {
      isDrawingRef.current = false;
      lastPosRef.current = null;
      saveState();
    }
  };

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      {/* Canvas container */}
      <div className="relative touch-none cursor-crosshair">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="w-full h-auto block touch-none"
          style={{ touchAction: "none" }}
        />
      </div>

      {/* Doodle Floating Toolbar */}
      <div className="w-full max-w-sm mt-3 px-3 py-2 bg-neutral-900/90 backdrop-blur-xl border border-white/10 rounded-2xl shadow-xl flex flex-col gap-2">
        {/* Color Palette */}
        <div className="flex items-center justify-between gap-1 overflow-x-auto py-1">
          {PALETTE.map((p) => {
            const isSelected = !isEraser && color === p.color;
            return (
              <button
                key={p.color}
                type="button"
                onClick={() => {
                  setColor(p.color);
                  setIsEraser(false);
                }}
                className={`w-7 h-7 rounded-full flex-shrink-0 transition-transform ${
                  isSelected ? "scale-125 ring-2 ring-emerald-400 ring-offset-2 ring-offset-black" : "opacity-80 active:scale-95"
                }`}
                style={{ backgroundColor: p.color }}
                title={p.name}
              />
            );
          })}

          {/* Eraser */}
          <button
            type="button"
            onClick={() => setIsEraser(true)}
            className={`px-3 py-1 text-xs font-bold rounded-full border transition-all ${
              isEraser
                ? "bg-emerald-500 text-white border-emerald-400"
                : "bg-neutral-800 text-neutral-300 border-neutral-700"
            }`}
          >
            Eraser
          </button>
        </div>

        {/* Brush Size & Undo/Clear Actions */}
        <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
          <div className="flex items-center gap-1.5">
            <span className="text-neutral-400 font-medium">Size:</span>
            {[4, 8, 16].map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setLineWidth(size)}
                className={`w-6 h-6 rounded-md flex items-center justify-center font-bold ${
                  lineWidth === size ? "bg-emerald-500 text-white" : "bg-neutral-800 text-neutral-400"
                }`}
              >
                {size === 4 ? "S" : size === 8 ? "M" : "L"}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={history.length === 0}
              onClick={handleUndo}
              className="px-2.5 py-1 rounded-md bg-neutral-800 text-neutral-300 font-semibold disabled:opacity-30 active:scale-95 transition-transform"
            >
              Undo
            </button>
            <button
              type="button"
              disabled={history.length === 0}
              onClick={handleClear}
              className="px-2.5 py-1 rounded-md bg-neutral-800 text-red-400 font-semibold disabled:opacity-30 active:scale-95 transition-transform"
            >
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
