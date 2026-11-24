// Draws text the way a panel would show it: every lit subpixel, then blurred like an eye at some distance.
// A simulation. Glyphs are rasterized here the way ClearType does it (three samples per pixel and a five-tap filter).
//
// Each subpixel is a rectangle of one color, so blurring it splits into a horizontal and a vertical step:
//   pass 1  canvas width x text rows   horizontal coverage of r, g, b, w (both text versions)
//   pass 2  canvas width x height      vertical coverage, color, divider
// Moving the divider needs only pass 2.
import type { Cell } from '../../src/engine/panels';

export interface Picture { text: string; dark: boolean; cells: Cell[] }
/** distance 0: nose against the panel, 1: reading distance. split 0-1: left browser default, right grayscale. */
export interface View { distance: number; split: number }

const FONT = 16, WHITE = 0.8;
/** A few lines of a page. The middle one is what the visitor typed; close up it is the only one in view. */
const LINE = 24, LINES = 5, MID = 2, ROWS = LINE * LINES, WIDTH = 720, BASE = 17;
const CENTER = MID * LINE + 11.4; // middle of the x-height
const PAGE = [
  'Subpixel smoothing borrows the red, green and blue stripes of each pixel to draw a finer edge than it could alone,',
  'and it expects those stripes in one order. Where a panel arranges them another way, the color lands beside the stem.',
  '',
  'Drawn in shades of gray, the same letters keep their shape and lose the tint, and headings stop glowing at the sides.',
  'Look at the straight stems in a word like illicit or millilitre, first on the left of the line and then on the right.',
];
const FIR = [1 / 9, 2 / 9, 3 / 9, 2 / 9, 1 / 9];
const CHANNEL = { r: 0, g: 1, b: 2, w: 3 } as const;
const toLinear = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });

let scratch: CanvasRenderingContext2D | null = null;
/** One line of text as two strips of linear r, g, b, w: smoothed for an RGB stripe, and gray. */
interface Strip { width: number; lcd: Float32Array; gray: Float32Array }
const strips = new Map<string, Strip>();
function strip(text: string, dark: boolean, white: boolean): Strip {
  const key = `${dark}${white}${text}`, had = strips.get(key);
  if (had) return had;
  if (!scratch) { scratch = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!; scratch.canvas.width = WIDTH * 3; scratch.canvas.height = LINE; scratch.font = `${FONT}px "Segoe UI", "Noto Sans", Roboto, system-ui, sans-serif`; scratch.fillStyle = '#fff'; }
  const m = scratch, W3 = WIDTH * 3;
  m.setTransform(1, 0, 0, 1, 0, 0); m.clearRect(0, 0, W3, LINE);
  const width = m.measureText(text).width;
  m.setTransform(3, 0, 0, 1, 0, 0); m.fillText(text, Math.round((WIDTH - width) / 2), BASE);
  const a = m.getImageData(0, 0, W3, LINE).data, n = WIDTH * LINE * 4, out: Strip = { width, lcd: new Float32Array(n), gray: new Float32Array(n) };
  const cov = new Float32Array(W3 + 4);
  for (let y = 0; y < LINE; y++) {
    for (let x = 0; x < W3; x++) cov[x + 2] = a[(y * W3 + x) * 4 + 3]! / 255;
    const L = (c: number) => toLinear[Math.round((dark ? c : 1 - c) * 255)]!;
    const fir = (x: number) => FIR[0]! * cov[x]! + FIR[1]! * cov[x + 1]! + FIR[2]! * cov[x + 2]! + FIR[3]! * cov[x + 3]! + FIR[4]! * cov[x + 4]!;
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4, s = x * 3;
      const r = L(fir(s)), g = L(fir(s + 1)), b = L(fir(s + 2)), k = white ? Math.min(r, g, b) * WHITE : 0;
      out.lcd[i] = r - k; out.lcd[i + 1] = g - k; out.lcd[i + 2] = b - k; out.lcd[i + 3] = k;
      const e = L((cov[s + 2]! + cov[s + 3]! + cov[s + 4]!) / 3), q = white ? e * WHITE : 0;
      out.gray[i] = out.gray[i + 1] = out.gray[i + 2] = e - q; out.gray[i + 3] = q;
    }
  }
  if (strips.size > 60) strips.delete(strips.keys().next().value!);
  strips.set(key, out);
  return out;
}

