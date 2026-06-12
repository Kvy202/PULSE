import { useEffect, useRef } from 'react';
import { socket } from '../socket.js';

// The living World-Brain. A glowing neural mass at the center of the screen.
// Every real vote fires a synapse toward A (left) or B (right). When the crowd
// is split 50/50 the mass convulses; on a landslide one side blooms. When a
// round resolves, a surge of pulses storms toward the winner.
//
// This component is self-contained and imperative: it listens to the socket
// directly and animates on a canvas, keeping the 60fps loop entirely out of
// React's render cycle.

const NODE_COUNT = 46;
const A_COLOR = [24, 224, 255]; // cyan
const B_COLOR = [255, 61, 127]; // magenta
const NEUTRAL = [150, 170, 220];

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const mix = (c1, c2, t) => [
  c1[0] + (c2[0] - c1[0]) * t,
  c1[1] + (c2[1] - c1[1]) * t,
  c1[2] + (c2[2] - c1[2]) * t,
];

export default function WorldBrain() {
  const canvasRef = useRef(null);
  const S = useRef({
    nodes: [],
    edges: [],
    pulses: [],
    tally: { A: 0, B: 0 },
    activity: 0, // recent voting energy, decays over time
    flash: 0, // verdict screen-flash, decays
    w: 0,
    h: 0,
  });

  // Build the neural network for the current canvas size.
  function buildNetwork(w, h) {
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.32;
    const ry = h * 0.34;
    const nodes = [];
    for (let i = 0; i < NODE_COUNT; i++) {
      // Cluster nodes in an elliptical blob (sum of randoms ≈ gaussian).
      const g = () => (Math.random() + Math.random() + Math.random()) / 3 - 0.5;
      const x = cx + g() * 2 * rx;
      const y = cy + g() * 2 * ry;
      nodes.push({ x, y, bx: x, by: y, r: 1.5 + Math.random() * 2.5, phase: Math.random() * 6.28 });
    }
    // Connect each node to its 2 nearest neighbors.
    const edges = [];
    for (let i = 0; i < nodes.length; i++) {
      const dists = nodes
        .map((n, j) => ({ j, d: (n.x - nodes[i].x) ** 2 + (n.y - nodes[i].y) ** 2 }))
        .filter((o) => o.j !== i)
        .sort((a, b) => a.d - b.d);
      for (let k = 0; k < 2; k++) edges.push([i, dists[k].j]);
    }
    S.current.nodes = nodes;
    S.current.edges = edges;
  }

  // Spawn a synapse pulse from a central node toward a pole.
  function firePulse(choice, hot = false, delay = 0) {
    const { nodes, w, h, pulses } = S.current;
    if (!nodes.length) return;
    const src = nodes[Math.floor(Math.random() * nodes.length)];
    const targetX = choice === 'A' ? 18 : w - 18;
    const targetY = h / 2 + (Math.random() - 0.5) * h * 0.4;
    pulses.push({
      sx: src.x,
      sy: src.y,
      tx: targetX,
      ty: targetY,
      choice,
      t: 0,
      speed: 1 / (0.55 + Math.random() * 0.4),
      delay,
      hot,
    });
    S.current.activity = Math.min(1.6, S.current.activity + 0.25);
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let raf = 0;
    let last = performance.now();
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Respect users who asked for less motion: dampen the convulsion/breathing.
    const motion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0.15 : 1;

    function resize() {
      const rect = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S.current.w = rect.width;
      S.current.h = rect.height;
      buildNetwork(rect.width, rect.height);
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const time = now / 1000;
      const s = S.current;
      const { w, h } = s;

      const total = s.tally.A + s.tally.B;
      const lean = total === 0 ? 0.5 : s.tally.A / total; // 1 = all A, 0 = all B
      const balance = 1 - Math.abs(lean - 0.5) * 2; // 1 at a perfect tie
      const landslide = Math.max(0, Math.abs(lean - 0.5) * 2 - 0.55); // >0 when lopsided
      const convulse = balance * s.activity;

      s.activity *= Math.pow(0.4, dt); // decay toward calm
      s.flash *= Math.pow(0.02, dt);

      const leadColor = lean >= 0.5 ? A_COLOR : B_COLOR;

      // ---- background wash, tinted toward the leader ----
      ctx.clearRect(0, 0, w, h);
      const bg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
      const washColor = mix(NEUTRAL, leadColor, 0.3 + landslide * 0.6);
      bg.addColorStop(0, rgba(washColor, 0.16 + landslide * 0.22 + s.flash * 0.5));
      bg.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // ---- update node positions: breathing + convulsion jitter ----
      for (const n of s.nodes) {
        const breathe = Math.sin(time * 1.4 + n.phase) * 2 * motion;
        const jx = convulse * 9 * motion * Math.sin(time * 17 + n.phase * 3);
        const jy = convulse * 9 * motion * Math.cos(time * 19 + n.phase * 2);
        n.x = n.bx + jx + Math.cos(n.phase) * breathe;
        n.y = n.by + jy + Math.sin(n.phase) * breathe;
      }

      // ---- edges ----
      ctx.lineWidth = 1;
      for (const [i, j] of s.edges) {
        const a = s.nodes[i];
        const b = s.nodes[j];
        const midLean = ((a.x + b.x) / 2 / w); // left→right position
        const ec = mix(B_COLOR, A_COLOR, midLean);
        ctx.strokeStyle = rgba(ec, 0.10 + convulse * 0.18);
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      // ---- nodes ----
      for (const n of s.nodes) {
        const nodeLean = n.bx / w;
        const nc = mix(B_COLOR, A_COLOR, nodeLean);
        const pulse = 0.6 + 0.4 * Math.sin(time * 3 + n.phase);
        ctx.beginPath();
        ctx.fillStyle = rgba(nc, 0.5 + landslide * 0.4);
        ctx.shadowBlur = 12 + convulse * 16;
        ctx.shadowColor = rgba(nc, 0.9);
        ctx.arc(n.x, n.y, n.r * pulse, 0, 6.2832);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ---- pulses (synapses flying to the poles) ----
      for (let i = s.pulses.length - 1; i >= 0; i--) {
        const p = s.pulses[i];
        if (p.delay > 0) {
          p.delay -= dt;
          continue;
        }
        p.t += dt * p.speed;
        if (p.t >= 1) {
          s.pulses.splice(i, 1);
          continue;
        }
        const e = p.t * p.t; // ease-in: shoots outward
        const eTail = Math.max(0, e - 0.08);
        const x = p.sx + (p.tx - p.sx) * e;
        const y = p.sy + (p.ty - p.sy) * e;
        const xt = p.sx + (p.tx - p.sx) * eTail;
        const yt = p.sy + (p.ty - p.sy) * eTail;
        const c = p.choice === 'A' ? A_COLOR : B_COLOR;
        const alpha = (1 - p.t) * (p.hot ? 1 : 0.85);

        ctx.strokeStyle = rgba(c, alpha * 0.5);
        ctx.lineWidth = p.hot ? 2.5 : 1.6;
        ctx.beginPath();
        ctx.moveTo(xt, yt);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.fillStyle = rgba(c, alpha);
        ctx.shadowBlur = p.hot ? 18 : 10;
        ctx.shadowColor = rgba(c, 0.9);
        ctx.arc(x, y, p.hot ? 3.2 : 2.2, 0, 6.2832);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // ---- pole readouts (live counts) ----
      const drawPole = (label, count, color, x, align) => {
        ctx.textAlign = align;
        ctx.fillStyle = rgba(color, 0.9);
        ctx.font = '600 13px "Courier New", monospace';
        ctx.fillText(label, x, h / 2 - 18);
        ctx.font = '700 26px "Courier New", monospace';
        ctx.shadowBlur = 14;
        ctx.shadowColor = rgba(color, 0.7);
        ctx.fillText(String(count), x, h / 2 + 12);
        ctx.shadowBlur = 0;
      };
      drawPole('◄ A', s.tally.A, A_COLOR, 14, 'left');
      drawPole('B ►', s.tally.B, B_COLOR, w - 14, 'right');

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    // ---- socket wiring ----
    const onStart = (r) => {
      S.current.tally = r.tally ? { ...r.tally } : { A: 0, B: 0 };
      S.current.pulses = [];
      S.current.activity = 0;
      S.current.flash = 0;
    };
    const onTally = (t) => {
      S.current.tally = { A: t.A, B: t.B };
      // Each flush carries how many votes landed on each side since the last one
      // (dA/dB); fire a synapse per new vote, capped so a surge can't spawn
      // thousands of particles in a single frame.
      const dA = Math.min(t.dA ?? 0, 14);
      const dB = Math.min(t.dB ?? 0, 14);
      for (let i = 0; i < dA; i++) firePulse('A');
      for (let i = 0; i < dB; i++) firePulse('B');
    };
    const onResolve = (v) => {
      S.current.tally = { ...v.tally };
      S.current.flash = 1;
      // A storm of pulses surges toward the winner, staggered over ~1.1s.
      for (let i = 0; i < 26; i++) firePulse(v.result, true, Math.random() * 1.1);
    };

    socket.on('round:start', onStart);
    socket.on('tally:update', onTally);
    socket.on('round:resolve', onResolve);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      socket.off('round:start', onStart);
      socket.off('tally:update', onTally);
      socket.off('round:resolve', onResolve);
    };
  }, []);

  return <canvas ref={canvasRef} className="brain" />;
}
