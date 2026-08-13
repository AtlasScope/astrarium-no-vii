
window.addEventListener("error", (e) => {
  const el = document.getElementById("err");
  if (!el) return;
  el.style.display = "block";
  el.textContent = String((e && e.message) || e);
});
const VERT = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

const FRAG = `#version 300 es
precision highp float;
out vec4 fragColor;
uniform vec2 uRes;
uniform float uTime;
uniform float uAge;
uniform float uWind;
uniform float uDive;
uniform vec3 uCam;
uniform float uNote;
uniform float uQuality;

mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p){
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float noise(vec3 x){
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x),
                 mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x),
                 mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){
  float a=0.5, s=0.0;
  for(int i=0;i<3;i++){ s+=a*noise(p); p*=2.03; a*=0.5; }
  return s;
}
float sdBox(vec3 p, vec3 b){
  vec3 q = abs(p)-b;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}
float sdTorus(vec3 p, vec2 t){
  vec2 q = vec2(length(p.xz)-t.x, p.y);
  return length(q)-t.y;
}
float sdOcta(vec3 p, float s){
  p = abs(p);
  return (p.x+p.y+p.z-s)*0.57735;
}
float gyroid(vec3 p){
  return abs(dot(sin(p), cos(p.yzx)));
}

vec2 vmin(vec2 a, vec2 b){ return a.x<b.x?a:b; }

vec2 map(vec3 p){
  float age = uAge;
  float wind = uWind;
  float t = uTime;

  vec3 op = p;
  p.yz = p.yz * rot(0.10 + 0.06*sin(t*0.17));
  p.xz = p.xz * rot(t*0.13 + age*0.5);
  p.xy = p.xy * rot(0.18*sin(t*0.09));

  float grow = mix(0.42, 1.0, smoothstep(0.0, 0.36, age));
  float dusk = smoothstep(0.78, 1.0, age);
  float cityA = smoothstep(0.38, 0.66, age) * (1.0-dusk);

  float coreR = mix(0.38, 0.58, grow);
  coreR = mix(coreR, 0.22, dusk);
  float pulse = 1.0 + 0.05*sin(t*2.2)*wind + 0.10*uNote;
  float dCore = length(p) - coreR*pulse;
  vec2 res = vec2(dCore, 1.0);

  if(age > 0.86){
    float hole = length(p) - mix(0.0, 0.32, smoothstep(0.86, 0.98, age));
    res = vmin(res, vec2(max(0.24 - length(p), hole), 7.0));
  }

  float g = gyroid(p*3.4 + t*0.16) - 0.88;
  float shell = abs(length(p) - mix(0.95, 1.18, grow)) - 0.018;
  float dG = max(shell, g * 0.28);
  res = vmin(res, vec2(dG, 2.0));

  vec3 q = p;
  float an = 6.2831853/6.0;
  float sector = floor(0.5 + atan(q.z, q.x)/an)*an;
  q.xz = q.xz * rot(-sector);
  q.x -= mix(1.15, 1.48, grow);
  q.xy = q.xy * rot(-0.48);
  vec3 wsize = vec3(mix(0.95, 1.25, grow), 0.022, mix(0.22, 0.42, grow));
  float dWing = sdBox(q, wsize);
  dWing -= 0.008*sin(q.x*10.0)*sin(q.z*8.0);
  res = vmin(res, vec2(dWing, 3.0));

  if(cityA > 0.02 && uQuality > 0.4){
    float hgt = cityA * mix(0.03, 0.11, wind) * (0.3 + hash12(floor(q.xz*10.0)));
    vec3 c = q;
    c.x = mod(c.x + 8.0, 0.16) - 0.08;
    c.z = mod(c.z + 8.0, 0.14) - 0.07;
    float dCity = sdBox(c - vec3(0.0, wsize.y + hgt, 0.0), vec3(0.02, hgt, 0.016));
    dCity = max(dCity, sdBox(q, wsize + vec3(0.02, 0.18, 0.02)));
    res = vmin(res, vec2(dCity, 4.0));
  }

  float ringG = smoothstep(0.48, 0.7, age);
  float dR1 = sdTorus(p.xzy, vec2(mix(1.7, 2.15, grow), 0.018));
  vec3 p2 = p; p2.xy = p2.xy * rot(0.85);
  float dR2 = sdTorus(p2, vec2(2.35, 0.01));
  res = vmin(res, vec2(mix(3.0, dR1, ringG), 5.0));
  res = vmin(res, vec2(mix(3.0, dR2, ringG), 5.0));

  vec3 moonP = vec3(sin(t*0.37)*2.45, 0.4+0.12*sin(t*0.2), cos(t*0.37)*2.45);
  float dMoon = length(op - moonP) - mix(0.04, 0.2, smoothstep(0.12, 0.4, age));
  res = vmin(res, vec2(dMoon, 6.0));

  float dHalo = sdTorus(p, vec2(mix(0.72, 0.98, grow), 0.016));
  res = vmin(res, vec2(dHalo, 5.0));

  float dOct = abs(sdOcta(p, 0.7*pulse) - 0.02) - 0.008;
  dOct = mix(3.0, dOct, grow*(1.0-dusk*0.65));
  res = vmin(res, vec2(dOct, 2.0));

  return res;
}

vec3 normal(vec3 p){
  float e = 0.0018;
  vec2 h = vec2(e, 0.0);
  return normalize(vec3(
    map(p+h.xyy).x - map(p-h.xyy).x,
    map(p+h.yxy).x - map(p-h.yxy).x,
    map(p+h.yyx).x - map(p-h.yyx).x
  ));
}

float shadow(vec3 ro, vec3 rd){
  float t=0.03, res=1.0;
  for(int i=0;i<10;i++){
    float h = map(ro+rd*t).x;
    res = min(res, 10.0*h/t);
    t += clamp(h, 0.03, 0.3);
    if(res<0.03 || t>6.0) break;
  }
  return clamp(res, 0.0, 1.0);
}

float ao(vec3 p, vec3 n){
  float occ=0.0, sca=1.0;
  for(int i=0;i<3;i++){
    float h = 0.02 + 0.11*float(i);
    occ += (h - map(p+n*h).x)*sca;
    sca *= 0.8;
  }
  return clamp(1.0 - 1.8*occ, 0.0, 1.0);
}

vec3 sky(vec3 rd){
  float n = fbm(rd*2.4 + vec3(0.0, uTime*0.02, 0.0));
  vec3 col = vec3(0.03, 0.02, 0.055);
  col += vec3(0.28, 0.07, 0.04) * pow(n, 1.8);
  col += vec3(0.05, 0.07, 0.16) * n * n;
  float stars = pow(hash12(rd.xy*280.0 + floor(rd.z*12.0)), 42.0);
  stars += 0.55*pow(hash12(rd.yx*640.0), 80.0);
  col += stars * mix(vec3(1.0,0.9,0.75), vec3(0.7,0.85,1.0), hash12(rd.yz*30.0));
  return col;
}

void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5*uRes) / max(uRes.y, 1.0);
  float t = uTime;
  float age = uAge;

  float yaw = uCam.x;
  float pitch = uCam.y;
  float dist = uCam.z;
  vec3 ta = vec3(0.0, 0.02, 0.0);
  vec3 ro = ta + vec3(
    dist * cos(pitch) * sin(yaw),
    dist * sin(pitch),
    dist * cos(pitch) * cos(yaw)
  );
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));
  vec3 vv = cross(uu, ww);
  float fov = mix(1.02, 1.28, uDive);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + fov*ww);

  vec3 hot = mix(vec3(1.0,0.48,0.12), vec3(0.35,0.55,1.0), smoothstep(0.8,1.0,age));
  float distRay = length(cross(rd, -ro));
  vec3 col = sky(rd);
  col += hot * 0.55 / (0.12 + distRay*distRay) * (0.45 + 0.8*uWind + 1.2*uNote);

  float maxd = 14.0;
  float z = 0.0;
  vec2 hit = vec2(maxd, 0.0);
  float glow = 0.0;
  int STEPS = 28;
  if(uQuality > 0.4) STEPS = 40;
  if(uQuality > 0.65) STEPS = 56;
  for(int i=0;i<56;i++){
    if(i>=STEPS) break;
    vec3 pos = ro + rd * z;
    vec2 h = map(pos);
    glow += exp(-abs(h.x)*10.0) * 0.07;
    if(h.x < 0.002){ hit = vec2(z, h.y); break; }
    z += h.x;
    if(z > maxd) break;
  }

  if(hit.x < maxd){
    vec3 p = ro + rd * hit.x;
    vec3 n = normal(p);
    vec3 albedo = vec3(0.2);
    vec3 emis = vec3(0.0);
    float metal = 0.3;
    float dusk = smoothstep(0.78, 1.0, age);
    float m = hit.y;

    if(m < 1.5){
      vec3 fire = mix(vec3(1.0,0.4,0.08), vec3(1.0,0.95,0.72), 0.5+0.5*sin(t*2.4 + p.y*8.0));
      emis = mix(fire, vec3(0.4,0.6,1.0), dusk) * (4.8 + 5.0*uNote + 1.8*uWind);
      albedo = fire*0.2; metal = 0.0;
    } else if(m < 2.5){
      float ir = fbm(p*2.8);
      albedo = mix(vec3(0.14,0.08,0.05), vec3(0.75,0.5,0.22), ir);
      albedo += vec3(0.25,0.4,0.45)*pow(ir,3.0);
      metal = 0.9;
      emis = vec3(0.55,0.18,0.05)*0.4*(1.0-dusk);
    } else if(m < 3.5){
      albedo = mix(vec3(0.32,0.18,0.06), vec3(1.0,0.82,0.48), 0.4+0.6*n.y);
      metal = 0.96;
      emis = vec3(0.5,0.2,0.05)*0.2*uWind;
    } else if(m < 4.5){
      albedo = vec3(0.06);
      float win = step(0.55, hash13(floor(p*40.0)));
      float alive = step(hash13(floor(p*11.0)), 1.0-dusk*0.92);
      emis = vec3(1.0,0.72,0.3)*win*alive*3.6;
      metal = 0.2;
    } else if(m < 5.5){
      albedo = vec3(0.85,0.65,0.32); metal = 1.0;
      emis = vec3(1.0,0.55,0.18)*0.7*smoothstep(0.45,0.8,age);
    } else if(m < 6.5){
      albedo = vec3(0.62,0.6,0.54);
      float ang = atan(n.y, n.x);
      float hand = smoothstep(0.08,0.0, abs(sin(ang - t*0.8)));
      emis = vec3(1.0,0.82,0.45)*hand*1.6;
      metal = 0.55;
    } else {
      albedo = vec3(0.0); metal=0.0;
    }

    float sh = uQuality > 0.55 ? shadow(p+n*0.025, normalize(-p)) : 0.7;
    float occ = ao(p, n);
    vec3 l1 = normalize(-p + vec3(0.0,0.25,0.0));
    float ndl = clamp(dot(n, l1), 0.0, 1.0);
    vec3 hlf = normalize(l1 - rd);
    float spec = pow(clamp(dot(n, hlf), 0.0, 1.0), mix(10.0, 40.0, metal));
    float fre = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.6);
    vec3 light = vec3(1.0,0.75,0.42) * (0.45 + 1.5*ndl) * sh;
    light += vec3(0.18,0.12,0.1) * occ;
    col = albedo * light * occ;
    col += spec * mix(vec3(1.0), albedo, metal) * sh * (0.3+0.7*metal);
    col += sky(reflect(rd, n)) * fre * metal * 0.6;
    col += emis;
  }

  col += hot * glow * (0.9 + 1.8*uWind + 2.2*uNote);
  col += vec3(1.0,0.85,0.55) * glow * glow * 0.45;

  float r = length(uv);
  col *= 1.0 - r*r*mix(0.22, 0.08, uDive);
  col = col / (0.85 + col);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.9));
  col += (hash12(frag + fract(t*17.0)) - 0.5) * 0.035;
  fragColor = vec4(col, 1.0);
}`;