const VERT = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;

// Integral of a bell curve: a smoothstep 4.47 sigma wide has the same spread as a Gaussian, ends exactly, and is cheap.
const COMMON = `#version 300 es
precision highp float;precision highp int;precision highp sampler2D;
uniform sampler2D tex;uniform float px,sigma;uniform vec2 origin;uniform vec4 at,len;
vec4 upto(vec4 z){z=clamp(z/4.472+.5,0.,1.);return z*z*(3.-2.*z);}
vec4 span(float lo){vec4 z=(at+lo)/sigma;return upto(z+len/sigma)-upto(z);}
out vec4 o;
`;
const PASS1 = COMMON + `uniform float page;uniform vec4 bg;
void main(){
  float p=(gl_FragCoord.x-origin.x)/px;int c=int(floor(p)),y=int(gl_FragCoord.y),last=textureSize(tex,0).x-1;vec4 s=vec4(0.);
  float show=(y%${ROWS})/${LINE}==${MID}?1.:page;
  for(int d=-1;d<=1;d++)s+=mix(bg,texelFetch(tex,ivec2(clamp(c+d,0,last),y),0),show)*span(float(c+d)-p);
  o=sqrt(s);
}`;
const PASS2 = COMMON + `uniform float height,split,fade;uniform vec4 norm;
void main(){
  float p=(height-gl_FragCoord.y-origin.y)/px;int c=int(floor(p)),x=int(gl_FragCoord.x),base=gl_FragCoord.x>split?${ROWS}:0;vec4 s=vec4(0.);
  for(int d=-1;d<=1;d++){vec4 v=texelFetch(tex,ivec2(x,clamp(c+d,0,${ROWS - 1})+base),0);s+=v*v*span(float(c+d)-p);}
  s*=norm;vec3 l=min(s.rgb+s.a,1.);
  o=vec4(mix(l*12.92,1.055*pow(l,vec3(1./2.4))-.055,step(.0031308,l)),fade);
}`;

class Program {
  readonly id: WebGLProgram;
  private readonly at: Record<string, WebGLUniformLocation | null> = {};
  constructor(private readonly gl: WebGL2RenderingContext, frag: string) {
    this.id = gl.createProgram()!;
    for (const [type, src] of [[gl.VERTEX_SHADER, VERT], [gl.FRAGMENT_SHADER, frag]] as const) { const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); gl.attachShader(this.id, s); }
    gl.linkProgram(this.id);
  }
  check(): void { if (!this.gl.getProgramParameter(this.id, this.gl.LINK_STATUS) && !this.gl.isContextLost()) throw new Error(this.gl.getProgramInfoLog(this.id) ?? 'program'); }
  u(k: string): WebGLUniformLocation | null { return (this.at[k] ??= this.gl.getUniformLocation(this.id, k)); }
}

/** A picture and the textures made from it. */
interface Layer { pic: Picture; w: number; src: WebGLTexture; mid: WebGLTexture; fbo: WebGLFramebuffer; midW: number; key: string }

const FADE = 220;
/** The bell curve used here hides a one-pixel pitch completely at this width, and no wider is needed. */
const EYE = 0.32;

export class Simulator {
  private readonly gl: WebGL2RenderingContext;
  private p1!: Program; private p2!: Program;
  private now: Layer | null = null; private old: Layer | null = null; private fadeFrom = 0;
  private view: View = { distance: 0, split: 1 };
  private W = 0; private H = 0; private want = [0, 0] as [number, number];
  private queued = false; private ready = false; private told = false; private dead = false;
  private readonly still = matchMedia('(prefers-reduced-motion: reduce)');

