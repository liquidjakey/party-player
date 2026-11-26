// TV background: six painterly gradients (WebGL) that rotate on their own.
// Order is random. Each change slowly dissolves in like paint spreading (a soft noise mask), never a hard cut.
// Independent of the song's cover, so an empty queue or a missing thumbnail looks the same.
'use client';
import { useEffect, useRef } from 'react';

export type Tone = 'light' | 'dark';

interface Backdrop {
  id: string;
  name: string;
  mode: number;
  tone: Tone;
  colors: [string, string, string, string];
}

export const BACKDROPS: Backdrop[] = [
  { id: 'flow', name: 'Harvest Flow', mode: 0, tone: 'light', colors: ['#f8ecdc', '#f5c39a', '#ec8d58', '#d4685c'] },
  { id: 'sunrise', name: 'First Light', mode: 2, tone: 'dark', colors: ['#1f2440', '#5a4a72', '#d86f6f', '#e08a45'] },
  { id: 'silk', name: 'Cider Silk', mode: 3, tone: 'dark', colors: ['#5a2414', '#a8481e', '#e89a4c', '#fbe3c0'] },
  { id: 'wash', name: 'Pumpkin Wash', mode: 4, tone: 'light', colors: ['#e8743b', '#f3a46a', '#f2b7a8', '#fbf1e2'] },
  { id: 'aurora', name: 'Ember Aurora', mode: 1, tone: 'dark', colors: ['#1c1016', '#3a1a22', '#f39a52', '#f6c58a'] },
  { id: 'swirl', name: 'Sage Swirl', mode: 5, tone: 'dark', colors: ['#2e4635', '#5f7f57', '#a9bf8f', '#efe9d6'] },
];