const LITE_BODY = `
uniform vec2 uRes;
uniform float uTime;
uniform float uAge;
uniform float uWind;
uniform float uDive;
uniform vec3 uCam;
uniform float uNote;
uniform float uQuality;
mat2 rot(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float sdBox(vec3 p, vec3 b){
  vec3 q = abs(p)-b;
  return length(max(q,0.0))+min(max(q.x,max(q.y,q.z)),0.0);
}
float sdTorus(vec3 p, vec2 t){
  vec2 q = vec2(length(p.xz)-t.x, p.y);
  return length(q)-t.y;
}
float gyroid(vec3 p){ return abs(dot(sin(p), cos(p.yzx))); }
vec2 vmin(vec2 a, vec2 b){ return a.x<b.x?a:b; }
vec2 map(vec3 p){
  float age = uAge;
  float t = uTime;
  vec3 op = p;
  p.yz = p.yz * rot(0.10 + 0.06*sin(t*0.17));
  p.xz = p.xz * rot(t*0.13 + age*0.5);
  p.xy = p.xy * rot(0.18*sin(t*0.09));
  float grow = mix(0.42, 1.0, smoothstep(0.0, 0.36, age));
  float dusk = smoothstep(0.78, 1.0, age);
  float coreR = mix(0.38, 0.58, grow);
  coreR = mix(coreR, 0.22, dusk);
  float pulse = 1.0 + 0.05*sin(t*2.2)*uWind + 0.10*uNote;
  vec2 res = vec2(length(p) - coreR*pulse, 1.0);
  float g = gyroid(p*3.4 + t*0.16) - 0.88;
  float shell = abs(length(p) - mix(0.95, 1.18, grow)) - 0.018;
  res = vmin(res, vec2(max(shell, g * 0.28), 2.0));
  vec3 q = p;
  float an = 6.2831853/6.0;
  float sector = floor(0.5 + atan(q.z, q.x)/an)*an;
  q.xz = q.xz * rot(-sector);
  q.x -= mix(1.15, 1.48, grow);
  q.xy = q.xy * rot(-0.48);
  vec3 wsize = vec3(mix(0.95, 1.25, grow), 0.022, mix(0.22, 0.42, grow));
  float dWing = sdBox(q, wsize) - 0.008*sin(q.x*10.0)*sin(q.z*8.0);
  res = vmin(res, vec2(dWing, 3.0));
  float ringG = smoothstep(0.48, 0.7, age);
  res = vmin(res, vec2(mix(3.0, sdTorus(p.xzy, vec2(mix(1.7, 2.15, grow), 0.018)), ringG), 5.0));
  res = vmin(res, vec2(sdTorus(p, vec2(mix(0.72, 0.98, grow), 0.016)), 5.0));
  vec3 moonP = vec3(sin(t*0.37)*2.45, 0.4+0.12*sin(t*0.2), cos(t*0.37)*2.45);
  res = vmin(res, vec2(length(op - moonP) - mix(0.04, 0.2, smoothstep(0.12, 0.4, age)), 6.0));
  return res;
}
vec3 normal(vec3 p){
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(
    map(p+e.xyy).x - map(p-e.xyy).x,
    map(p+e.yxy).x - map(p-e.yxy).x,
    map(p+e.yyx).x - map(p-e.yyx).x
  ));
}
vec3 sky(vec3 rd){
  vec3 col = vec3(0.03, 0.02, 0.055);
  float stars = pow(hash12(rd.xy*280.0), 42.0);
  stars += 0.55*pow(hash12(rd.yx*640.0), 80.0);
  col += stars * vec3(1.0, 0.9, 0.78);
  return col;
}
void main(){
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5*uRes) / max(uRes.y, 1.0);
  float t = uTime;
  float age = uAge;
  float yaw = uCam.x;
  float pitch = uCam.y;
  float dist = uCam.z;
  vec3 ta = vec3(0.0, 0.02, 0.0);
  vec3 ro = ta + vec3(dist*cos(pitch)*sin(yaw), dist*sin(pitch), dist*cos(pitch)*cos(yaw));
  vec3 ww = normalize(ta - ro);
  vec3 uu = normalize(cross(ww, vec3(0.0,1.0,0.0)));
  vec3 vv = cross(uu, ww);
  vec3 rd = normalize(uv.x*uu + uv.y*vv + mix(1.02, 1.28, uDive)*ww);
  vec3 hot = mix(vec3(1.0,0.48,0.12), vec3(0.35,0.55,1.0), smoothstep(0.8,1.0,age));
  float distRay = length(cross(rd, -ro));
  vec3 col = sky(rd);
  col += hot * 0.55 / (0.12 + distRay*distRay) * (0.45 + 0.8*uWind + 1.2*uNote);
  float z = 0.0;
  vec2 hit = vec2(14.0, 0.0);
  float glow = 0.0;
  for(int i=0;i<28;i++){
    vec2 h = map(ro + rd * z);
    glow += exp(-abs(h.x)*10.0) * 0.08;
    if(h.x < 0.0025){ hit = vec2(z, h.y); break; }
    z += h.x;
    if(z > 14.0) break;
  }
  if(hit.x < 14.0){
    vec3 p = ro + rd * hit.x;
    vec3 n = normal(p);
    vec3 albedo = vec3(0.25);
    vec3 emis = vec3(0.0);
    float metal = 0.4;
    float dusk = smoothstep(0.78, 1.0, age);
    float m = hit.y;
    if(m < 1.5){
      vec3 fire = mix(vec3(1.0,0.4,0.08), vec3(1.0,0.95,0.72), 0.5+0.5*sin(t*2.4 + p.y*8.0));
      emis = mix(fire, vec3(0.4,0.6,1.0), dusk) * (4.8 + 5.0*uNote + 1.8*uWind);
      albedo = fire*0.2; metal = 0.0;
    } else if(m < 2.5){
      float ir = 0.5 + 0.5*sin(p.x*3.0+p.y*2.0);
      albedo = mix(vec3(0.14,0.08,0.05), vec3(0.75,0.5,0.22), ir);
      metal = 0.9;
      emis = vec3(0.55,0.18,0.05)*0.4*(1.0-dusk);
    } else if(m < 3.5){
      albedo = mix(vec3(0.32,0.18,0.06), vec3(1.0,0.82,0.48), 0.4+0.6*n.y);
      metal = 0.96;
    } else if(m < 5.5){
      albedo = vec3(0.85,0.65,0.32); metal = 1.0;
      emis = vec3(1.0,0.55,0.18)*0.7*smoothstep(0.45,0.8,age);
    } else {
      albedo = vec3(0.62,0.6,0.54);
      emis = vec3(1.0,0.82,0.45)*0.4;
      metal = 0.55;
    }
    vec3 l1 = normalize(-p + vec3(0.0,0.25,0.0));
    float ndl = clamp(dot(n, l1), 0.0, 1.0);
    float spec = pow(clamp(dot(n, normalize(l1 - rd)), 0.0, 1.0), mix(10.0, 32.0, metal));
    float fre = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 2.6);
    col = albedo * vec3(1.0,0.75,0.42) * (0.45 + 1.5*ndl);
    col += spec * mix(vec3(1.0), albedo, metal) * (0.3+0.7*metal);
    col += vec3(0.2,0.15,0.1) * fre * metal;
    col += emis;
  }
  col += hot * glow * (0.9 + 1.8*uWind + 2.2*uNote);
  col += vec3(1.0,0.85,0.55) * glow * glow * 0.45;
  float r = length(uv);
  col *= 1.0 - r*r*mix(0.22, 0.08, uDive);
  col = col / (0.85 + col);
  col = pow(clamp(col, 0.0, 1.0), vec3(0.9));
  fragColor = vec4(col, 1.0);
}
`;

