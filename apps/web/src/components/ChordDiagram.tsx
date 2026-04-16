import React from 'react';

export type ChordPosition = {
  frets: number[]; // e.g. [-1, 3, 2, 0, 1, 0]
  fingers: number[];
  baseFret: number;
  barres: number[];
  capo?: boolean;
};

export type ChordDiagramProps = {
  position: ChordPosition;
  width?: number;
  height?: number;
  color?: string;
};

export default function ChordDiagram({
  position,
  width = 120,
  height = 150,
  color = 'currentColor'
}: ChordDiagramProps) {
  const numStrings = 6;
  const numFrets = 4; // Display 4 frets
  const { frets, fingers, baseFret, barres } = position;
  
  const paddingX = 20;
  const paddingY = 30;
  const gridWidth = 80;
  const gridHeight = 100;
  
  const stringSpacing = gridWidth / (numStrings - 1);
  const fretSpacing = gridHeight / numFrets;

  const minFret = baseFret;
  
  return (
    <svg viewBox="0 0 120 160" width={width} height={height} stroke={color} fill="none">
      {/* Base fret text if > 1 */}
      {baseFret > 1 && (
        <text x="5" y={paddingY + fretSpacing / 2 + 5} fontSize="12" fill={color} stroke="none" fontWeight="bold">
          {baseFret}fr
        </text>
      )}

      {/* Grid lines */}
      <g strokeWidth="1.5">
        {/* Top thick line (nut) if baseFret is 1 */}
        {baseFret === 1 && (
          <line x1={paddingX} y1={paddingY} x2={paddingX + gridWidth} y2={paddingY} strokeWidth="5" />
        )}
        
        {/* Frets (horizontal) */}
        {Array.from({ length: numFrets + 1 }).map((_, i) => (
          <line
            key={`fret-${i}`}
            x1={paddingX}
            y1={paddingY + i * fretSpacing}
            x2={paddingX + gridWidth}
            y2={paddingY + i * fretSpacing}
            strokeWidth={i === 0 && baseFret === 1 ? 0 : 1.5}
          />
        ))}

        {/* Strings (vertical) */}
        {Array.from({ length: numStrings }).map((_, i) => (
          <line
            key={`str-${i}`}
            x1={paddingX + i * stringSpacing}
            y1={paddingY}
            x2={paddingX + i * stringSpacing}
            y2={paddingY + gridHeight}
          />
        ))}
      </g>

      {/* Open/Muted indicators */}
      <g strokeWidth="1.5" fontSize="12" textAnchor="middle">
        {frets.map((fret, i) => {
          const cx = paddingX + i * stringSpacing;
          const cy = paddingY - 10;
          if (fret === -1) {
            return (
              <text key={`mut-${i}`} x={cx} y={cy + 4} fill={color} stroke="none" fontWeight="bold">X</text>
            );
          }
          if (fret === 0) {
            return (
              <circle key={`opn-${i}`} cx={cx} cy={cy - 1} r="3" />
            );
          }
          return null;
        })}
      </g>

      {/* Barres */}
      {barres && barres.length > 0 && barres.map((barreFret, i) => {
        // Find min and max strings covered by this barre
        let minStr = 5;
        let maxStr = 0;
        frets.forEach((f, strIdx) => {
          if (f >= barreFret) {
            if (strIdx < minStr) minStr = strIdx;
            if (strIdx > maxStr) maxStr = strIdx;
          }
        });
        if (minStr > maxStr) return null;
        
        const y = paddingY + (barreFret - minFret + 0.5) * fretSpacing;
        return (
          <line
            key={`barre-${i}`}
            x1={paddingX + minStr * stringSpacing}
            y1={y}
            x2={paddingX + maxStr * stringSpacing}
            y2={y}
            strokeWidth="12"
            strokeLinecap="round"
            stroke={color}
          />
        );
      })}

      {/* Fingers */}
      <g>
        {frets.map((fret, i) => {
          if (fret > 0) {
            // Check if this fret is part of a barre
            const isBarre = barres?.includes(fret);
            // If it's a barre, we don't necessarily need a circle, or we can draw one. Let's skip circle if barre covers it.
            // Actually, we usually draw a circle for the barre start/end, but the line is enough. Let's just draw the circle for non-barre, or draw it on top of barre.
            const cx = paddingX + i * stringSpacing;
            const cy = paddingY + (fret - minFret + 0.5) * fretSpacing;
            return (
              <circle key={`fin-${i}`} cx={cx} cy={cy} r="6" fill={color} stroke="none" />
            );
          }
          return null;
        })}
      </g>
    </svg>
  );
}