const FRAG = `
precision highp float;
uniform vec2 r; uniform float t; uniform float blend;
uniform float modeA; uniform vec3 a0; uniform vec3 a1; uniform vec3 a2; uniform vec3 a3;
uniform float modeB; uniform vec3 b0; uniform vec3 b1; uniform vec3 b2; uniform vec3 b3;

float hash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1.0,0.0)), u.x), mix(hash(i+vec2(0.0,1.0)), hash(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return v; }
vec3 ramp(float x, vec3 c0, vec3 c1, vec3 c2, vec3 c3){ x = clamp(x, 0.0, 1.0);
  vec3 a = mix(c0, c1, smoothstep(0.0, 0.34, x));
  vec3 b = mix(a, c2, smoothstep(0.30, 0.68, x));
  return mix(b, c3, smoothstep(0.64, 1.0, x)); }

vec3 scene(float mode, vec2 uv, vec2 p, float T0, vec3 c0, vec3 c1, vec3 c2, vec3 c3){
  float asp = r.x / r.y;
  // Each scene has its own pace, so all six feel about as alive as Cider Silk
  float T = T0 * (mode < 0.5 ? 1.8 : mode > 4.5 ? 1.7 : mode > 3.5 ? 1.6 : 1.0);
  if (mode < 0.5) { // Harvest Flow: domain-warped paint
    vec2 sp = p*0.95;
    vec2 q = vec2(fbm(sp + vec2(0.0, T*0.05)), fbm(sp + vec2(5.2, 1.3) - T*0.045));
    vec2 w = vec2(fbm(sp + 2.0*q + vec2(1.7, 9.2) + T*0.03), fbm(sp + 2.0*q + vec2(8.3, 2.8) - T*0.035));
    return ramp(smoothstep(0.24, 0.68, fbm(sp + 2.2*w)), c0, c1, c2, c3);
  }
  if (mode < 1.5) { // Ember Aurora: curtains of light over a night sky
    vec3 sky = mix(c1, c0, smoothstep(0.0, 1.0, uv.y));
    float band = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float y0 = 0.42 + 0.12*fi + 0.28*(fbm(vec2(p.x*0.9 + fi*3.1 + T*0.06, T*0.04 + fi)) - 0.5);
      float d = uv.y - y0;
      float curtain = exp(-d*d*(d > 0.0 ? 22.0 : 140.0));
      float streak = 0.55 + 0.45*noise(vec2(p.x*38.0 + fi*10.0, T*0.2));
      band += curtain * streak * (0.75 - 0.18*fi);
    }
    return sky + band * mix(c2, c3, smoothstep(0.3, 1.0, band)) * 0.95;
  }
  if (mode < 2.5) { // First Light: a dusk sky whose bands roll like slow waves, with clouds streaming across
    float roll = fbm(vec2(p.x*0.8 + T*0.15, T*0.1));
    float wave = 0.26*(roll - 0.5) + 0.07*sin(T*0.28 + p.x*1.7) + 0.04*sin(T*0.19 - p.x*3.3);
    float y = uv.y + wave + 0.05*sin(T*0.17);
    vec3 col = ramp(1.0 - smoothstep(0.0, 1.0, y), c0, c1, c2, c3);
    // Cloud ribbons: stretched sideways, bent by a second noise, streaming to the left
    vec2 cp = vec2(p.x*1.2 - T*0.16, p.y*3.4 + T*0.05);
    float cloud = fbm(cp + 0.9*vec2(fbm(p*1.1 + vec2(T*0.09, 0.0)), fbm(p*1.1 + vec2(4.0, -T*0.07))));
    float lit = smoothstep(0.5, 0.8, cloud) * smoothstep(0.1, 0.8, uv.y);
    col = mix(col, mix(c1, c3, 0.35 + 0.4*(1.0 - uv.y)), lit * 0.42);
    vec2 sun = vec2((0.5 + 0.32*sin(T*0.09)) * asp, 0.12 + 0.07*sin(T*0.13));
    col += c3 * exp(-dot(p - sun, p - sun) * 2.6) * (0.2 + 0.06*sin(T*0.4));
    return col;
  }
  if (mode < 3.5) { // Cider Silk: glossy folds with sliding highlights
    float w = fbm(p*0.9 + vec2(T*0.045, -T*0.03));
    float ph = (p.y*3.2 + p.x*1.4) + w*5.5 + T*0.12;
    vec3 col = ramp((0.5 + 0.5*sin(ph))*0.85, c0, c1, c2, c3);
    return mix(col, c3, pow(max(0.0, sin(ph + 0.35)), 18.0) * 0.55);
  }
  if (mode < 4.5) { // Pumpkin Wash: warm paint flowing in slow ribbons, pumpkin at the top, cream at the bottom
    vec2 sp = p*1.05 + vec2(T*0.02, 0.0);
    vec2 q = vec2(fbm(sp + vec2(0.0, T*0.075)), fbm(sp + vec2(5.2, 1.3) - T*0.065));
    vec2 w = vec2(fbm(sp + 1.9*q + vec2(1.7, 9.2) + T*0.055), fbm(sp + 1.9*q + vec2(8.3, 2.8) - T*0.05));
    float f = fbm(sp + 2.1*w);
    float swell = 0.06*sin(p.x*1.5 + T*0.16) + 0.04*sin(p.x*2.7 - T*0.12); // the whole wash rises and falls
    float x = (1.0 - uv.y)*0.72 + swell + (f - 0.5)*0.95;
    return ramp(smoothstep(0.02, 0.98, x), c0, c1, c2, c3);
  }
  // Sage Swirl: greens turning around a pale center
  vec2 d = p - vec2(0.5*asp, 0.5); float rad = length(d);
  float ang = atan(d.y, d.x) + 1.6*exp(-rad*1.4) * (1.0 + 0.2*sin(T*0.07)) + T*0.05;
  float f = fbm(vec2(cos(ang), sin(ang)) * rad * 2.2 + vec2(T*0.03, 0.0));
  return ramp(clamp(1.0 - rad*1.15 + (f - 0.5)*0.9, 0.0, 1.0), c0, c1, c2, c3);
}

void main(){
  vec2 uv = gl_FragCoord.xy / r; vec2 p = uv * vec2(r.x / r.y, 1.0);
  vec3 col = scene(modeA, uv, p, t, a0, a1, a2, a3);
  if (blend > 0.001) {
    vec3 nb = scene(modeB, uv, p, t, b0, b1, b2, b3);
    // Organic dissolve: the next scene spreads in along a slow noise field, like wet paint.
    float n = fbm(p*0.7 + vec2(t*0.01, -t*0.008));
    float m = smoothstep(n - 0.55, n + 0.55, blend*2.2 - 0.6);
    m = m*m*(3.0 - 2.0*m);
    col = mix(col, nb, m);
  }
  col += (hash(gl_FragCoord.xy + fract(t)) - 0.5) / 255.0; // invisible dither, prevents banding
  gl_FragColor = vec4(col, 1.0);
}`;

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number];
const ease = (k: number) => k * k * k * (k * (k * 6 - 15) + 10); // smootherstep