const EPOCHS = [
  [0.00, "THE UNWINDING DARK"],
  [0.08, "FIRST SPARK"],
  [0.18, "THE MOLTEN PSALM"],
  [0.32, "WINGS REMEMBER GOLD"],
  [0.48, "THE CITY LITURGIES"],
  [0.62, "ORBITAL COVENANT"],
  [0.76, "THE LONG DIMMING"],
  [0.90, "SILENCE OF THE SPRING"]
];

const MYTHS = [
  [0.00, "A god sleeps in the spring."],
  [0.10, "Heat learns its own name."],
  [0.22, "Six wings unfold from a vow of metal."],
  [0.36, "Pilgrims of light take census on the inner vane."],
  [0.50, "They built cathedrals that photosynthesize gold."],
  [0.58, "A treaty is signed in orbit. The moon keeps time."],
  [0.70, "The cities begin to forget their windows."],
  [0.80, "One nation of light remains, singing to a cooling core."],
  [0.90, "The key remembers more than the world does."],
  [0.97, "Silence. The glass holds the shape of a prayer."]
];

function gearSVG(teeth, r0, r1, hole, cx, cy, fill) {
  const step = Math.PI / teeth;
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = i * step - step * 0.5;
    const r = i % 2 === 0 ? r0 : r1;
    const cmd = i === 0 ? "M" : "L";
    d += `${cmd}${cx + Math.cos(a) * r},${cy + Math.sin(a) * r} `;
  }
  d += "Z";
  return `<g fill="${fill}" stroke="#2a1c0c" stroke-width="0.6">
    <path d="${d}"/>
    <circle cx="${cx}" cy="${cy}" r="${hole}" fill="#1a140c" stroke="#c9a36a" stroke-width="1.2"/>
    <circle cx="${cx}" cy="${cy}" r="${hole * 0.35}" fill="#c9a36a"/>
  </g>`;
}

