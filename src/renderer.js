const rad = d => d * Math.PI / 180;
const norm = a => { const s = Math.hypot(...a); return a.map(x => x / s) };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
function lookAt(eye, target) {
  const z = norm(eye.map((v, i) => v - target[i]));
  const x = norm(cross([0, 1, 0], z));
  const y = cross(z, x);
  return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
}
function perspective(fov, aspect) {
  const f = 1 / Math.tan(fov / 2), n = .05, z = 100;
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (z + n) / (n - z), -1, 0, 0, 2 * z * n / (n - z), 0]);
}
const sourceFunctions = `
uniform sampler2D uSource;
uniform bool uDemo;
uniform vec2 uSourceSize;
float demoHeight(vec2 uv) {
  vec2 p = (uv - .5) * 2.;
  float a = .79 * exp(-((p.x + .23) * (p.x + .23) * 4.8 + (p.y - .03) * (p.y - .03) * 7.));
  float b = .38 * exp(-((p.x - .49) * (p.x - .49) * 20. + (p.y + .14) * (p.y + .14) * 14.));
  float wave = .13 * sin(p.x * 11.5 + p.y * 5. + sin(p.y * 7.) * 1.5) * exp(-dot(p, p) * 1.9);
  return clamp(.07 + a + b + wave, 0., 1.);
}
vec4 sourceAt(vec2 uv) {
  if (uDemo) { float h = demoHeight(uv); return vec4(vec3(h), 1.); }
  return texture(uSource, clamp(uv, 0., 1.));
}
float heightAt(vec2 uv) {
  vec4 c = sourceAt(uv);
  return dot(c.rgb, vec3(.2126, .7152, .0722)) * c.a;
}
`;
const meshVert = `#version 300 es
precision highp float;
layout(location=0) in vec2 aUV;
${sourceFunctions}
uniform float uSourceAspect,uHeight,uSmooth,uTilt,uTurn,uPanY,uPanX,uRenderMode,uDisplacement,uSmoothness;
uniform mat4 uView,uProjection;
out vec2 vUV; out float vHeight;
void main() {
  vec2 px = vec2(uSmooth) / uSourceSize;
  float h = heightAt(aUV) * .4 + (heightAt(aUV + vec2(px.x, 0)) + heightAt(aUV - vec2(px.x, 0)) + heightAt(aUV + vec2(0, px.y)) + heightAt(aUV - vec2(0, px.y))) * .15;
  h = h * uSmoothness + .16 * (1. - uSmoothness);
  vec3 p = vec3((aUV.x - .5) * uSourceAspect, aUV.y - .5, (h - .16) * uHeight * uDisplacement);
  float c = cos(uTilt), s = sin(uTilt);
  p.yz = mat2(c, -s, s, c) * p.yz;
  c = cos(uTurn); s = sin(uTurn);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p.xy += vec2(uPanX, uPanY);
  gl_Position = uProjection * uView * vec4(p, 1.);
  vUV = aUV; vHeight = h;
  if (uRenderMode > 0.5) gl_PointSize = 2.0 + (h - .5) * 4.0;
}`;
const meshFrag = `#version 300 es
precision highp float;
${sourceFunctions}
in vec2 vUV; in float vHeight;
uniform float uLines,uThickness,uBrightness,uSourceColour,uBlackPoint,uRenderMode,uPosterize;
uniform vec3 uColour; uniform bool uXray;
out vec4 outColour;
void main() {
  float band = abs(fract(vUV.y * uLines) - .5);
  float aa = max(fwidth(vUV.y * uLines) * .7, .002);
  float mask = 1. - smoothstep(uThickness * .5 - aa, uThickness * .5 + aa, band);
  float luminance = clamp((vHeight - uBlackPoint) * 1.45, 0., 1.);
  float power = (.045 + .955 * luminance) * uBrightness;
  vec3 source = sourceAt(vUV).rgb;
  vec3 col = mix(uColour * power, source * uBrightness, uSourceColour);
  if (uPosterize > 0.) {
    float levels = 2. + uPosterize * 62.;
    col = floor(col * levels) / levels;
  }
  if (uRenderMode > 0.5) { mask = 1.; }
  if (uXray) { if (mask < .005) discard; outColour = vec4(col, mask); }
  else { outColour = vec4(col * mask, 1.); }
}`;
const fullVert = `#version 300 es
precision highp float;
out vec2 vUV;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUV = p;
  gl_Position = vec4(p * 2. - 1., 0., 1.);
}`;
const warpFrag = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColour;
uniform sampler2D uImage;
uniform float uTime,uWarp,uJitter,uTears,uChromatic,uGlitch,uColorDrift,uDither,uSlitScan,uPosterize;
uniform vec2 uSize;
float hash(float n) { return fract(sin(n * 127.1 + 71.7) * 43758.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  float t = uTime * 24.;
  float y = vUV.y;
  float ripple = uWarp * (.028 * sin(y * 22. + t * .024) + .012 * sin(y * 58. - t * .08) + .004 * sin(y * 176. + t * .14));
  float jitter = (hash(floor(y * 1080.) + floor(t * .5) * 17.) - .5) * uJitter * .012;
  float tear = step(.967, hash(floor(y * 540.) + floor(t * .18) * 31.)) * (hash(floor(y * 540.) * 1.31) - .5) * uTears * .13;
  float glitchBand = step(.985 - uGlitch * .015, hash2(vec2(floor(y * 120.), floor(t * 6.)))) * (hash2(vec2(floor(y * 120.) * 1.7, floor(t * 3.))) - .5) * uGlitch * .18;
  float slit = uSlitScan * 0.02 * sin(y * 60.0 + t * 2.0);
  vec2 uv = vUV + vec2(ripple + jitter + tear + glitchBand + slit, 0.);
  float split = uChromatic * .0035;
  float rd = uColorDrift * .004 * sin(t * 0.7);
  float gd = uColorDrift * .004 * sin(t * 0.7 + 2.1);
  float bd = uColorDrift * .004 * sin(t * 0.7 + 4.2);
  vec3 col = vec3(texture(uImage, uv + vec2(split + rd, 0)).r, texture(uImage, uv + vec2(gd, 0)).g, texture(uImage, uv - vec2(split + bd, 0)).b);
  if (uDither > 0.) {
    float levels = 2.0 + uDither * 254.0;
    col = floor(col * levels) / levels;
  }
  if (uPosterize > 0.) {
    float levels = 2. + uPosterize * 62.;
    col = floor(col * levels) / levels;
  }
  outColour = vec4(col, 1.);
}`;
const blurFrag = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColour;
uniform sampler2D uImage; uniform vec2 uDirection;
void main() {
  vec3 c = texture(uImage, vUV).rgb * .227027;
  c += texture(uImage, vUV + uDirection * 1.384615).rgb * .316216;
  c += texture(uImage, vUV - uDirection * 1.384615).rgb * .316216;
  c += texture(uImage, vUV + uDirection * 3.230769).rgb * .070270;
  c += texture(uImage, vUV - uDirection * 3.230769).rgb * .070270;
  outColour = vec4(c, 1.);
}`;
const finishFrag = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColour;
${sourceFunctions}
uniform sampler2D uImage,uGlow,uFeedback;
uniform float uGlowAmount,uStreaks,uGrain,uScanlines,uTime,uMix,uSourceAspect,uOutputAspect,uFeedbackAmt,uClarity,uEdge,uVignette,uContrast;
float rand(vec2 n) { return fract(sin(dot(n, vec2(12.9898, 78.233)) + floor(uTime * 24.) * 13.1) * 43758.5453); }
void main() {
  vec3 c = texture(uImage, vUV).rgb;
  vec3 blur = texture(uGlow, vUV).rgb;
  vec3 glow = blur;
  vec3 streak = vec3(0.);
  for (int i = 1; i <= 7; i++) {
    float x = float(i) * .011;
    streak += texture(uGlow, vUV - vec2(x, 0)).rgb * (1. - float(i) / 9.);
    streak += texture(uGlow, vUV + vec2(x * .5, 0)).rgb * (1. - float(i) / 9.);
  }
  c += glow * uGlowAmount * 1.6 + streak * uStreaks * .18;
  // clarity: unsharp mask using the existing blur buffer
  if (uClarity > 0.) c = mix(c, c + (c - blur) * uClarity * 1.5, uClarity);
  // contrast around mid-gray
  if (uContrast != 1.) c = mix(vec3(.5), c, uContrast);
  // edge highlight / neon outline
  if (uEdge > 0.) {
    vec3 edge = c - blur;
    float edgeAmt = length(edge) * uEdge;
    c = mix(c, c + edge * 1.8, edgeAmt);
  }
  float scan = 1. - uScanlines * (.5 + .5 * cos(vUV.y * 540. * 6.2831853));
  c *= scan;
  float grain = (rand(gl_FragCoord.xy) - .5) * uGrain * (.15 + .85 * max(c.r, max(c.g, c.b)));
  c += grain;
  if (uFeedbackAmt > 0.) {
    vec3 prev = texture(uFeedback, vUV).rgb;
    c = mix(c, prev, uFeedbackAmt * .85);
  }
  // vignette: corner darkening for focus
  if (uVignette > 0.) {
    vec2 d = vUV - .5;
    float dist = dot(d, d) * 4.;
    float vign = smoothstep(uVignette * 1.2, .15, dist);
    c *= mix(1., vign, uVignette);
  }
  vec2 suv = vUV;
  vec2 fit = vec2(max(1., uOutputAspect / uSourceAspect), max(1., uSourceAspect / uOutputAspect));
  suv = (suv - .5) * fit + .5;
  vec3 original = sourceAt(suv).rgb;
  if (any(lessThan(suv, vec2(0.))) || any(greaterThan(suv, vec2(1.)))) original = vec3(0.);
  c = mix(original, c, uMix);
  outColour = vec4(clamp(c, 0., 1.), 1.);
}`;
const copyFrag = `#version 300 es
precision highp float;
in vec2 vUV; out vec4 outColour;
uniform sampler2D uImage,uFeedback; uniform float uMix;
void main() {
  vec3 cur = texture(uImage, vUV).rgb;
  vec3 prev = texture(uFeedback, vUV).rgb;
  outColour = vec4(mix(cur, prev, uMix), 1.);
}`;
export class SignalRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance', depth: true });
    if (!this.gl) throw Error('WebGL 2 is unavailable. Open this in desktop Chrome or Edge with hardware acceleration enabled.');
    const g = this.gl;
    this.maxSize = Math.min(g.getParameter(g.MAX_TEXTURE_SIZE), g.getParameter(g.MAX_RENDERBUFFER_SIZE), ...g.getParameter(g.MAX_VIEWPORT_DIMS));
    this.meshProgram = this.program(meshVert, meshFrag);
    this.warpProgram = this.program(fullVert, warpFrag);
    this.blurProgram = this.program(fullVert, blurFrag);
    this.finishProgram = this.program(fullVert, finishFrag);
    this.copyProgram = this.program(fullVert, copyFrag);
    this.emptyVAO = g.createVertexArray();
    this.meshVAO = g.createVertexArray();
    this.vertexBuffer = g.createBuffer();
    this.indexBuffer = g.createBuffer();
    this.sourceTex = this.texture();
    g.bindTexture(g.TEXTURE_2D, this.sourceTex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, 1, 1, 0, g.RGBA, g.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    this.feedbackFbo = this.createFbo(1, 1, true);
    this.feedbackTex = this.feedbackFbo.tex;
    this.source = null;
    this.sourceWidth = 3840;
    this.sourceHeight = 2160;
    this.sourceAspect = 16 / 9;
    this.targets = [];
    this.dirtySource = false;
    this.buildMesh(96, 384);
    this.resize(1280, 720);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.onLost?.(); });
  }
  createFbo(w = 1, h = 1, depth = false) {
    const g = this.gl, tex = this.texture(), fbo = g.createFramebuffer();
    g.bindTexture(g.TEXTURE_2D, tex);
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    if (depth) {
      let rb = g.createRenderbuffer();
      g.bindRenderbuffer(g.RENDERBUFFER, rb);
      g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, w, h);
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, rb);
    }
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw Error('framebuffer incomplete');
    return { tex, fbo };
  }
  program(vs, fs) {
    const g = this.gl;
    const compile = (type, code) => {
      const s = g.createShader(type);
      g.shaderSource(s, code);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw Error(g.getShaderInfoLog(s));
      return s;
    };
    const v = compile(g.VERTEX_SHADER, vs), f = compile(g.FRAGMENT_SHADER, fs), p = g.createProgram();
    g.attachShader(p, v); g.attachShader(p, f);
    g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw Error(g.getProgramInfoLog(p));
    g.deleteShader(v); g.deleteShader(f);
    const n = g.getProgramParameter(p, g.ACTIVE_UNIFORMS), uniforms = {};
    for (let i = 0; i < n; i++) {
      const a = g.getActiveUniform(p, i);
      uniforms[a.name] = g.getUniformLocation(p, a.name);
    }
    return { p, uniforms };
  }
  texture() {
    const g = this.gl, t = g.createTexture();
    g.bindTexture(g.TEXTURE_2D, t);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
    g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
    return t;
  }
  target(w, h, depth = false) {
    const g = this.gl, tex = this.texture(), fbo = g.createFramebuffer();
    let rb;
    g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, w, h, 0, g.RGBA, g.UNSIGNED_BYTE, null);
    g.bindFramebuffer(g.FRAMEBUFFER, fbo);
    g.framebufferTexture2D(g.FRAMEBUFFER, g.COLOR_ATTACHMENT0, g.TEXTURE_2D, tex, 0);
    if (depth) {
      rb = g.createRenderbuffer();
      g.bindRenderbuffer(g.RENDERBUFFER, rb);
      g.renderbufferStorage(g.RENDERBUFFER, g.DEPTH_COMPONENT16, w, h);
      g.framebufferRenderbuffer(g.FRAMEBUFFER, g.DEPTH_ATTACHMENT, g.RENDERBUFFER, rb);
    }
    if (g.checkFramebufferStatus(g.FRAMEBUFFER) !== g.FRAMEBUFFER_COMPLETE) throw Error(`The GPU could not allocate a ${w} \u00d7 ${h} render target. No lower-resolution file was made.`);
    return { tex, fbo, rb, w, h };
  }
  resize(w, h) {
    w = Math.round(w); h = Math.round(h);
    if (w > this.maxSize || h > this.maxSize) throw Error(`This GPU's render limit is ${this.maxSize}px; ${w} \u00d7 ${h} is not supported.`);
    if (this.w === w && this.h === h) return;
    const g = this.gl;
    for (const t of this.targets) { g.deleteTexture(t.tex); g.deleteFramebuffer(t.fbo); if (t.rb) g.deleteRenderbuffer(t.rb); }
    this.targets = [];
    this.canvas.width = w; this.canvas.height = h;
    this.w = w; this.h = h;
    this.targets = [
      this.target(w, h, true),
      this.target(w, h),
      this.target(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4))),
      this.target(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(h / 4)))
    ];
    g.deleteTexture(this.feedbackTex);
    g.deleteFramebuffer(this.feedbackFbo.fbo);
    this.feedbackFbo = this.createFbo(w, h, true);
    this.feedbackTex = this.feedbackFbo.tex;
    g.bindFramebuffer(g.FRAMEBUFFER, this.feedbackFbo.fbo);
    g.clearColor(0, 0, 0, 1);
    g.clear(g.COLOR_BUFFER_BIT);
    if (g.drawingBufferWidth !== w || g.drawingBufferHeight !== h) throw Error('The browser did not provide the requested full-resolution canvas. Export was stopped.');
    g.bindFramebuffer(g.FRAMEBUFFER, null);
  }
  buildMesh(lines, detail) {
    const g = this.gl, nx = Math.round(detail), ny = Math.round(lines * 2);
    if (this.meshKey === `${nx}:${ny}`) return;
    this.meshKey = `${nx}:${ny}`;
    const a = new Float32Array((nx + 1) * (ny + 1) * 2);
    let n = 0;
    for (let y = 0; y <= ny; y++) for (let x = 0; x <= nx; x++) { a[n++] = x / nx; a[n++] = y / ny; }
    const idx = new Uint32Array(nx * ny * 6);
    n = 0;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const p = y * (nx + 1) + x;
      idx.set([p, p + 1, p + nx + 1, p + 1, p + nx + 2, p + nx + 1], n);
      n += 6;
    }
    g.bindVertexArray(this.meshVAO);
    g.bindBuffer(g.ARRAY_BUFFER, this.vertexBuffer);
    g.bufferData(g.ARRAY_BUFFER, a, g.STATIC_DRAW);
    g.enableVertexAttribArray(0);
    g.vertexAttribPointer(0, 2, g.FLOAT, false, 0, 0);
    g.bindBuffer(g.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    g.bufferData(g.ELEMENT_ARRAY_BUFFER, idx, g.STATIC_DRAW);
    this.indexCount = idx.length;
    g.bindVertexArray(null);
  }
  setSource(source, w, h) {
    if (w > this.maxSize || h > this.maxSize) throw Error(`The source is ${w} \u00d7 ${h}; this GPU supports textures up to ${this.maxSize}px. No silent downscaling is applied.`);
    this.source = source;
    this.sourceWidth = w || 3840;
    this.sourceHeight = h || 2160;
    this.sourceAspect = this.sourceWidth / this.sourceHeight;
    this.dirtySource = true;
  }
  upload(source = this.source) {
    if (!source) return;
    const g = this.gl;
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.sourceTex);
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, true);
    const w = source.videoWidth || source.naturalWidth || source.width;
    const h = source.videoHeight || source.naturalHeight || source.height;
    if (this.texWidth === w && this.texHeight === h) {
      g.texSubImage2D(g.TEXTURE_2D, 0, 0, 0, g.RGBA, g.UNSIGNED_BYTE, source);
    } else {
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA8, g.RGBA, g.UNSIGNED_BYTE, source);
      this.texWidth = w; this.texHeight = h;
    }
    g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
    this.dirtySource = false;
  }
  use(program, values = {}) {
    const g = this.gl;
    g.useProgram(program.p);
    for (const [k, v] of Object.entries(values)) {
      const loc = program.uniforms[k];
      if (loc == null) continue;
      if (typeof v === 'boolean') g.uniform1i(loc, v ? 1 : 0);
      else if (typeof v === 'number') g.uniform1f(loc, v);
      else if (v.length === 16) g.uniformMatrix4fv(loc, false, v);
      else if (v.length === 3) g.uniform3fv(loc, v);
      else g.uniform2fv(loc, v);
    }
    return program;
  }
  bind(program, key, texture, slot) {
    const g = this.gl;
    g.activeTexture(g.TEXTURE0 + slot);
    g.bindTexture(g.TEXTURE_2D, texture);
    if (program.uniforms[key] != null) g.uniform1i(program.uniforms[key], slot);
  }
  pass(target) {
    const g = this.gl;
    g.bindFramebuffer(g.FRAMEBUFFER, target?.fbo || null);
    g.viewport(0, 0, target?.w || this.w, target?.h || this.h);
  }
  quad() {
    const g = this.gl;
    g.bindVertexArray(this.emptyVAO);
    g.drawArrays(g.TRIANGLES, 0, 3);
  }
  render(time, p, bands = { bass: 0, loudness: 0, transient: 0, highs: 0 }, sourceOverride = null) {
    if (this.lost || this.gl.isContextLost()) throw Error('The graphics context was lost. Reduce mesh detail or close GPU-heavy apps, then reload.');
    const g = this.gl;
    if (sourceOverride) this.upload(sourceOverride);
    else if (this.source && (this.dirtySource || (this.source instanceof HTMLVideoElement && this.source.readyState >= 2))) this.upload();
    this.buildMesh(p.lines, p.detail);
    const music = p.musicEnabled ? p.musicStrength : 0;
    const bass = bands.bass || 0, level = bands.loudness || 0, hi = bands.highs || 0, pulse = (bands.transient || 0) ** 2 * Math.sqrt(level);
    const phase = time * 2 * Math.PI / Math.max(p.cycle, 1);
    const power = p.cameraEnabled ? p.cameraStrength : 0;
    const locked = p.zeroframe > 0.5;
    const orbit = !locked && (p.cameraPreset === 0 || p.cameraPreset === 3);
    const push = !locked && (p.cameraPreset === 1 || p.cameraPreset === 3);
    const drift = !locked ? (p.cameraPreset === 2 ? 1 : p.cameraPreset === 3 ? .35 : 0) : 0;
    const az = rad(p.azimuth + power * (orbit ? p.orbit : 0) * Math.sin(phase));
    const el = rad(Math.max(-75, Math.min(75, p.elevation + power * drift * 2 * Math.sin(phase * 2))));
    const distance = Math.max(2, p.distance - power * (push ? p.push : 0) * (.5 - .5 * Math.cos(phase)) - (locked ? 0 : power * music * p.cameraPulse * pulse));
    const target = locked ? [0, 0, 0] : [power * drift * .06 * Math.sin(phase), .05 + power * drift * .036 * Math.sin(phase * 2), 0];
    const eye = [target[0] + distance * Math.sin(az) * Math.cos(el), target[1] + distance * Math.sin(el), distance * Math.cos(az) * Math.cos(el)];
    const view = lookAt(eye, target), projection = perspective(2 * Math.atan(12 / (60 * p.zoom)), this.w / this.h);
    const common = { uDemo: !this.source, uSourceSize: [this.sourceWidth, this.sourceHeight] };
    this.pass(this.targets[0]);
    g.clearColor(0, 0, 0, 1);
    g.clear(g.COLOR_BUFFER_BIT | g.DEPTH_BUFFER_BIT);
    g.disable(g.CULL_FACE);
    const renderMode = p.renderMode || 0;
    if (p.xray) { g.disable(g.DEPTH_TEST); g.enable(g.BLEND); g.blendFunc(g.SRC_ALPHA, g.ONE); }
    else { g.enable(g.DEPTH_TEST); g.depthFunc(g.LEQUAL); g.disable(g.BLEND); }
    this.use(this.meshProgram, { ...common, uView: view, uProjection: projection, uSourceAspect: this.sourceAspect, uHeight: p.height * (1 + music * p.bassAmount * bass ** 1.4), uSmooth: p.smooth, uTilt: rad(p.tilt), uTurn: rad(p.turn), uPanY: p.panY, uPanX: 0, uLines: p.lines, uThickness: p.thickness, uBrightness: p.brightness * (1 + music * .25 * level ** 1.5), uSourceColour: p.sourceColour, uBlackPoint: p.blackPoint, uColour: p.colour, uXray: p.xray, uRenderMode: renderMode, uDisplacement: p.displacement, uSmoothness: p.smoothness });
    this.bind(this.meshProgram, 'uSource', this.sourceTex, 0);
    g.bindVertexArray(this.meshVAO);
    const drawMode = renderMode >= 2 ? g.POINTS : g.TRIANGLES;
    g.drawElements(drawMode, this.indexCount, g.UNSIGNED_INT, 0);
    g.disable(g.DEPTH_TEST);
    g.disable(g.BLEND);
    this.pass(this.targets[1]);
    this.use(this.warpProgram, { uTime: time * p.signalSpeed, uWarp: Math.min(1, p.warp + music * .065 * (.65 * hi ** 1.35 + .35 * pulse)), uJitter: .035 + music * .01625 * hi, uTears: .025 + music * .0195 * pulse, uChromatic: p.chromatic * (1 + music * 0.9 * bass), uGlitch: music * 0.9 * (pulse + bass), uColorDrift: p.colorDrift * (1 + music * 0.5 * level), uDither: p.dither, uSlitScan: p.slitScan, uPosterize: p.posterize, uSize: [this.w, this.h] });
    this.bind(this.warpProgram, 'uImage', this.targets[0].tex, 0);
    this.quad();
    // feedback: blend current warp output into previous feedback frame
    // Render to targets[0] (not feedbackFbo) to avoid a WebGL feedback loop:
    // cannot read from and write to the same texture in one draw call.
    this.pass(this.targets[0]);
    this.use(this.copyProgram, { uMix: p.feedback });
    this.bind(this.copyProgram, 'uImage', this.targets[1].tex, 0);
    g.activeTexture(g.TEXTURE0 + 1);
    g.bindTexture(g.TEXTURE_2D, this.feedbackTex);
    g.uniform1i(this.copyProgram.uniforms['uFeedback'], 1);
    this.quad();
    // Copy the mixed result into feedbackTex for the blur/finish passes.
    // copyTexSubImage2D writes to the texture bound at TEXTURE0, so bind
    // feedbackTex there (it was at TEXTURE0 + 1 for the shader uniform).
    g.bindFramebuffer(g.FRAMEBUFFER, this.targets[0].fbo);
    g.activeTexture(g.TEXTURE0);
    g.bindTexture(g.TEXTURE_2D, this.feedbackTex);
    g.copyTexSubImage2D(g.TEXTURE_2D, 0, 0, 0, 0, 0, this.w, this.h);
    g.bindFramebuffer(g.FRAMEBUFFER, null);
    // glow blur chain (reads from echoed frame)
    this.pass(this.targets[2]);
    this.use(this.blurProgram, { uDirection: [(p.glowRadius * 1.6 + 1) / 1920, 0] });
    this.bind(this.blurProgram, 'uImage', this.feedbackTex, 0);
    this.quad();
    this.pass(this.targets[3]);
    this.use(this.blurProgram, { uDirection: [0, (p.glowRadius * 1.6 + 1) / 1080] });
    this.bind(this.blurProgram, 'uImage', this.targets[2].tex, 0);
    this.quad();
    // finish reads from feedback buffer (which now holds the echoed frame)
    this.pass(null);
    this.use(this.finishProgram, { ...common, uTime: time * p.signalSpeed, uGlowAmount: Math.min(1.5, p.glow + music * p.pulseAmount * (.85 * pulse + .15 * bass)), uStreaks: Math.min(1, p.streaks + music * .16 * (.75 * pulse + .25 * hi ** 1.3)), uGrain: p.grain, uScanlines: p.scanlines, uMix: p.mix, uSourceAspect: this.sourceAspect, uOutputAspect: this.w / this.h, uFeedbackAmt: p.feedback, uClarity: p.clarity, uEdge: p.edge, uVignette: p.vignette, uContrast: p.contrast });
    this.bind(this.finishProgram, 'uImage', this.feedbackTex, 0);
    this.bind(this.finishProgram, 'uGlow', this.targets[3].tex, 1);
    this.bind(this.finishProgram, 'uFeedback', this.feedbackTex, 2);
    this.bind(this.finishProgram, 'uSource', this.sourceTex, 3);
    this.quad();
    g.flush();
    return { distance, pulse };
  }
}