/**
 * Full-screen rotating gradient. `pin` = a backdrop id to stay on (?bg=...), else it rotates.
 * `onTone` reports when text should switch between light and dark (halfway through each change).
 */
export function GradientBackdrop({
  pin,
  holdSec = 180,
  fadeSec = 30,
  onTone,
}: {
  pin?: string | null;
  holdSec?: number;
  fadeSec?: number;
  onTone?: (tone: Tone) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);
  const toneRef = useRef(onTone);
  useEffect(() => {
    toneRef.current = onTone;
  }, [onTone]);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const pinned = BACKDROPS.findIndex((b) => b.id === pin);
    let idx = pinned >= 0 ? pinned : Math.floor(Math.random() * BACKDROPS.length);
    let next = idx;
    let prev = -1;
    // Random order: never the current one or the one just before it.
    const pickNext = () => {
      const choices = BACKDROPS.map((_, i) => i).filter((i) => i !== idx && i !== prev);
      return choices[Math.floor(Math.random() * choices.length)];
    };
    let phaseStart = performance.now();
    let fading = false;
    let toneSent: Tone | null = null;
    const sendTone = (tone: Tone) => {
      if (tone !== toneSent) {
        toneSent = tone;
        toneRef.current?.(tone);
      }
    };
    sendTone(BACKDROPS[idx].tone);

    const gl = canvas.getContext('webgl', { antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
    // No WebGL (rare on TVs): a plain CSS gradient of the current palette, crossfaded by CSS.
    if (!gl) {
      canvas.hidden = true;
      const paint = () => {
        const b = BACKDROPS[idx];
        if (fallbackRef.current) fallbackRef.current.style.background = `linear-gradient(160deg, ${b.colors.join(', ')})`;
        sendTone(b.tone);
      };
      paint();
      if (pinned >= 0 || reduce) return;
      const timer = setInterval(() => {
        const n = pickNext();
        prev = idx;
        idx = n;
        paint();
      }, holdSec * 1000);
      return () => clearInterval(timer);
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error('[backdrop]', gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, 'attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }'));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const U = Object.fromEntries(
      ['r', 't', 'blend', 'modeA', 'a0', 'a1', 'a2', 'a3', 'modeB', 'b0', 'b1', 'b2', 'b3'].map((n) => [n, gl.getUniformLocation(prog, n)]),
    );
    const setScene = (prefix: 'a' | 'b', b: Backdrop) => {
      gl.uniform1f(U[prefix === 'a' ? 'modeA' : 'modeB'], b.mode);
      b.colors.forEach((c, i) => gl.uniform3fv(U[`${prefix}${i}`], hex(c)));
    };

    // Soft gradients do not need full resolution: half size keeps weak TV GPUs cool.
    const size = () => {
      const scale = Math.min(devicePixelRatio || 1, 1) * 0.5;
      canvas.width = Math.max(1, Math.round(innerWidth * scale));
      canvas.height = Math.max(1, Math.round(innerHeight * scale));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    size();

    const draw = (now: number) => {
      const elapsed = (now - phaseStart) / 1000;
      let blend = 0;
      if (!fading && pinned < 0 && !reduce && elapsed > holdSec) {
        fading = true;
        next = pickNext();
        phaseStart = now;
      }
      if (fading) {
        const k = Math.min(1, (now - phaseStart) / 1000 / fadeSec);
        blend = ease(k);
        if (k >= 0.5) sendTone(BACKDROPS[next].tone);
        if (k >= 1) {
          prev = idx;
          idx = next;
          fading = false;
          phaseStart = now;
          blend = 0;
        }
      }
      setScene('a', BACKDROPS[idx]);
      setScene('b', BACKDROPS[fading ? next : idx]);
      gl.uniform2f(U.r, canvas.width, canvas.height);
      gl.uniform1f(U.t, 30 + now / 1000);
      gl.uniform1f(U.blend, blend);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    // ~30 fps is plenty for slow motion and halves the GPU work.
    let raf = 0;
    let last = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (now - last < 33) return;
      last = now;
      draw(now);
    };
    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    const onVis = () => (document.hidden ? stop() : start());
    const onResize = () => {
      size();
      if (reduce) draw(performance.now());
    };
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVis);
    if (reduce) draw(performance.now());
    else start();
    return () => {
      stop();
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [pin, holdSec, fadeSec]);

  return (
    <div aria-hidden className="absolute inset-0">
      <div ref={fallbackRef} className="absolute inset-0 transition-[background] duration-[3000ms]" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
