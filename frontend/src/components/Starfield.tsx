import { useEffect, useRef } from 'react';

export interface Star {
  x: number; y: number; key: string;
  hue: [number, number, number];
  mag: number; section: string;
}

interface Props {
  stars: Star[];
  matchKeys: Set<string>;
  queryActive: boolean;
  selectedKey: string | null;
  constellation: Map<string, { x: number; y: number }> | null;
  onSelect: (key: string, x: number, y: number) => void;
}

const VERT = `
attribute vec2 position;
attribute vec3 color;
attribute float magnitude;
attribute float match;
varying vec3 vColor;
varying float vMatch;
uniform float uTime;
uniform float uPixelRatio;
void main() {
  vColor = color;
  vMatch = match;
  vec4 mv = vec4(position * 2.0 - 1.0, 0.0, 1.0);
  mv.y *= -1.0;
  float size = 2.0 + magnitude * 1.5;
  if (match > 0.5) size *= 2.0;
  if (match > 1.5) size *= 1.45;
  gl_PointSize = size * uPixelRatio;
  gl_Position = mv;
}
`;

const FRAG = `
precision mediump float;
varying vec3 vColor;
varying float vMatch;
uniform float uTime;
void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  if (d > 0.5) discard;
  float alpha = smoothstep(0.5, 0.1, d);
  float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + vColor.r * 10.0);
  float brightness = vMatch > 1.5 ? 1.0 : (vMatch > 0.5 ? 0.95 : 0.35);
  if (vMatch < 0.2) brightness = 0.07;
  vec3 col = vColor * brightness * twinkle;
  // glow for matches
  if (vMatch > 0.5) {
    col += vec3(0.35, 0.9, 0.82) * 0.3 * alpha;
  }
  gl_FragColor = vec4(col, alpha * brightness);
}
`;

/** Starfield — WebGL night sky with constellation formation */
export default function Starfield({ stars, matchKeys, queryActive, selectedKey, constellation, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const glRef = useRef<WebGLRenderingContext | null>(null);
  const posRef = useRef<Float32Array | null>(null);
  // refs for props used in render loop (avoid stale closures)
  const propsRef = useRef({ matchKeys, queryActive, selectedKey, constellation, onSelect });
  propsRef.current = { matchKeys, queryActive, selectedKey, constellation, onSelect };

  // init WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl', { alpha: true });
    if (!gl) return;
    glRef.current = gl;

    const compile = (type: number, src: string) => {
      const sh = gl.createShader(type)!;
      gl.shaderSource(sh, src);
      gl.compileShader(sh);
      return sh;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);

    const n = stars.length;
    const positions = new Float32Array(n * 2);
    const colors = new Float32Array(n * 3);
    const mags = new Float32Array(n);
    const matches = new Float32Array(n);

    stars.forEach((s, i) => {
      positions[i * 2] = s.x;
      positions[i * 2 + 1] = s.y;
      colors[i * 3] = s.hue[0];
      colors[i * 3 + 1] = s.hue[1];
      colors[i * 3 + 2] = s.hue[2];
      mags[i] = s.mag;
    });
    posRef.current = positions;

    const buf = (data: Float32Array, size: number, name: string) => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(prog, name);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
      return b;
    };
    const posBuf = buf(positions, 2, 'position');
    buf(colors, 3, 'color');
    buf(mags, 1, 'magnitude');
    const matchBuf = buf(matches, 1, 'match');

    const uTime = gl.getUniformLocation(prog, 'uTime');
    const uPixelRatio = gl.getUniformLocation(prog, 'uPixelRatio');

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = r.width * dpr;
      canvas.height = r.height * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(uPixelRatio, dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    let raf: number;
    const start = performance.now();
    const render = () => {
      const { matchKeys: mk, queryActive: qa, selectedKey: sk } = propsRef.current;
      // update match values
      stars.forEach((s, i) => {
        if (sk === s.key) matches[i] = 2.0;
        else if (!qa || mk.has(s.key)) matches[i] = 1.0;
        else matches[i] = 0.0;
      });
      gl.bindBuffer(gl.ARRAY_BUFFER, matchBuf);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, matches);

      // update positions for constellation
      if (posRef.current) {
        const { constellation: cl } = propsRef.current;
        let dirty = false;
        stars.forEach((s, i) => {
          const t = cl?.get(s.key);
          const tx = t ? t.x : s.x;
          const ty = t ? t.y : s.y;
          const cx = posRef.current![i * 2];
          const cy = posRef.current![i * 2 + 1];
          // lerp toward target
          const nx = cx + (tx - cx) * 0.12;
          const ny = cy + (ty - cy) * 0.12;
          if (Math.abs(nx - cx) > 0.0001 || Math.abs(ny - cy) > 0.0001) dirty = true;
          posRef.current![i * 2] = nx;
          posRef.current![i * 2 + 1] = ny;
        });
        if (dirty) {
          gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
          gl.bufferSubData(gl.ARRAY_BUFFER, 0, posRef.current);
        }
      }

      gl.uniform1f(uTime, (performance.now() - start) / 1000);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, n);
      raf = requestAnimationFrame(render);
    };
    render();

    // click handling
    const handleClick = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width;
      const my = (e.clientY - r.top) / r.height;
      let best: Star | null = null;
      let bestD = 0.05;
      const pos = posRef.current!;
      stars.forEach((s, i) => {
        const sx = pos[i * 2];
        const sy = pos[i * 2 + 1];
        const d = Math.hypot(sx - mx, sy - my);
        if (d < bestD) { bestD = d; best = s; }
      });
      if (best) {
        const b = best as Star;
        const idx = stars.indexOf(b);
        propsRef.current.onSelect(b.key, pos[idx * 2], pos[idx * 2 + 1]);
      }
    };
    canvas.addEventListener('click', handleClick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('click', handleClick);
    };
  }, [stars]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />;
}