document.getElementById("gears").innerHTML = `<svg viewBox="0 0 100 100" width="100%" height="100%">
  ${gearSVG(10, 28, 22, 6, 38, 42, "#b8924e")}
  ${gearSVG(7, 18, 13, 4, 70, 62, "#8a6a38")}
</svg>`;

const errEl = document.getElementById("err");
function showErr(s) {
  errEl.style.display = "block";
  errEl.textContent = s;
}

const phone = /Mobi|Android|iPhone|iPod|iPad|webOS|IEMobile|Opera Mini/i.test(navigator.userAgent)
  || (navigator.maxTouchPoints > 1 && /MacIntel/.test(navigator.platform))
  || window.matchMedia("(pointer: coarse)").matches
  || window.innerWidth < 720;
const coarse = window.matchMedia("(pointer: coarse)").matches || phone;
if (phone) document.documentElement.classList.add("phone");
if (coarse) document.documentElement.classList.add("coarse");

const VERT1 = `attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos,0.0,1.0); }`;

function wrapLite(webgl2) {
  if (webgl2) return `#version 300 es\nprecision highp float;\nout vec4 fragColor;\n` + LITE_BODY;
  return `precision highp float;\n` + LITE_BODY.replace(/\bfragColor\b/g, "gl_FragColor");
}

