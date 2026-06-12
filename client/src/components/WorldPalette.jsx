// Renders hidden SVG color-matrix filters and applies the matching one to the
// whole app when the world has lost a color channel (a `tint` consequence).
// Each removed channel is zeroed out, draining that color from everything on
// screen — permanent and inherited by every visitor.

// Which filter to apply for the current palette (the set of lost channels).
export function paletteFilterId(palette) {
  if (!palette) return null;
  const lost = ['red', 'green', 'blue'].filter((c) => palette[c] === false);
  if (lost.length === 0) return null;
  return `pulse-kill-${lost.join('-')}`;
}

export default function WorldPalette() {
  // Pre-declare a filter for every combination of lost channels.
  const channels = ['red', 'green', 'blue'];
  const combos = [];
  for (let mask = 1; mask < 8; mask++) {
    const lost = channels.filter((_, i) => mask & (1 << i));
    combos.push(lost);
  }

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
      <defs>
        {combos.map((lost) => {
          // Compose a matrix that zeroes every lost channel.
          const rows = { r: [1, 0, 0, 0, 0], g: [0, 1, 0, 0, 0], b: [0, 0, 1, 0, 0], a: [0, 0, 0, 1, 0] };
          if (lost.includes('red')) rows.r = [0, 0, 0, 0, 0];
          if (lost.includes('green')) rows.g = [0, 0, 0, 0, 0];
          if (lost.includes('blue')) rows.b = [0, 0, 0, 0, 0];
          const values = [...rows.r, ...rows.g, ...rows.b, ...rows.a].join(' ');
          return (
            <filter key={lost.join('-')} id={`pulse-kill-${lost.join('-')}`}>
              <feColorMatrix type="matrix" values={values} />
            </filter>
          );
        })}
      </defs>
    </svg>
  );
}
