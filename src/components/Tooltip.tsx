import React, { useRef, useState } from 'react';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

// A custom tooltip, not the native `title` attribute — browsers delay `title` by roughly
// a second before showing it, which reads as sluggish/broken for something meant to
// explain a badge at a glance. Shows on hover, click/tap (for touch devices, which have
// no hover), or keyboard focus. Positioned with `position: fixed` computed from the
// trigger's own bounding rect (not a CSS-only absolute position) specifically so it
// isn't clipped by the scrollable playlist lists it's used inside (`overflow-y: auto`).
export const Tooltip: React.FC<TooltipProps> = ({ text, children }) => {
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLSpanElement>(null);

  // Click always shows (rather than toggling) — on a touch device, hover never fires at
  // all, so click is the only signal available; on desktop, tapping something you're
  // already hovering shouldn't hide the explanation you just asked to see.
  const show = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setCoords({ top: rect.top, left: rect.left + rect.width / 2 });
  };
  const hide = () => setCoords(null);

  return (
    <span
      ref={triggerRef}
      className="tooltip-trigger"
      tabIndex={0}
      aria-label={text}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onClick={(e) => {
        e.stopPropagation();
        show();
      }}
    >
      {children}
      {coords && (
        <span className="tooltip-bubble" role="tooltip" style={{ top: coords.top, left: coords.left }}>
          {text}
        </span>
      )}
    </span>
  );
};