function compileProgram(gl, vsSrc, fsSrc) {
  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(vs) || "vertex");
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(fs) || "fragment");
  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) || "link");
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  if (loc >= 0) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  }
  const U = {};
  for (const name of ["uRes","uTime","uAge","uWind","uDive","uCam","uNote","uQuality"]) {
    U[name] = gl.getUniformLocation(prog, name);
  }
  return { gl, prog, U, info: gl.getParameter(gl.RENDERER) || "" };
}

function makeGL(canvas, lite) {
  const opts = {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    preserveDrawingBuffer: false,
    powerPreference: lite ? "low-power" : "default",
    failIfMajorPerformanceCaveat: false
  };
  let gl = canvas.getContext("webgl2", opts);
  let webgl2 = !!gl;
  if (!gl) gl = canvas.getContext("webgl", opts) || canvas.getContext("experimental-webgl", opts);
  if (!gl) throw new Error("This browser cannot draw the glass. Try Chrome or Safari.");
  const wantLite = lite || !webgl2;
  const vs = webgl2 ? VERT : VERT1;
  try {
    const compiled = compileProgram(gl, vs, wantLite ? wrapLite(webgl2) : FRAG);
    compiled.lite = wantLite;
    compiled.webgl2 = webgl2;
    return compiled;
  } catch (e) {
    if (!wantLite && webgl2) {
      const compiled = compileProgram(gl, VERT, wrapLite(true));
      compiled.lite = true;
      compiled.webgl2 = true;
      return compiled;
    }
    const med = wrapLite(webgl2).replace("precision highp float;", "precision mediump float;");
    const compiled = compileProgram(gl, vs, med);
    compiled.lite = true;
    compiled.webgl2 = webgl2;
    return compiled;
  }
}

const glassCanvas = document.getElementById("gl");
let renderer = null;

const params = new URLSearchParams(location.search);
const shot = params.has("shot");
const ageParam = parseFloat(params.get("age"));