  /** Throws when WebGL 2 is missing. onReady runs after the first frame. */
  constructor(private readonly canvas: HTMLCanvasElement, private readonly onReady: () => void) {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('no webgl2');
    this.gl = gl;
    this.setup();
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.ready = false; });
    canvas.addEventListener('webglcontextrestored', () => { const p = this.now?.pic; this.now = this.old = null; this.setup(); if (p) this.show(p); });
  }

  private setup(): void {
    const gl = this.gl, async = gl.getExtension('KHR_parallel_shader_compile');
    this.p1 = new Program(gl, PASS1); this.p2 = new Program(gl, PASS2);
    gl.bindVertexArray(gl.createVertexArray());
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    // Compiling must not hold up the page: wait for it without blocking.
    const wait = () => {
      if (this.dead || gl.isContextLost()) return;
      if (async && ![this.p1, this.p2].every((p) => gl.getProgramParameter(p.id, async.COMPLETION_STATUS_KHR))) { requestAnimationFrame(wait); return; }
      this.p1.check(); this.p2.check();
      this.ready = true; this.request();
      if (!this.told) { this.told = true; this.onReady(); }
    };
    wait();
  }

  destroy(): void { this.dead = true; this.drop(this.now); this.drop(this.old); this.now = this.old = null; }

  /** Canvas size in real pixels. */
  size(w: number, h: number): void { this.want = [Math.max(1, w), Math.max(1, h)]; this.request(); }

  show(pic: Picture): void {
    const prev = this.now;
    const fades = prev && (prev.pic.dark !== pic.dark || prev.pic.cells !== pic.cells) && !this.still.matches;
    if (fades) { this.drop(this.old); this.old = prev; this.fadeFrom = performance.now(); this.now = this.layer(pic, null); } else this.now = this.layer(pic, prev);
    this.request();
  }

  look(v: View): void { this.view = v; this.request(); }
  private request(): void { if (this.queued || !this.ready) return; this.queued = true; requestAnimationFrame((t) => { this.queued = false; this.draw(t); }); }

  private texture(): WebGLTexture {
    const gl = this.gl, t = gl.createTexture()!; gl.bindTexture(gl.TEXTURE_2D, t);
    for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST);
    for (const p of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, p, gl.CLAMP_TO_EDGE);
    return t;
  }
  private layer(pic: Picture, reuse: Layer | null): Layer {
    const gl = this.gl, l = reuse ?? { pic, w: 0, src: this.texture(), mid: this.texture(), fbo: gl.createFramebuffer()!, midW: 0, key: '' };
    gl.bindTexture(gl.TEXTURE_2D, l.src);
    if (!reuse) gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, WIDTH, ROWS * 2);
    const put = (line: number, st: Strip) => {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, line * LINE, WIDTH, LINE, gl.RGBA, gl.FLOAT, st.lcd);
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, line * LINE + ROWS, WIDTH, LINE, gl.RGBA, gl.FLOAT, st.gray);
    };
    const same = reuse && reuse.pic.dark === pic.dark && reuse.pic.cells === pic.cells, white = pic.cells.length === 4;
    const mid = strip(pic.text, pic.dark, white); put(MID, mid);
    if (!same) PAGE.forEach((t, i) => { if (i !== MID) put(i, strip(t, pic.dark, white)); });
    l.pic = pic; l.w = mid.width + 12; l.key = '';
    return l;
  }
  private drop(l: Layer | null): void { if (!l) return; const gl = this.gl; gl.deleteTexture(l.src); gl.deleteTexture(l.mid); gl.deleteFramebuffer(l.fbo); }

  private paint(l: Layer, fade: number): void {
    const gl = this.gl, { W, H } = this, t = this.view.distance, dpr = W / Math.max(1, this.canvas.clientWidth || W), cells = l.pic.cells;
    // Reading: 5 CSS pixels per panel pixel, or what makes the typed line fit, and never beyond the ends of the page.
    const far = Math.max(W / WIDTH, Math.min(5 * dpr, W / l.w)), near = Math.max(far * 1.15, H / 15, 26 * dpr);
    const px = near * (far / near) ** t, sigma = 0.05 * (EYE / 0.05) ** Math.min(1, t / 0.62);
    const u = Math.max(0, Math.min(1, (t - 0.68) / 0.27)), page = u * u * (3 - 2 * u);
    const at = [[0, 0, 0, 0], [0, 0, 0, 0]], len = [[1, 1, 1, 1], [1, 1, 1, 1]];
    for (const k of cells) { const c = CHANNEL[k.c]; at[0]![c] = k.x; at[1]![c] = k.y; len[0]![c] = k.w; len[1]![c] = k.h; }
    const key = `${W} ${px} ${sigma} ${page}`;
    if (l.key !== key) {
      gl.disable(gl.BLEND); gl.bindFramebuffer(gl.FRAMEBUFFER, l.fbo);
      if (l.midW !== W) { gl.bindTexture(gl.TEXTURE_2D, l.mid); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, W, ROWS * 2, 0, gl.RGBA, gl.UNSIGNED_BYTE, null); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, l.mid, 0); l.midW = W; }
      gl.viewport(0, 0, W, ROWS * 2); gl.useProgram(this.p1.id); gl.bindTexture(gl.TEXTURE_2D, l.src);
      this.common(this.p1, px, sigma, [W / 2 - (WIDTH / 2) * px, 0], at[0]!, len[0]!);
      gl.uniform1f(this.p1.u('page'), page);
      const k = cells.length === 4 ? WHITE : 0;
      if (l.pic.dark) gl.uniform4f(this.p1.u('bg'), 0, 0, 0, 0); else gl.uniform4f(this.p1.u('bg'), 1 - k, 1 - k, 1 - k, k);
      gl.drawArrays(gl.TRIANGLES, 0, 3); l.key = key;
    }
    const area = Math.min(...cells.map((k) => k.w * k.h)) * 1.05, m = Math.max(0, Math.min(1, (sigma - 0.12) / (EYE - 0.12))), expo = area + (1 - area) * m * m * (3 - 2 * m);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H); gl.useProgram(this.p2.id); gl.bindTexture(gl.TEXTURE_2D, l.mid);
    if (fade < 1) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); } else gl.disable(gl.BLEND);
    this.common(this.p2, px, sigma, [0, H / 2 - CENTER * px], at[1]!, len[1]!);
    gl.uniform1f(this.p2.u('height'), H); gl.uniform1f(this.p2.u('split'), this.view.split * W); gl.uniform1f(this.p2.u('fade'), fade);
    gl.uniform4fv(this.p2.u('norm'), [0, 1, 2, 3].map((c) => expo / (len[0]![c]! * len[1]![c]!)));
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  private common(p: Program, px: number, sigma: number, origin: [number, number], at: number[], len: number[]): void {
    const gl = this.gl;
    gl.uniform1f(p.u('px'), px); gl.uniform1f(p.u('sigma'), sigma); gl.uniform2f(p.u('origin'), ...origin); gl.uniform4fv(p.u('at'), at); gl.uniform4fv(p.u('len'), len);
  }

  private draw(t: number): void {
    if (!this.now || this.dead || this.gl.isContextLost()) return;
    const [W, H] = this.want;
    if (W < 2) return;
    if (this.W !== W || this.H !== H) { this.canvas.width = this.W = W; this.canvas.height = this.H = H; }
    if (this.old) {
      const f = Math.max(0, (t - this.fadeFrom) / FADE);
      if (f >= 1) { this.drop(this.old); this.old = null; } else { this.paint(this.old, 1); this.paint(this.now, f * f * (3 - 2 * f)); this.request(); return; }
    }
    this.paint(this.now, 1);
  }
}
