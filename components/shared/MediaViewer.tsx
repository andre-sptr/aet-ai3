"use client";

import Image from "next/image";
import { useState, useRef, type ReactNode } from "react";
import { Download, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";
import Dialog from "./Dialog";

export default function MediaViewer({
  title,
  onClose,
  src,
  svg,
  alt = "Gambar AET AI",
}: {
  title: string;
  onClose: () => void;
  src?: string;
  svg?: string;
  alt?: string;
}) {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);
  const clamp = (value: number) => Math.min(5, Math.max(0.1, value));
  const downloadSvg = () => {
    if (!svg) return;
    const url = URL.createObjectURL(
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `aet_ai-${Date.now()}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  let content: ReactNode;
  if (svg)
    content = (
      <div
        className="bg-white p-4 sm:p-8 rounded max-w-full [&_svg]:max-w-full [&_svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  else
    content = (
      <Image
        src={src || ""}
        alt={alt}
        width={1600}
        height={1000}
        unoptimized
        draggable={false}
        className="object-contain w-auto h-auto max-w-full max-h-[70dvh] pointer-events-none select-none"
      />
    );
  return (
    <Dialog open onClose={onClose} title={title} className="viewer-dialog">
      <div
        className="viewer-stage"
        aria-label="Pratinjau — geser untuk memindahkan"
        onWheel={(event) => {
          event.stopPropagation();
          setScale((value) => clamp(value + (event.deltaY > 0 ? -0.1 : 0.1)));
        }}
        onPointerDown={(event) => {
          drag.current = {
            x: event.clientX - position.x,
            y: event.clientY - position.y,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (drag.current)
            setPosition({
              x: event.clientX - drag.current.x,
              y: event.clientY - drag.current.y,
            });
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div
          className="max-w-full max-h-full flex justify-center"
          style={{
            transform: `translate(${position.x}px,${position.y}px) scale(${scale})`,
            transformOrigin: "center",
          }}
        >
          {content}
        </div>
      </div>
      <div className="viewer-controls">
        <button
          onClick={() => setScale((value) => clamp(value - 0.2))}
          aria-label="Perkecil"
          title="Perkecil"
        >
          <ZoomOut size={17} />
        </button>
        <span>{Math.round(scale * 100)}%</span>
        <button
          onClick={() => setScale((value) => clamp(value + 0.2))}
          aria-label="Perbesar"
          title="Perbesar"
        >
          <ZoomIn size={17} />
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPosition({ x: 0, y: 0 });
          }}
          aria-label="Reset tampilan"
          title="Reset tampilan"
        >
          <RotateCcw size={17} />
        </button>
        {svg ? (
          <button onClick={downloadSvg}>
            <Download size={15} />
            Download SVG
          </button>
        ) : (
          <a
            href={src}
            download="aet_ai-image.png"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Download size={15} />
            Download
          </a>
        )}
      </div>
    </Dialog>
  );
}