const state = {
  wind: shot ? 1 : 0.35,
  age: Number.isFinite(ageParam) ? ageParam : (shot ? 0.54 : 0.22),
  dive: 0,
  targetDive: 0,
  yaw: 0.85,
  pitch: 0.18,
  dist: 5.85,
  note: 0,
  t0: performance.now(),
  quality: phone ? 0.36 : 0.8,
  pixelCap: phone ? 480 : 1800,
  soft: false,
  phone,
  fps: 60,
  cinema: false,
  cinemaT: 0,
  keyRot: 0,
  holdWind: false,
  myth: MYTHS[0][1],
  epoch: EPOCHS[0][1],
  audio: null,
  started: false,
  shown: false,
  looping: false
};

function bootGL() {
  if (renderer) return renderer;
  try {
    renderer = makeGL(glassCanvas, phone);
  } catch (e) {
    showErr(String(e.message || e));
    return null;
  }
  if (renderer && /swiftshader|llvmpipe|softpipe|microsoft basic render/i.test(renderer.info)) {
    state.soft = true;
    state.quality = 0.32;
    state.pixelCap = Math.min(state.pixelCap, 420);
  }
  if (renderer && renderer.lite) {
    state.quality = Math.min(state.quality, 0.45);
    state.pixelCap = Math.min(state.pixelCap, phone ? 480 : 900);
  }
  return renderer;
}

glassCanvas.addEventListener("webglcontextlost", (e) => {
  e.preventDefault();
  renderer = null;
});
glassCanvas.addEventListener("webglcontextrestored", () => {
  try { renderer = makeGL(glassCanvas, true); }
  catch (err) { showErr(String(err.message || err)); }
});

function lerp(a,b,t){ return a + (b-a)*t; }

class BoxSong {
  constructor() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0;
    this.master.connect(this.ctx.destination);
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 1800;
    this.filter.Q.value = 0.7;
    this.filter.connect(this.master);
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.38;
    const fb = this.ctx.createGain(); fb.gain.value = 0.28;
    this.delay.connect(fb); fb.connect(this.delay); this.delay.connect(this.master);
    this.drone = this.makeDrone();
    this.next = 0;
    this.step = 0;
    this.scale = [0, 2, 4, 7, 9, 11, 12, 14];
    this.root = 76;
  }
  makeDrone() {
    const g = this.ctx.createGain();
    g.gain.value = 0.04;
    g.connect(this.filter);
    [55, 82.5, 110, 164.8].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = i < 2 ? "sine" : "triangle";
      o.frequency.value = f;
      const og = this.ctx.createGain();
      og.gain.value = 0.22 / (i+1);
      o.connect(og); og.connect(g);
      o.start();
    });
    return g;
  }
  pluck(freq, t, amp) {
    const o = this.ctx.createOscillator();
    const o2 = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = "sine"; o2.type = "sine";
    o.frequency.value = freq;
    o2.frequency.value = freq * 2.005;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    o.connect(g); o2.connect(g); g.connect(this.filter); g.connect(this.delay);
    o.start(t); o2.start(t);
    o.stop(t + 1.8); o2.stop(t + 1.8);
    const tick = this.ctx.createOscillator();
    const tg = this.ctx.createGain();
    tick.frequency.value = freq * 4;
    tick.type = "triangle";
    tg.gain.setValueAtTime(amp * 0.15, t);
    tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    tick.connect(tg); tg.connect(this.master);
    tick.start(t); tick.stop(t + 0.14);
  }
  setAge(age, wind) {
    this.master.gain.linearRampToValueAtTime(0.22 * (0.25 + wind), this.ctx.currentTime + 0.05);
    this.filter.frequency.linearRampToValueAtTime(700 + 2200 * (1-age) * wind + 400, this.ctx.currentTime + 0.1);
    this.drone.gain.value = 0.03 + 0.05 * wind * (1.0 - Math.max(0, age-0.8)*5);
  }
  tick(age, wind) {
    const now = this.ctx.currentTime;
    if (now < this.next) return 0;
    const tempo = 0.28 + (1.0 - age) * 0.18 * wind;
    this.next = now + tempo;
    if (wind < 0.05) return 0;
    const mut = age > 0.88 ? (Math.random() > 0.55 ? 0 : 1) : 1;
    const deg = this.scale[this.step % this.scale.length];
    const oct = this.step % 11 === 0 ? 12 : 0;
    const freq = 440 * Math.pow(2, (this.root + deg + oct - 69) / 12);
    const amp = (0.08 + 0.1 * wind) * mut * (age > 0.9 ? 0.3 : 1);
    this.pluck(freq, now, amp);
    if (this.step % 4 === 0) this.pluck(freq * 0.5, now + 0.02, amp * 0.5);
    this.step++;
    if (age > 0.82 && this.step % 5 === 0) this.scale.push(this.scale.shift());
    return 1;
  }
}

function pick(table, x) {
  let s = table[0][1];
  for (const [k, v] of table) if (x >= k) s = v;
  return s;
}

function resize() {
  if (!renderer) return;
  const target = renderer.gl.canvas;
  const dprCap = state.phone || state.soft ? 1.25 : 1.75;
  const dpr = Math.min(window.devicePixelRatio || 1, dprCap) * Math.max(0.28, state.quality);
  const vv = window.visualViewport;
  const viewW = (vv && state.dive > 0.5) ? vv.width : window.innerWidth;
  const viewH = (vv && state.dive > 0.5) ? vv.height : window.innerHeight;
  const w = state.targetDive > 0.5 ? viewW : (target.clientWidth || 512);
  const h = state.targetDive > 0.5 ? viewH : (target.clientHeight || 512);
  const cap = state.pixelCap;
  const scale = Math.min(1, cap / Math.max(w * dpr, h * dpr, 1));
  const W = Math.max(2, Math.floor(w * dpr * scale));
  const H = Math.max(2, Math.floor(h * dpr * scale));
  if (target.width !== W || target.height !== H) { target.width = W; target.height = H; }
}

function draw(now) {
  if (document.hidden) { state.looping = false; return; }
  state.looping = true;
  requestAnimationFrame(draw);
  if (!renderer) return;
  const dt = Math.min(0.05, (now - (draw.prev || now)) / 1000);
  draw.prev = now;

  if (dt > 0) {
    const fps = 1 / Math.max(dt, 0.0001);
    state.fps = lerp(state.fps, fps, 0.08);
    const qMin = state.phone || renderer.lite ? 0.2 : 0.4;
    const qMax = state.phone || renderer.lite ? 0.5 : 1;
    if (state.fps < 26) {
      state.quality = Math.max(qMin, state.quality - 0.02);
      if (state.phone) state.pixelCap = Math.max(280, state.pixelCap - 6);
    } else if (state.fps > 50) {
      state.quality = Math.min(qMax, state.quality + 0.004);
    }
  }

  if (state.holdWind) {
    state.wind = Math.min(1, state.wind + dt * 0.75);
    state.keyRot += dt * 3.4;
    state.cinema = false;
  }

  if (state.cinema) {
    state.cinemaT += dt;
    const ct = state.cinemaT;
    if (ct < 2.2) {
      state.wind = lerp(state.wind, 0.2, 0.02);
    } else if (ct < 11) {
      state.wind = Math.min(1, state.wind + dt * 0.22);
      state.keyRot += dt * 2.4;
    } else if (ct < 16 && !state.phone) {
      state.targetDive = 1;
      document.body.classList.add("dived");
    } else if (ct > 28) {
      state.cinema = false;
      state.targetDive = 0;
      document.body.classList.remove("dived");
    }
  }

  state.age += dt * (0.042 + state.wind * 0.095);
  if (state.age > 1) {
    state.age = 0.02;
    state.wind *= 0.35;
    if (state.audio) state.audio.step = 0;
  }
  state.wind = Math.max(0.05, state.wind - dt * 0.016);
  state.dive = lerp(state.dive, state.targetDive, 1 - Math.pow(0.001, dt));
  state.note *= Math.pow(0.12, dt);

  const targetDist = lerp(5.85, 2.35, state.dive);
  state.dist = lerp(state.dist, targetDist, 1 - Math.pow(0.02, dt));
  state.yaw += dt * (0.10 + state.wind * 0.06);
  state.pitch = lerp(0.18, 0.16 + 0.1 * Math.sin(now * 0.00025), state.dive);

  if (state.audio) {
    state.audio.setAge(state.age, state.wind);
    if (state.audio.tick(state.age, state.wind)) state.note = 1;
  }

  const g1 = document.querySelector("#gears svg g:nth-child(1)");
  const g2 = document.querySelector("#gears svg g:nth-child(2)");
  if (g1) g1.setAttribute("transform", `rotate(${state.keyRot * 42} 38 42)`);
  if (g2) g2.setAttribute("transform", `rotate(${-state.keyRot * 60} 70 62)`);
  document.getElementById("key").style.transform = `rotate(${state.keyRot * 57.3}deg)`;

  document.getElementById("tension").style.width = `${Math.round(state.wind * 100)}%`;
  const ep = pick(EPOCHS, state.age);
  const my = pick(MYTHS, state.age);
  if (ep !== state.epoch) { state.epoch = ep; document.getElementById("epoch").textContent = ep; }
  if (my !== state.myth) { state.myth = my; document.getElementById("myth").textContent = my; }

  resize();
  const { gl, prog, U } = renderer;
  gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  gl.useProgram(prog);
  gl.uniform2f(U.uRes, gl.canvas.width, gl.canvas.height);
  gl.uniform1f(U.uTime, (now - state.t0) * 0.001);
  gl.uniform1f(U.uAge, state.age);
  gl.uniform1f(U.uWind, state.wind);
  gl.uniform1f(U.uDive, state.dive);
  gl.uniform3f(U.uCam, state.yaw, state.pitch, state.dist);
  gl.uniform1f(U.uNote, state.note);
  gl.uniform1f(U.uQuality, state.quality);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
  if (!state.shown) {
    state.shown = true;
    glassCanvas.style.opacity = "1";
  }
}

function toggleDive() {
  state.cinema = false;
  if (state.targetDive > 0.5) {
    state.targetDive = 0;
    document.body.classList.remove("dived");
  } else {
    state.targetDive = 1;
    document.body.classList.add("dived");
  }
}

function unlockAudio() {
  if (state.audio && state.audio.ctx.state === "suspended") {
    state.audio.ctx.resume().catch(() => {});
  }
}

function startLoop() {
  if (state.looping) return;
  draw.prev = performance.now();
  requestAnimationFrame(draw);
}

const device = document.getElementById("device");
const windBtn = document.getElementById("windBtn");
const drag = {
  active: false,
  winding: false,
  looking: false,
  startX: 0,
  startY: 0,
  lastAng: 0,
  startT: 0,
  fromGlass: false
};

function clientXY(e) {
  if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
  if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
  return { x: e.clientX, y: e.clientY };
}

function deviceAngle(x, y) {
  const r = device.getBoundingClientRect();
  return Math.atan2(y - (r.top + r.height * 0.5), x - (r.left + r.width * 0.5));
}

function onPointerDown(e) {
  if (e.target.closest && e.target.closest("#windBtn")) return;
  unlockAudio();
  const { x, y } = clientXY(e);
  drag.active = true;
  drag.winding = false;
  drag.looking = state.dive > 0.45;
  drag.startX = x;
  drag.startY = y;
  drag.lastAng = deviceAngle(x, y);
  drag.startT = performance.now();
  drag.fromGlass = !!(e.target.closest && e.target.closest(".glass"));
  state.cinema = false;
  try { device.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.cancelable) e.preventDefault();
}

function onPointerMove(e) {
  if (!drag.active) return;
  const { x, y } = clientXY(e);
  if (state.dive > 0.45 || drag.looking) {
    const nx = x / window.innerWidth - 0.5;
    const ny = y / window.innerHeight - 0.5;
    state.yaw += nx * 0.016;
    state.pitch = Math.max(-0.4, Math.min(0.7, state.pitch - ny * 0.012));
    if (Math.hypot(x - drag.startX, y - drag.startY) > 10) drag.winding = true;
    return;
  }
  const dist = Math.hypot(x - drag.startX, y - drag.startY);
  if (dist > 12) drag.winding = true;
  if (!drag.winding) return;
  const a = deviceAngle(x, y);
  let d = a - drag.lastAng;
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  if (d > 0) {
    state.wind = Math.min(1, state.wind + d * 0.6);
    state.keyRot += d;
  }
  drag.lastAng = a;
  if (e.cancelable) e.preventDefault();
}

function onPointerUp() {
  if (!drag.active) return;
  const tap = !drag.winding && (performance.now() - drag.startT) < 500;
  const fromGlass = drag.fromGlass || drag.looking;
  drag.active = false;
  drag.winding = false;
  drag.looking = false;
  if (tap && fromGlass) toggleDive();
}

device.addEventListener("pointerdown", onPointerDown, { passive: false });
window.addEventListener("pointermove", onPointerMove, { passive: false });
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("pointercancel", onPointerUp);

function holdStart(e) {
  unlockAudio();
  state.holdWind = true;
  state.cinema = false;
  windBtn.classList.add("held");
  try { windBtn.setPointerCapture(e.pointerId); } catch (_) {}
  if (e.cancelable) e.preventDefault();
  e.stopPropagation();
}
function holdEnd(e) {
  state.holdWind = false;
  windBtn.classList.remove("held");
  if (e) e.stopPropagation();
}
windBtn.addEventListener("pointerdown", holdStart, { passive: false });
windBtn.addEventListener("pointerup", holdEnd);
windBtn.addEventListener("pointercancel", holdEnd);

window.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    e.preventDefault();
    state.wind = Math.min(1, state.wind + 0.2);
    state.keyRot += 0.6;
    state.cinema = false;
  }
  if (e.code === "Enter") toggleDive();
  if (e.code === "KeyR") { state.age = 0; state.wind = 0.4; }
});

function armAudio() {
  try {
    if (!state.audio) state.audio = new BoxSong();
    const p = state.audio.ctx.resume();
    if (p && typeof p.catch === "function") p.catch(() => {});
  } catch (e) { /* audio optional on Safari */ }
}

function enter() {
  if (state.started) return;
  state.started = true;
  const gate = document.getElementById("gate");
  if (gate) {
    gate.classList.add("hide");
    window.setTimeout(() => { if (gate && gate.parentNode) gate.remove(); }, 800);
  }
  bootGL();
  armAudio();
  if (!shot) {
    state.cinema = true;
    state.cinemaT = 0;
    state.age = 0.18;
    state.wind = 0.4;
  }
  startLoop();
}

window.__astrariumGo = enter;
const gateEl = document.getElementById("gate");
const enterBtn = document.getElementById("enterBtn");
function onGatePointer() {
  enter();
}
if (gateEl) {
  gateEl.addEventListener("pointerdown", onGatePointer, { passive: true });
  gateEl.addEventListener("click", onGatePointer, { passive: true });
}
if (enterBtn) {
  enterBtn.addEventListener("pointerdown", onGatePointer, { passive: true });
  enterBtn.addEventListener("click", onGatePointer, { passive: true });
}

window.addEventListener("resize", resize);
if (window.visualViewport) window.visualViewport.addEventListener("resize", resize);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    unlockAudio();
    startLoop();
  }
});

startLoop();
if (shot || params.get("autostart") === "1" || window.__wantEnter) enter();
