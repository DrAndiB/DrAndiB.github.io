/* The AI Gigafactory: scroll-through 3D explainer. Andreas Braun, 2026. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import LAND_B64 from './land.js';
import { setupCopy } from './copy-edit.js';
const COPY=await setupCopy({url:new URL('copy.json',import.meta.url),demo:'ai-gigafactory'});
const txt=COPY.t;
const escHtml=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');


/* ---------------- helpers ---------------- */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const softEase=t=>lerp(t,t*t*(3-2*t),0.75);
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=matchMedia('(max-width: 760px)').matches;

/* ---------------- renderer ---------------- */
const canvas=document.getElementById('gl');
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'}); }
catch(e){ document.getElementById('veil').textContent='This prototype needs WebGL.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.NeutralToneMapping;
renderer.toneMappingExposure=1.0;

const scene=new THREE.Scene();
const DAY_BG=new THREE.Color('#e7e4de'), NIGHT_BG=new THREE.Color('#040913');
scene.background=DAY_BG.clone();
scene.fog=new THREE.Fog(DAY_BG.clone(),500,3000);
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,0.1,5000);

/* ---------------- palette: every material knows its model + blueprint colour ---------------- */
const pal=[];
const THERM=new THREE.Color('#bcc4ce');
function pmat(day,night,o={}){
  const m=new THREE.MeshStandardMaterial({color:day,roughness:o.rough??0.86,metalness:o.metal??0,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,...(o.extra||{})});
  pal.push({m,day:new THREE.Color(day),night:new THREE.Color(night),therm:o.therm??1});
  return m;
}
const M={
  white:pmat('#f4f2ed','#0b1424'),
  light:pmat('#e3e0d9','#0a1221'),
  grey:pmat('#c8c4bc','#0d182b'),
  dark:pmat('#8e8a83','#13213a'),
  road:pmat('#d0ccc4','#070e1b'),
  pad:pmat('#ebe8e2','#060d19'),
  solar:pmat('#a7b6c6','#0c1a33',{rough:.45}),
  tree:pmat('#eeebe5','#08111f'),
  board:pmat('#d6d2ca','#0a1426'),
  metal:pmat('#bdbab4','#101b30',{rough:.4,metal:.35}),
  pipeC:pmat('#2f7fc1','#0c2a48',{therm:0,extra:{emissive:new THREE.Color('#2f9be6'),emissiveIntensity:0}}),
  pipeW:pmat('#d9643a','#3a1a10',{therm:0,extra:{emissive:new THREE.Color('#ff7a3d'),emissiveIntensity:0}}),
  tubeC:pmat('#2f7fc1','#0c2a48',{therm:0,extra:{emissive:new THREE.Color('#2f9be6'),emissiveIntensity:0}}),
  tubeW:pmat('#d9643a','#3a1a10',{therm:0,extra:{emissive:new THREE.Color('#ff7a3d'),emissiveIntensity:0}}),
  led:pmat('#58c48c','#0d3a2a',{therm:0,extra:{emissive:new THREE.Color('#59e0ff'),emissiveIntensity:0}}),
};
const groundMat=pmat('#dedad3','#050b16',{extra:{transparent:true}});
groundMat.polygonOffset=false;

const edgeMats=[];
function emat(k=1){const m=new THREE.LineBasicMaterial({color:'#7d796f',transparent:true,opacity:.2,depthWrite:false});m.userData.k=k;edgeMats.push(m);return m;}
const E=emat(1);
const EDGE_DAY=new THREE.Color('#77736a'), EDGE_NIGHT=new THREE.Color('#46c8ff');

/* ---------------- geometry bucket: merges static parts + their edges ---------------- */
class Bucket{
  constructor(){this.parts=new Map();this.edges=[];}
  add(geo,mat,x=0,y=0,z=0,o={}){
    const g=geo.clone();
    if(o.rx||o.ry||o.rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(o.rx||0,o.ry||0,o.rz||0,'YXZ')));
    g.translate(x,y,z);
    if(o.edges!==false) this.edges.push(new THREE.EdgesGeometry(g,o.thr||30));
    const ng=g.index?g.toNonIndexed():g;
    if(!this.parts.has(mat)) this.parts.set(mat,[]);
    this.parts.get(mat).push(ng);
  }
  build(parent,edgeMat=E,cast=true){
    for(const [mat,list] of this.parts){const m=new THREE.Mesh(mergeGeometries(list,false),mat);m.castShadow=cast;m.receiveShadow=true;parent.add(m);}
    if(this.edges.length) parent.add(new THREE.LineSegments(mergeGeometries(this.edges,false),edgeMat));
  }
}
const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const cyl=(rt,rb,h,s=16)=>new THREE.CylinderGeometry(rt,rb,h,s);

/* ---------------- textures ---------------- */
function canvasTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const dotTex=canvasTex(64,64,(g,w)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.9)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,w);});
function rackFace(g,w,h,em){
  g.fillStyle=em?'#000':'#f6f5f1';g.fillRect(0,0,w,h);
  const n=18;
  for(let i=0;i<n;i++){
    const y=8+i*(h-16)/n;
    if(!em){g.fillStyle=(i===8||i===9)?'#bdb9b1':'#e6e3dc';g.fillRect(6,y+2,w-12,(h-16)/n-4);}
    g.fillStyle=em?((i===8||i===9)?'#7fffd4':'#bff3ff'):'#5fbf8a';
    g.fillRect(12,y+5,4,3);
    if(i%3===0){g.fillRect(20,y+5,4,3);}
  }
  if(!em){g.strokeStyle='#cfcbc3';g.lineWidth=3;g.strokeRect(2,2,w-4,h-4);}
}
const rackMap=canvasTex(128,256,(g,w,h)=>rackFace(g,w,h,false));
const rackEm=canvasTex(128,256,(g,w,h)=>rackFace(g,w,h,true));
function dieDraw(g,w,h,em){
  seed=42;
  g.fillStyle=em?'#000':'#aab2bf';g.fillRect(0,0,w,h);
  const cols=8,rows=10,pad=18,cw=(w-pad*2)/cols,ch=(h-pad*2)/rows;
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
    const x=pad+i*cw,y=pad+j*ch;
    if(em){g.strokeStyle=`rgba(140,230,255,${.25+rnd()*.35})`;g.lineWidth=1.5;g.strokeRect(x+3,y+3,cw-6,ch-6);
      g.fillStyle=`rgba(180,245,255,${rnd()<.35?.55+rnd()*.4:.06})`;g.fillRect(x+8,y+8,cw-16,ch-16);}
    else{g.fillStyle=`hsl(220,10%,${62+rnd()*14}%)`;g.fillRect(x+3,y+3,cw-6,ch-6);}
  }
  g.strokeStyle=em?'rgba(255,255,255,.9)':'rgba(220,226,235,.5)';g.lineWidth=em?3:2;
  for(let k=0;k<6;k++){const y=pad+rnd()*(h-pad*2);g.beginPath();g.moveTo(pad,y);g.lineTo(w-pad,y);g.stroke();}
  for(let k=0;k<4;k++){const x=pad+rnd()*(w-pad*2);g.beginPath();g.moveTo(x,pad);g.lineTo(x,h-pad);g.stroke();}
  g.strokeStyle=em?'rgba(120,220,255,.8)':'rgba(40,45,55,.6)';g.lineWidth=4;g.strokeRect(6,6,w-12,h-12);
}
const dieMap=canvasTex(512,640,(g,w,h)=>dieDraw(g,w,h,false));
const dieEm=canvasTex(512,640,(g,w,h)=>dieDraw(g,w,h,true));
const rackSide=pmat('#f5f3ee','#0b1424');
const rackFront=pmat('#ffffff','#0c1628',{extra:{map:rackMap,emissiveMap:rackEm,emissive:new THREE.Color('#59e0ff'),emissiveIntensity:0}});
const dieMat=pmat('#f2f3f6','#0b1730',{rough:.3,metal:.5,therm:0,extra:{map:dieMap,emissiveMap:dieEm,emissive:new THREE.Color('#47d2ff'),emissiveIntensity:0}});

/* ---------------- lights ---------------- */
const hemi=new THREE.HemisphereLight('#ffffff','#d5d0c6',1.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff6ea',2.4);sun.castShadow=true;
sun.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048);sun.shadow.bias=-0.0004;
scene.add(sun);scene.add(sun.target);
const SUN_DIR=V(0.55,0.95,0.4).normalize();

/* ================= CAMPUS ================= */
const campus=new THREE.Group();scene.add(campus);
const B=new Bucket();

const ground=new THREE.Mesh(new THREE.PlaneGeometry(9000,9000),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;campus.add(ground);
B.add(box(340,0.2,200),M.pad,0,0.1,-25,{edges:true});
// roads (ring + cross)
const road=(w,d,x,z)=>B.add(box(w,0.06,d),M.road,x,0.23,z,{edges:false});
road(216,7,0,-55);road(216,7,0,55);road(7,117,-104.5,0);road(7,117,104.5,0);road(216,9,0,0);road(9,103,0,0);
road(62,9,139,0);road(8,54,86,-85);road(30,7,71,-80);

const HX=-50,HZ=25,FLOOR=0.3;
function yard(x,z,n=6,zs=null){
  for(let i=0;i<n;i++){
    const zz=zs?zs[i]:z-12.5+i*5;
    B.add(box(12,2.2,2.8),M.light,x,0.2+1.1,zz);
    for(let f=0;f<4;f++) B.add(cyl(1.05,1.05,0.25,20),M.dark,x-4.5+f*3,2.45,zz,{edges:false});
  }
}
const BRIDGE_Y=6.6;
function pipeBridge(xWall,xDrop,z,mat,yIn,r=.16){
  const sgn=Math.sign(xDrop-xWall),xr=xWall+sgn*0.6;
  if(yIn<BRIDGE_Y){B.add(cyl(r,r,BRIDGE_Y-yIn,10),mat,xr,(yIn+BRIDGE_Y)/2,z,{edges:false});}
  const L=Math.abs(xDrop-xr);B.add(cyl(r,r,L,10),mat,(xr+xDrop)/2,BRIDGE_Y,z,{rz:Math.PI/2,edges:false});
  B.add(cyl(r,r,BRIDGE_Y-2.45,10),mat,xDrop,(BRIDGE_Y+2.45)/2,z,{edges:false});
  for(const x of [xr,xDrop]) B.add(new THREE.SphereGeometry(r*1.25,10,8),mat,x,BRIDGE_Y,z,{edges:false});
}
function bridgePosts(xWall,z){const sgn=Math.sign(xWall);for(const d of [4,7.6]) B.add(box(0.22,BRIDGE_Y-0.4,1.9),M.grey,xWall+sgn*d,0.2+(BRIDGE_Y-0.4)/2,z,{edges:false});}
function hall(cx,cz){
  B.add(box(84,9,32),M.white,cx,4.5,cz);
  B.add(box(80,1.6,0.3),M.grey,cx,6.2,cz+16.15);B.add(box(80,1.6,0.3),M.grey,cx,6.2,cz-16.15);
  for(let i=0;i<6;i++){B.add(box(7,1.8,5),M.light,cx-32+i*12.8,9.9,cz-6);B.add(box(7,1.8,5),M.light,cx-32+i*12.8,9.9,cz+6);}
  const yx=cx+(cx<0?-64:64);yard(yx,cz);
  {const sg=cx<0?-1:1,xw=cx+sg*42,xd=cx+sg*59;
   for(const dz of [-2.2,2.2]){pipeBridge(xw,xd,cz+dz-0.25,M.pipeC,BRIDGE_Y,.18);pipeBridge(xw,xd,cz+dz+0.25,M.pipeW,BRIDGE_Y,.18);bridgePosts(xw,cz+dz);}}
}
hall(-50,-25);hall(50,-25);hall(50,25);

/* hero hall: open-able */
B.add(box(84,0.1,32),M.light,HX,0.25,HZ);
B.add(box(84,9,0.5),M.white,HX,4.7,HZ-15.75);
B.add(box(80,1.6,0.3),M.grey,HX,6.2,HZ-16.15);
B.add(box(0.5,9,32),M.white,HX-41.75,4.7,HZ);
B.add(box(0.5,9,32),M.white,HX+41.75,4.7,HZ);
const PAIRS=[-10.5,-3.5,3.5,10.5];
const HERO_WALL=HX-42.6,HERO_DROP=HX-59,HERO_IN_L=HX+35-HERO_WALL;
const ROWS=[];for(const c of PAIRS)for(const s of [-1,1])ROWS.push(HZ+c+s*1.2);
for(const z of ROWS) B.add(box(1,2.3,1.2),M.dark,HX+36.2,FLOOR+1.15,z);
yard(HX-64,HZ,4,PAIRS.map(c=>HZ+c));
// interior: CDUs, cable trays, pipes
for(const c of PAIRS){
  B.add(box(1.4,2.2,2.2),M.grey,HX-39.6,FLOOR+1.1,HZ+c);
  for(const s of [-1,1]) B.add(box(70,0.08,0.55),M.light,HX,FLOOR+2.55,HZ+c+s*1.2,{edges:false});
  for(const [dz,mat] of [[-0.35,M.pipeC],[0.35,M.pipeW]]){
    B.add(cyl(.14,.14,HERO_IN_L,10),mat,(HX+35+HERO_WALL)/2,3.3,HZ+c+dz,{rz:Math.PI/2,edges:false});
    pipeBridge(HERO_WALL+0.6,HERO_DROP,HZ+c+dz,mat,3.3,.14);}
  bridgePosts(HERO_WALL+0.6,HZ+c);
}
// front wall (folds down) + roof (lifts away)
const frontWall=new THREE.Group();frontWall.position.set(HX,0.2,HZ+16);campus.add(frontWall);
{const g=box(84,9,0.5);g.translate(0,4.5,-0.25);const m=new THREE.Mesh(g,M.white);m.castShadow=m.receiveShadow=true;frontWall.add(m);frontWall.add(new THREE.LineSegments(new THREE.EdgesGeometry(g),E));
 const l=box(80,1.6,0.3);l.translate(0,6,0.15);const lm=new THREE.Mesh(l,M.grey);lm.castShadow=true;frontWall.add(lm);}
const roofMat=pmat('#f4f2ed','#0b1424',{extra:{transparent:true}});
const roofEdge=emat(1);
const roof=new THREE.Group();roof.position.set(HX,9.2,HZ);campus.add(roof);
{const RB=new Bucket();RB.add(box(84,0.4,32),roofMat,0,0,0);
 for(let i=0;i<6;i++){RB.add(box(7,1.8,5),roofMat,-32+i*12.8,1.1,-6);RB.add(box(7,1.8,5),roofMat,-32+i*12.8,1.1,6);}
 RB.build(roof,roofEdge);}

/* racks (instanced) */
const RACKS=[];
for(const c of PAIRS)for(const s of [-1,1])for(let i=0;i<70;i++) RACKS.push({x:HX-34.5+i,z:HZ+c+s*1.2,hero:(c===10.5&&s===1&&i===30),r:rnd()});
const rackGeo=box(1,2.3,1.2);
const racks=new THREE.InstancedMesh(rackGeo,[rackSide,rackSide,rackSide,rackSide,rackFront,rackFront],RACKS.length);
racks.castShadow=racks.receiveShadow=true;
{const m4=new THREE.Matrix4(),eg=[];const base=new THREE.EdgesGeometry(rackGeo);
 RACKS.forEach((r,i)=>{ if(r.hero){m4.makeScale(0,0,0);} else {m4.makeTranslation(r.x,FLOOR+1.15,r.z); eg.push(base.clone().translate(r.x,FLOOR+1.15,r.z));} racks.setMatrixAt(i,m4); racks.setColorAt(i,new THREE.Color(1,1,1)); });
 campus.add(new THREE.LineSegments(mergeGeometries(eg,false),E));}
campus.add(racks);

/* hero rack, detailed */
const RACK=V(HX-4.5,FLOOR,HZ+11.7);
const heroRack=new THREE.Group();heroRack.position.copy(RACK);campus.add(heroRack);
const TRAY_I=12,TRAY_DY=0.118,TRAY_Y=0.15+TRAY_I*TRAY_DY,SLIDE=0.75;
{const RB=new Bucket();
 for(const sx of [-1,1]) RB.add(box(0.02,2.3,1.2),M.white,sx*0.49,1.15,0);
 RB.add(box(1,0.05,1.2),M.white,0,0.025,0);RB.add(box(1,0.05,1.2),M.white,0,2.275,0);
 for(const sx of [-1,1])for(const sz of [-1,1]) RB.add(box(0.05,2.3,0.05),M.grey,sx*0.465,1.15,sz*0.575);
 for(let i=0;i<18;i++){ if(i===TRAY_I) continue; const y=0.15+i*TRAY_DY, sw=(i===8||i===9);
   RB.add(box(0.9,0.09,1.1),M.light,0,y,0);
   RB.add(box(0.9,0.09,0.02),sw?M.dark:M.grey,0,y,0.555);
   RB.add(box(0.025,0.012,0.01),M.led,-0.38,y+0.02,0.567,{edges:false});
   if(i%3===0) RB.add(box(0.025,0.012,0.01),M.led,-0.34,y+0.02,0.567,{edges:false});}
 // manifolds at the back
 RB.add(cyl(.025,.025,2.1,10),M.pipeC,0.38,1.15,-0.56,{edges:false});
 RB.add(cyl(.025,.025,2.1,10),M.pipeW,0.3,1.15,-0.56,{edges:false});
 RB.build(heroRack);}
const tray=new THREE.Group();tray.position.set(0,TRAY_Y,0);heroRack.add(tray);
const GPU_L=V(0.2,0,0.22);
const plateMat=pmat('#bdbab4','#101b30',{rough:.4,metal:.35,extra:{transparent:true}});
const plateEdge=emat(1);
let heroPlate;
{const TB=new Bucket();
 TB.add(box(0.9,0.02,1.1),M.metal,0,0,0);
 TB.add(box(0.9,0.09,0.02),M.grey,0,0.035,0.555);
 TB.add(box(0.025,0.012,0.01),M.led,-0.38,0.055,0.567,{edges:false});
 for(const sx of [-1,1]) TB.add(box(0.02,0.06,1.1),M.grey,sx*0.44,0.03,0);
 TB.add(box(0.86,0.004,1.06),M.board,0,0.012,0);
 const gpus=[[-0.2,-0.18],[0.2,-0.18],[-0.2,0.22],[0.2,0.22]];
 for(const [x,z] of gpus){
   const hero=(x===0.2&&z===0.22);
   if(!hero) TB.add(box(0.13,0.025,0.13),M.metal,x,0.031,z);
   for(const [dx,mat] of [[-0.03,M.tubeC],[0.03,M.tubeW]]){const len=z+0.5-0.07;TB.add(box(0.012,0.012,len),mat,x+dx,0.046,z-0.065-len/2,{edges:false});}
 }
 for(const x of [-0.2,0.2]){TB.add(box(0.09,0.02,0.09),M.metal,x,0.026,-0.43);for(const o of [-0.1,-0.085,-0.07,0.07,0.085,0.1]) TB.add(box(0.006,0.03,0.1),M.grey,x+o,0.029,-0.43);}
 TB.add(box(0.8,0.035,0.03),M.dark,0,0.03,-0.53);
 for(const x of [-0.33,-0.27,0.27,0.33]) TB.add(box(0.035,0.02,0.05),M.grey,x,0.024,0.45);
 for(const x of [0,0.06,-0.06]) TB.add(box(0.03,0.012,0.14),M.grey,x,0.02,0.02);
 // hero GPU package
 const gx=GPU_L.x,gz=GPU_L.z;
 TB.add(box(0.11,0.004,0.11),M.dark,gx,0.016,gz);
 for(const dx of [-0.0145,0.0145]) TB.add(box(0.026,0.002,0.034),dieMat,gx+dx,0.019,gz);
 for(const sx of [-1,1])for(const dz of [-0.021,-0.007,0.007,0.021]) TB.add(box(0.016,0.003,0.012),M.grey,gx+sx*0.042,0.0195,gz+dz);
 TB.build(tray);
 const pg=box(0.13,0.025,0.13);heroPlate=new THREE.Group();heroPlate.position.set(gx,0.031,gz);
 const pm=new THREE.Mesh(pg,plateMat);pm.castShadow=true;heroPlate.add(pm);heroPlate.add(new THREE.LineSegments(new THREE.EdgesGeometry(pg),plateEdge));tray.add(heroPlate);}
const GPU_W=RACK.clone().add(V(GPU_L.x,TRAY_Y+0.02,GPU_L.z+SLIDE));
const TRAY_W=RACK.clone().add(V(0,TRAY_Y,SLIDE));

/* substation, pylons, buildings */
for(let i=0;i<4;i++){const x=30+i*15,z=-100;B.add(box(6,5,4),M.grey,x,2.7,z);for(let f=-2;f<=2;f++)B.add(box(0.3,4,4.6),M.dark,x+f*1.1,2.4,z,{edges:false});
  B.add(box(0.5,14,0.5),M.dark,x-3,7.2,z-9);B.add(box(0.5,14,0.5),M.dark,x+3,7.2,z-9);B.add(box(7,0.5,0.5),M.dark,x,13.8,z-9);}
B.add(box(68,0.5,0.5),M.dark,52.5,12,-112);
B.add(box(22,5,10),M.white,45,2.7,-80);
B.add(box(28,10,16),M.white,140,5.2,-17);B.add(box(28.3,2.4,16.3),M.solar,140,6.8,-17,{edges:false});
B.add(cyl(6,6,10,32),M.white,-30,5.2,-95);B.add(cyl(6,6,10,32),M.white,-14,5.2,-95);
const PYL=[V(60,0,-125),V(95,0,-185),V(135,0,-255),V(178,0,-330),V(222,0,-405),V(266,0,-480)];
const ARMS=[[-6,26],[6,26],[-5,20],[5,20]];
const pylonArm=[];
PYL.forEach((p,k)=>{const nx=k<PYL.length-1?PYL[k+1]:p.clone().add(p.clone().sub(PYL[k-1]));const dir=nx.clone().sub(k<PYL.length-1?p:PYL[k-1]).normalize();const ry=Math.atan2(dir.x,dir.z);
  B.add(cyl(0.5,2.4,28,4),M.dark,p.x,14,p.z,{ry:ry+Math.PI/4});
  B.add(box(13,0.5,0.6),M.dark,p.x,26,p.z,{ry});B.add(box(11,0.5,0.6),M.dark,p.x,20,p.z,{ry});
  const side=V(Math.cos(ry),0,-Math.sin(ry));
  pylonArm.push(ARMS.map(([s,h])=>p.clone().add(side.clone().multiplyScalar(s)).setY(h-0.6)));});
// cables: pylon chain + drop to substation gantry
const cables=[];
for(let a=0;a<4;a++){const pts=[V(52.5+(a-1.5)*6,12,-112)];for(const arm of pylonArm)pts.push(arm[a]);cables.push(pts);}
const cablePts=[];const catenary=(A,Bp,t,sag)=>A.clone().lerp(Bp,t).add(V(0,-sag*4*t*(1-t),0));
for(const c of cables)for(let s=0;s<c.length-1;s++)for(let i=0;i<16;i++){cablePts.push(catenary(c[s],c[s+1],i/16,3),catenary(c[s],c[s+1],(i+1)/16,3));}
const cableMat=new THREE.LineBasicMaterial({color:'#6d6a63',transparent:true,opacity:.6});
campus.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(cablePts),cableMat));

// solar field
for(let r=0;r<11;r++)for(let c=0;c<62;c++){B.add(box(4,0.08,2.3),M.solar,-130+c*4.3,1.4,88+r*6,{rx:-0.42,thr:20});}
// trees
seed=11;
for(let i=0;i<190;i++){let x,z,ok=false;for(let k=0;k<20&&!ok;k++){x=-210+rnd()*420;z=-170+rnd()*330;
  const inPad=Math.abs(x)<172&&z>-127&&z<77;const inSolar=x>-140&&x<140&&z>80&&z<160;const inLine=Math.abs((x-60)*0.83+(z+125)*0.56)<14&&z<-110;ok=!inPad&&!inSolar&&!inLine;}
  if(!ok)continue;const s=0.8+rnd()*0.9;B.add(new THREE.IcosahedronGeometry(3.2*s,0),M.tree,x,4.4*s+1.6,z,{edges:false});B.add(cyl(.25,.3,3,5),M.grey,x,1.5,z,{edges:false});}
B.build(campus);

/* night grid */
const gridMat=new THREE.LineBasicMaterial({color:'#46c8ff',transparent:true,opacity:0,depthWrite:false});
{const pts=[];for(let i=-60;i<=60;i++){pts.push(V(i*10,0.02,-600),V(i*10,0.02,600),V(-600,0.02,i*10),V(600,0.02,i*10));}
 campus.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),gridMat));}

/* trucks on the ring road */
const truckGeo=mergeGeometries([box(2.4,2.6,2.5).translate(4.6,1.5,0).toNonIndexed(),box(7,3,2.5).translate(0,1.7,0).toNonIndexed()]);
const trucks=[];for(let i=0;i<6;i++){const m=new THREE.Mesh(truckGeo,M.white);m.castShadow=true;campus.add(m);trucks.push({m,o:i/6,sp:0.012+rnd()*0.006,lane:i%2?1.6:-1.6});}
const RING=[V(-104.5,0,-55),V(104.5,0,-55),V(104.5,0,55),V(-104.5,0,55)];
const ringLen=2*(209+110);
function ringAt(u){let d=((u%1)+1)%1*ringLen;for(let k=0;k<4;k++){const a=RING[k],b=RING[(k+1)%4];const L=a.distanceTo(b);if(d<=L)return{p:a.clone().lerp(b,d/L),dir:b.clone().sub(a).normalize()};d-=L;}return{p:RING[0].clone(),dir:V(1,0,0)};}

/* moving points: power pulses, coolant, air */
function pointsLayer(n,size,color,parent){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial({size,map:dotTex,color,transparent:true,depthWrite:false,opacity:1});const p=new THREE.Points(g,m);p.frustumCulled=false;parent.add(p);return p;}
const power=pointsLayer(cables.length*6*(PYL.length),3.2,'#e07a2c',campus);
const coolC=pointsLayer(PAIRS.length*60,1.0,'#3d9bf0',campus);
const coolW=pointsLayer(PAIRS.length*60,1.0,'#ff7a3d',campus);
const air=pointsLayer(PAIRS.length*110,2.0,'#ff6a3a',campus);
const SUP=[V(HERO_DROP,2.6,0),V(HERO_DROP,BRIDGE_Y,0),V(HERO_WALL+0.6,BRIDGE_Y,0),V(HERO_WALL+0.6,3.3,0),V(HX+35,3.3,0)];
const SUP_C=[0];for(let i=1;i<SUP.length;i++)SUP_C.push(SUP_C[i-1]+SUP[i].distanceTo(SUP[i-1]));
function along(u,out){const d=u*SUP_C[SUP_C.length-1];let i=1;while(i<SUP_C.length-1&&d>SUP_C[i])i++;const t=(d-SUP_C[i-1])/(SUP_C[i]-SUP_C[i-1]);return out.copy(SUP[i-1]).lerp(SUP[i],t);}
const pv=V(0,0,0);
const airSeed=Array.from({length:PAIRS.length*110},()=>[rnd(),rnd(),rnd()]);

/* ================= NETWORK FABRIC ================= */
const fabric=new THREE.Group();campus.add(fabric);
const fabMat=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
const SPINES=[-24,-8,8,24].map(x=>V(HX+x,17,HZ));
const LEAF_TOP=ROWS.map(z=>V(HX+36.2,FLOOR+2.35,z));
const TRUNK_Y=FLOOR+2.55;
const fabPts=[];
ROWS.forEach(z=>fabPts.push(V(HX-35,TRUNK_Y,z),V(HX+36.2,TRUNK_Y,z)));
const curves=[];
LEAF_TOP.forEach(l=>SPINES.forEach(sp=>{const c=new THREE.QuadraticBezierCurve3(l.clone(),V(l.x,sp.y,l.z).lerp(sp,0.3),sp.clone().setY(sp.y-0.45));
  const pts=c.getPoints(24);for(let i=0;i<24;i++)fabPts.push(pts[i],pts[i+1]);curves.push(c);}));
fabric.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(fabPts),fabMat));
const spineMat=new THREE.MeshBasicMaterial({color:'#0d2b44',transparent:true,opacity:0,depthWrite:false});
const spineEdge=new THREE.LineBasicMaterial({color:'#9beeff',transparent:true,opacity:0,depthWrite:false});
SPINES.forEach(sp=>{const g=box(5,0.9,2.4);const m=new THREE.Mesh(g,spineMat);m.position.copy(sp);fabric.add(m);const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),spineEdge);e.position.copy(sp);fabric.add(e);});
const trunkP=pointsLayer(ROWS.length*12,1.0,'#d2f7ff',fabric);
const curveP=pointsLayer(curves.length*2,1.2,'#d2f7ff',fabric);

/* ================= TRAINING ================= */
const LOSS_N=400;
const lossVal=u=>0.35+2.6*Math.exp(-u*4.2)+0.06*Math.sin(u*90)*Math.exp(-u*2)+0.025*Math.sin(u*237+1);
const LX0=HX-26,LY0=21,LZ=HZ-12;
const lossPos=u=>V(LX0+u*72,LY0+0.6+lossVal(u)/3*13,LZ);
const lossArr=[];for(let i=0;i<=LOSS_N;i++){const v=lossPos(i/LOSS_N);lossArr.push(v.x,v.y,v.z);}
const lossGeo=new LineGeometry();lossGeo.setPositions(lossArr);
const lossMat=new LineMaterial({color:0xffb35c,linewidth:4,transparent:true,opacity:0,depthWrite:false});
const lossLine=new Line2(lossGeo,lossMat);lossLine.frustumCulled=false;campus.add(lossLine);
const axisMat=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
{const pts=[V(LX0-1,LY0,LZ),V(LX0+73,LY0,LZ),V(LX0-1,LY0,LZ),V(LX0-1,LY0+15,LZ)];for(let k=1;k<=8;k++){const x=LX0+k*0.12*72;pts.push(V(x,LY0,LZ),V(x,LY0+0.7,LZ));}
 campus.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),axisMat));}
const headP=pointsLayer(1,2.6,'#ffe2b0',campus);
const ckP=pointsLayer(8,1.4,'#6fe0ff',campus);
{const a=ckP.geometry.attributes.position.array;for(let k=1;k<=8;k++){const v=lossPos(k*0.12);a.set([v.x,v.y,v.z],(k-1)*3);}ckP.geometry.attributes.position.needsUpdate=true;}
const failMat=new THREE.MeshBasicMaterial({color:'#ff3b30',transparent:true,opacity:0,depthWrite:false});
const failBox=new THREE.Mesh(box(1.14,2.44,1.34),failMat);failBox.visible=false;campus.add(failBox);
const hoverEdge=new THREE.LineSegments(new THREE.EdgesGeometry(box(1.16,2.46,1.36)),new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,depthWrite:false}));hoverEdge.visible=false;campus.add(hoverEdge);
const sim={state:'run',t0:0,runT:0.22,fail:-1,from:0,ck:0,lost:0};
const rackName=i=>'ABCDEFGH'[Math.floor(i/70)]+'-'+String(i%70+1).padStart(2,'0');
function failRack(i,time=performance.now()/1000){ if(i<0||RACKS[i].hero||!(sim.state==='run'||sim.state==='resume'))return;
  sim.state='stall';sim.t0=time;sim.fail=i;const r=RACKS[i];failBox.position.set(r.x,FLOOR+1.15,r.z);failBox.visible=true;}
const beaconMat=new THREE.LineBasicMaterial({color:'#ff3b30',transparent:true,opacity:0,depthWrite:false});
const beacon=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(0,0,0),V(0,9,0)]),beaconMat);beacon.visible=false;campus.add(beacon);

/* ================= GLOBE ================= */
const R=1500;
const globe=new THREE.Group();globe.position.set(0,-R,0);scene.add(globe);
const LUX={lat:49.61,lon:6.13};
function llv(lat,lon){const a=lat*Math.PI/180,b=lon*Math.PI/180;return V(Math.cos(a)*Math.sin(b),Math.sin(a),Math.cos(a)*Math.cos(b));}
const vL=llv(LUX.lat,LUX.lon);
const east=V(Math.cos(LUX.lon*Math.PI/180),0,-Math.sin(LUX.lon*Math.PI/180));
const south=llv(LUX.lat-1,LUX.lon).sub(vL).normalize();
const toLocal=v=>V(v.dot(east),v.dot(vL),v.dot(south));
const globeMat=pmat('#efede8','#060e1d',{therm:0});globeMat.polygonOffset=false;
const sphere=new THREE.Mesh(new THREE.SphereGeometry(R*0.996,96,64),globeMat);globe.add(sphere);
const land=(()=>{const bin=atob(LAND_B64);const buf=new Int16Array(bin.length/2);for(let i=0;i<buf.length;i++)buf[i]=(bin.charCodeAt(2*i)|(bin.charCodeAt(2*i+1)<<8))<<16>>16;
  const pos=new Float32Array(buf.length/2*3);for(let i=0;i<buf.length/2;i++){const v=toLocal(llv(buf[2*i]/100,buf[2*i+1]/100)).multiplyScalar(R*1.001);pos.set([v.x,v.y,v.z],i*3);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));
  const m=new THREE.PointsMaterial({size:10,map:dotTex,color:'#8d887f',transparent:true,depthWrite:false});return new THREE.Points(g,m);})();
globe.add(land);
const gratMat=new THREE.LineBasicMaterial({color:'#8d887f',transparent:true,opacity:0,depthWrite:false});
{const pts=[];for(let lat=-75;lat<=75;lat+=15)for(let lon=0;lon<360;lon+=4){pts.push(toLocal(llv(lat,lon)).multiplyScalar(R*1.0005),toLocal(llv(lat,lon+4)).multiplyScalar(R*1.0005));}
 for(let lon=0;lon<360;lon+=15)for(let lat=-88;lat<88;lat+=4){pts.push(toLocal(llv(lat,lon)).multiplyScalar(R*1.0005),toLocal(llv(lat+4,lon)).multiplyScalar(R*1.0005));}
 globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),gratMat));}
const CITIES=[[48.86,2.35],[52.52,13.4],[40.42,-3.7],[41.9,12.5],[51.5,-0.13],[59.33,18.07],[52.23,21.01],[37.98,23.73],[38.72,-9.14],[53.35,-6.26],[48.21,16.37],[60.17,24.94],[44.43,26.1],[52.37,4.9],[55.68,12.57],[50.08,14.44],[45.46,9.19],[64.15,-21.94],[40.71,-74.0],[-23.55,-46.63],[35.68,139.69],[-1.29,36.82],[1.35,103.82],[25.2,55.27],[30.04,31.24],[43.65,-79.38]];
const arcs=[];
const arcMat=new THREE.LineBasicMaterial({color:'#cf5f27',transparent:true,opacity:0,depthWrite:false});
{const pts=[];for(const [la,lo] of CITIES){const vB=llv(la,lo);const ang=vL.angleTo(vB);const N=72;const path=[];
  for(let i=0;i<=N;i++){const t=i/N;const v=vL.clone().multiplyScalar(Math.sin((1-t)*ang)/Math.sin(ang)).add(vB.clone().multiplyScalar(Math.sin(t*ang)/Math.sin(ang)));
    const h=1+Math.sin(Math.PI*t)*(0.012+ang*0.05);path.push(toLocal(v).multiplyScalar(R*h));}
  for(let i=0;i<N;i++)pts.push(path[i],path[i+1]);arcs.push(path);}
 globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),arcMat));}
const tokens=pointsLayer(arcs.length*3,16,'#cf5f27',globe);
const luxDot=pointsLayer(1,46,'#cf5f27',globe);luxDot.geometry.attributes.position.array.set([0,R*1.002,0]);
const ring=new THREE.Mesh(new THREE.RingGeometry(0.8,1,64),new THREE.MeshBasicMaterial({color:'#cf5f27',transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
ring.rotation.x=-Math.PI/2;ring.position.y=R*1.002;globe.add(ring);

/* ================= POST ================= */
const rt=new THREE.WebGLRenderTarget(innerWidth,innerHeight,{type:THREE.HalfFloatType,samples:4});
const composer=new EffectComposer(renderer,rt);
composer.addPass(new RenderPass(scene,camera));
const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),0,0.55,0.9);composer.addPass(bloom);
const lens=new ShaderPass({uniforms:{tDiffuse:{value:null},amount:{value:1},res:{value:new THREE.Vector2(1,1)},vign:{value:.3},pr:{value:1}},
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
  fragmentShader:`uniform sampler2D tDiffuse;uniform float amount,vign,pr;uniform vec2 res;varying vec2 vUv;
  void main(){vec4 c=texture2D(tDiffuse,vUv);float f=smoothstep(.16,.5,abs(vUv.y-.5));float r=amount*f*7.*pr;
   if(r>.25){vec4 acc=c;for(int i=0;i<16;i++){float a=float(i)*2.39996;float rr=sqrt((float(i)+.5)/16.)*r;acc+=texture2D(tDiffuse,vUv+vec2(cos(a),sin(a))*rr/res);}c=acc/17.;}
   vec2 q=vUv-.5;c.rgb*=1.-vign*dot(q,q)*1.7;gl_FragColor=c;}`});
composer.addPass(lens);
composer.addPass(new OutputPass());

/* ================= CHOREOGRAPHY ================= */
// [scroll, target, distance, azimuth°, elevation°]
const KEYS=[
  [0.00,V(0,0,-10),470,32,50],
  [0.07,V(0,0,-10),400,48,40],
  [0.17,V(-12,0,5),300,22,46],
  [0.245,V(HX,3,HZ),125,14,40],
  [0.31,V(HX,2,HZ+1),78,6,62],
  [0.45,V(HX,2,HZ+1),70,-8,56],
  [0.515,V(HX-4,1.2,HZ+8.5),17,-20,24],
  [0.585,RACK.clone().add(V(0,1.3,0.3)),4.3,-14,8],
  [0.645,TRAY_W.clone().add(V(0,0.02,0)),1.15,-6,38],
  [0.715,GPU_W.clone(),0.26,2,62],
  [0.80,GPU_W.clone(),0.072,14,78],
  [0.87,V(HX,3,HZ+1),66,-2,60],
  [0.98,V(HX+2,4,HZ),58,16,44],
  [1.035,V(HX+8,15,HZ-6),125,-6,12],
  [1.12,V(HX+8,15,HZ-6),118,4,14],
  [1.185,V(HX,0,HZ),300,40,48],
  [1.275,V(0,-520,0),3500,10,46],
  [1.32,V(0,-560,0),3700,18,44],
];
function cameraAt(p,out){
  let i=0;while(i<KEYS.length-2&&p>KEYS[i+1][0])i++;
  const A=KEYS[i],Bk=KEYS[i+1];const e=softEase(clamp((p-A[0])/(Bk[0]-A[0]),0,1));
  const d=Math.exp(lerp(Math.log(A[2]),Math.log(Bk[2]),e));
  const w=Math.abs(A[2]-Bk[2])<1e-6?e:(A[2]-d)/(A[2]-Bk[2]);
  out.t.copy(A[1]).lerp(Bk[1],w);out.d=d;out.az=lerp(A[3],Bk[3],e);out.el=lerp(A[4],Bk[4],e);return out;
}

/* ---------------- call-outs: [label, world position, from, to] in scroll units ---------------- */
const TL=(x,y,z)=>TRAY_W.clone().add(V(x,y,z));
const CALLOUTS=[
  ['label.dataHalls',V(50,10.8,25),.06,.205],['label.dryCoolers',V(114,2.6,22.5),.06,.205],['label.substation',V(52,6,-100),.06,.205],
  ['label.grid',V(95,27,-185),.06,.205],['label.solar',V(10,2,112),.06,.205],['label.water',V(-22,10.4,-95),.06,.205],
  ['label.operations',V(140,10.6,-17),.06,.205],['label.pipeBridge',V(-100.8,BRIDGE_Y,HZ+10.5),.07,.205],
  ['label.gpuRacks',V(HX+22,FLOOR+2.3,HZ+4.7),.285,.455],['label.hotAisle',V(HX+8,FLOOR+1.6,HZ-3.5),.285,.455],['label.coldAisle',V(HX+14,FLOOR+0.2,HZ+7),.285,.455],
  ['label.supply',V(HX-24,3.3,HZ-10.85),.285,.455],['label.return',V(HX+4,3.3,HZ+3.85),.285,.455],['label.cdu',V(HX-39.6,FLOOR+2.2,HZ-3.5),.285,.455],
  ['label.cableTray',V(HX+3,FLOOR+2.6,HZ+9.3),.49,.535],['label.rackRow',V(HX-9,FLOOR+2.3,HZ+11.7),.49,.535],
  ['label.computeTrays',RACK.clone().add(V(0.25,0.15+3*TRAY_DY+0.05,0.57)),.565,.6],['label.switchTrays',RACK.clone().add(V(0.25,0.15+8.5*TRAY_DY+0.05,0.57)),.565,.6],
  ['label.gpu',TL(-0.2,0.045,-0.18),.645,.705],['label.coldPlate',TL(0.2,0.045,0.22),.645,.67],['label.cpu',TL(-0.2,0.037,-0.43),.645,.705],['label.memory',TL(0.3,0.045,-0.43),.645,.705],['label.coolantLines',TL(-0.17,0.052,0.0),.645,.705],
  ['label.die',GPU_W.clone().add(V(-0.0145,0,-0.008)),.725,.81],['label.hbm',GPU_W.clone().add(V(0.042,-0.0005,0.021)),.725,.785],['label.substrate',GPU_W.clone().add(V(-0.047,-0.002,-0.046)),.725,.775],
  ['label.spine',SPINES[2].clone().add(V(0,0.5,0)),.9,.985],['label.leaf',LEAF_TOP[3].clone(),.9,.985],['label.uplinks',V(HX-12,TRUNK_Y,ROWS[5]),.9,.985],
  ['label.checkpoint',V(LX0+0.12*72,LY0,LZ),1.04,1.13],['label.steps',V(LX0+64,LY0,LZ),1.04,1.13],
].map(([key,pos,a,b])=>({key,pos,a,b}));
const coLayer=document.getElementById('callouts');
CALLOUTS.forEach(c=>{c.el=document.createElement('div');c.el.className='callout';c.el.dataset.copy=c.key;c.el.textContent=txt(c.key);coLayer.appendChild(c.el);});
let labelsOn=true,labelsT=1;
const labelsBtn=document.getElementById('labelsBtn');
const setLabels=v=>{labelsOn=v;labelsBtn.setAttribute('aria-pressed',v);};
labelsBtn.onclick=()=>setLabels(!labelsOn);
addEventListener('keydown',e=>{const tg=e.target;if(tg&&(tg.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)))return;if((e.key==='l'||e.key==='L')&&!e.metaKey&&!e.ctrlKey&&!e.altKey)setLabels(!labelsOn);});

/* ---------------- UI state ---------------- */
const QS=new URLSearchParams(location.search);let look=QS.get('look')||'auto',cool=QS.get('cool')||'liquid';
const coolStats=document.getElementById('coolStats');
function renderCool(){coolStats.innerHTML=[1,2,3].map(i=>`<dt>${escHtml(txt(`cooling.stat${i}.label`))}</dt><dd>${escHtml(txt(`cooling.stat${i}.${cool}`))}</dd>`).join('');
  document.querySelectorAll('[data-cool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.cool===cool));}
renderCool();
document.querySelectorAll('[data-look]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.look===look));
document.querySelectorAll('[data-cool]').forEach(b=>b.onclick=()=>{cool=b.dataset.cool;renderCool();});
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{look=b.dataset.look;document.querySelectorAll('[data-look]').forEach(x=>x.setAttribute('aria-pressed',x===b));});
const U=1.32;
const maxScroll=()=>document.documentElement.scrollHeight-innerHeight;
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>scrollTo({top:parseFloat(b.dataset.go)/U*maxScroll(),behavior:'smooth'}));
document.getElementById('toTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
const cards=[...document.querySelectorAll('.card')].map(el=>({el,a:+el.dataset.a,b:+el.dataset.b}));
const navBtns=[...document.querySelectorAll('[data-go]')];
const lossTag=document.getElementById('lossTag'),failTag=document.getElementById('failTag'),trainStatus=document.getElementById('trainStatus'),statusTxt=trainStatus.querySelector('span');
if(matchMedia('(pointer: coarse)').matches){const h=document.getElementById('tryHint');h.dataset.copy='training.hint.touch';h.textContent=txt('training.hint.touch');}
COPY.onChange(k=>{if(k.startsWith('label.'))CALLOUTS.forEach(c=>{if(c.key===k)c.w=0;});if(k.startsWith('cooling.stat'))renderCool();});
const scaleVal=document.getElementById('scaleVal'),hint=document.getElementById('hint'),luxTag=document.getElementById('luxTag');
let ptx=0,pty=0,mx=0,my=0;
const ndc=new THREE.Vector2(9,9),ray=new THREE.Raycaster();let hoverId=-1,interactive=false;
addEventListener('pointermove',e=>{ptx=(e.clientX/innerWidth-.5)*2;pty=(e.clientY/innerHeight-.5)*2;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);});
function pickRack(){ray.setFromCamera(ndc,camera);const h=ray.intersectObject(racks,false)[0];return h?h.instanceId:-1;}
canvas.addEventListener('click',e=>{if(!interactive)return;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);const id=pickRack();if(id>=0)failRack(id);});

function resize(){const w=innerWidth,h=innerHeight;lossMat.resolution.set(w,h);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  const pr=renderer.getPixelRatio();lens.uniforms.res.value.set(w*pr,h*pr);lens.uniforms.pr.value=pr;}
addEventListener('resize',resize);resize();

const params=new URLSearchParams(location.search);
const FORCE_P=params.has('p')?parseFloat(params.get('p')):null;
let pS=FORCE_P??0,night=0,liquidT=1,last=performance.now(),frames=0;
const cam={t:V(0,0,0),d:1,az:0,el:0};
const tmpC=new THREE.Color(),tmpV=V(0,0,0),dummy=new THREE.Object3D();
const HEAT_L1=new THREE.Color('#f7c45c'),HEAT_L2=new THREE.Color('#ee8a3a'),HEAT_A1=new THREE.Color('#ef6a3a'),HEAT_A2=new THREE.Color('#c9302a'),WHITE=new THREE.Color(1,1,1);
const WARM_DAY=new THREE.Color('#cf5f27'),WARM_NIGHT=new THREE.Color('#ffc46e'),LAND_DAY=new THREE.Color('#8d887f'),LAND_NIGHT=new THREE.Color('#3fb6ff');

function fmtLen(m){if(m>=1000)return (m/1000).toFixed(m>=1e5?0:m>=1e4?0:1)+' km';if(m>=1)return m.toFixed(m>=100?0:1)+' m';if(m>=0.01)return (m*100).toFixed(1)+' cm';return (m*1000).toFixed(1)+' mm';}

function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;const time=now/1000;
  const pT=FORCE_P??clamp(scrollY/Math.max(1,maxScroll()),0,1)*U;
  pS+=(pT-pS)*(1-Math.exp(-dt*(reduceMotion?20:4.5)));
  const p=pS;

  /* state curves */
  const nightAuto=sstep(.62,.655,p);
  const nightTarget=look==='auto'?nightAuto:(look==='blueprint'?1:0);
  night+=(nightTarget-night)*(1-Math.exp(-dt*(look==='auto'?14:3.5)));
  if(FORCE_P!==null) night=nightTarget;
  liquidT+=((cool==='liquid'?1:0)-liquidT)*(1-Math.exp(-dt*4));
  const thermal=sstep(.255,.31,p)*(1-sstep(.455,.5,p));
  const roofT=sstep(.205,.285,p),wallT=sstep(.215,.295,p);
  const trayT=sstep(.59,.64,p)*(1-sstep(.83,.87,p)),plateT=sstep(.655,.705,p)*(1-sstep(.82,.85,p));
  const globeT=sstep(1.195,1.255,p);
  const fabricT=sstep(.86,.9,p)*(1-sstep(1.15,1.19,p));
  const trainT=sstep(1.0,1.035,p)*(1-sstep(1.125,1.16,p));

  /* palette */
  for(const e of pal){e.m.color.copy(e.day).lerp(THERM,thermal*0.42*e.therm).lerp(e.night,night);}
  for(const m of edgeMats){m.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);m.opacity=lerp(.2,.85,night)*m.userData.k;m.visible=m.opacity>0.003;}
  roofEdge.userData.k=1-roofT;plateEdge.userData.k=1-plateT;
  cableMat.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);cableMat.opacity=lerp(.55,.8,night);
  gridMat.opacity=night*0.09*(1-sstep(0,.15,globeT))*(1-sstep(.99,1.03,p)*(1-sstep(1.13,1.17,p)));
  scene.background.copy(DAY_BG).lerp(NIGHT_BG,night);scene.fog.color.copy(scene.background);
  document.body.classList.toggle('night',night>0.5);
  hemi.intensity=lerp(1.3,0.05,night);sun.intensity=lerp(2.4,0,night);
  const pg=thermal*0.5+night*lerp(0.35,0.9,sstep(1.14,1.19,p));M.pipeC.emissiveIntensity=pg;M.pipeW.emissiveIntensity=pg;
  M.tubeC.emissiveIntensity=M.tubeW.emissiveIntensity=night*0.12;/* training simulation */
  let compute=0,comm=0,commU=0;
  if(fabricT>0.001){
    if(sim.state==='run'||sim.state==='resume'){const ph=(time%1.7)/1.7;compute=sstep(0,.06,ph)*(1-sstep(.42,.5,ph));comm=sstep(.5,.55,ph)*(1-sstep(.93,1,ph));commU=clamp((ph-.5)/.5,0,1);}
    if(trainT>0.5&&(sim.state==='run'||sim.state==='resume')) sim.runT=Math.min(1,sim.runT+dt/60);
    if(sim.state==='run'&&sim.runT>=1){sim.state='done';sim.t0=time;}
    if(sim.state==='done'&&time-sim.t0>3){sim.state='run';sim.runT=0.04;}
    if(sim.state==='stall'&&time-sim.t0>2.6){sim.state='rewind';sim.t0=time;sim.from=sim.runT;sim.ck=Math.floor(sim.runT/0.12)*0.12;sim.lost=Math.round((sim.from-sim.ck)*150000/100)*100;}
    if(sim.state==='rewind'){const k=sstep(0,1,(time-sim.t0)/1.2);sim.runT=lerp(sim.from,sim.ck,k);if(k>=1){sim.state='resume';sim.t0=time;}}
    if(sim.state==='resume'&&time-sim.t0>2.2){sim.state='run';}
  }
  if(sim.state!=='stall'&&sim.state!=='rewind'&&sim.state!=='resume')failBox.visible=false;
  const waiting=(sim.state==='stall'||sim.state==='rewind')?1:0;
  M.led.emissiveIntensity=night*3;
  rackFront.emissiveIntensity=night*1.4*lerp(1,waiting?0.25:0.55+1.7*compute,fabricT);
  dieMat.emissiveIntensity=night*(2.0+0.35*Math.sin(time*2.2));
  bloom.strength=night*(1.05-0.35*globeT);bloom.threshold=lerp(0.95,0.06,night);

  /* model-kit animations */
  roof.position.y=9.2+roofT*14;roofMat.opacity=1-roofT;roofMat.depthWrite=roofT<0.5;roof.visible=roofT<0.995;
  frontWall.rotation.x=wallT*Math.PI/2*0.985;
  tray.position.z=trayT*SLIDE;
  heroPlate.position.y=0.031+plateT*0.12;plateMat.opacity=1-plateT;heroPlate.visible=plateT<0.995;

  /* racks: thermal colours */
  for(let i=0;i<RACKS.length;i++){const r=RACKS[i];
    tmpC.copy(HEAT_A1).lerp(HEAT_A2,r.r);const a=tmpC.clone();tmpC.copy(HEAT_L1).lerp(HEAT_L2,r.r*0.8);a.lerp(tmpC,liquidT);
    racks.setColorAt(i,a.lerp(WHITE,1-thermal));}
  racks.instanceColor.needsUpdate=true;

  /* moving things */
  const tt=reduceMotion?0:time;
  trucks.forEach(tk=>{const {p:q,dir}=ringAt(tk.o+tt*tk.sp);const side=V(-dir.z,0,dir.x);tk.m.position.copy(q).addScaledVector(side,tk.lane).setY(0.25);tk.m.rotation.y=Math.atan2(-dir.z,dir.x);});
  {const a=power.geometry.attributes.position.array;let k=0;
   for(const c of cables){const segs=c.length-1;for(let j=0;j<6*PYL.length&&k<a.length/3;j++){let u=(1-((j/(6*PYL.length)+tt*0.035)%1))*segs;const s=Math.min(segs-1,Math.floor(u));const v=catenary(c[s],c[s+1],u-s,3);a.set([v.x,v.y,v.z],k*3);k++;}}
   power.geometry.attributes.position.needsUpdate=true;
   power.material.opacity=(1-thermal)*(1-sstep(.45,.6,p)*(1-sstep(1.16,1.19,p)));power.material.color.set(night>.5?'#ffb35c':'#e07a2c');}
  {const ca=coolC.geometry.attributes.position.array,wa=coolW.geometry.attributes.position.array;let k=0;
   PAIRS.forEach(c=>{for(let j=0;j<60;j++){const u=(j/60+tt*0.05)%1;along(u,pv);ca.set([pv.x,pv.y,HZ+c-0.35],k*3);along(1-u,pv);wa.set([pv.x,pv.y,HZ+c+0.35],k*3);k++;}});
   coolC.geometry.attributes.position.needsUpdate=coolW.geometry.attributes.position.needsUpdate=true;
   const o=Math.max(thermal*liquidT,night*sstep(.4,.5,p)*(1-sstep(.6,.66,p)));coolC.material.opacity=o;coolW.material.opacity=o;coolC.visible=coolW.visible=o>0.01;}
  {const a=air.geometry.attributes.position.array;
   for(let i=0;i<airSeed.length;i++){const [s1,s2,s3]=airSeed[i];const c=PAIRS[i%PAIRS.length];const u=(s2+tt*(0.18+s3*0.12))%1;
     a.set([HX-34+s1*68+Math.sin(u*6+s3*9)*0.4,FLOOR+2.4+u*6.2,HZ+c+(s3-0.5)*0.9+u*u*(s3-0.5)*6],i*3);}
   air.geometry.attributes.position.needsUpdate=true;air.material.opacity=thermal*(1-liquidT)*0.9;air.visible=air.material.opacity>0.01;}

  /* fabric */
  fabric.visible=fabricT>0.002;
  if(fabric.visible){
    fabMat.opacity=fabricT*(0.28+0.4*comm)*(1-0.6*waiting);fabMat.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);
    spineMat.opacity=fabricT*0.85;spineEdge.opacity=fabricT*(0.6+0.4*comm);spineMat.color.set(night>.5?'#0d2b44':'#d9d6cf');
    const a=trunkP.geometry.attributes.position.array;let k=0;
    ROWS.forEach((z,r)=>{for(let j=0;j<12;j++){const u=(j/12+commU*0.35+r*0.031)%1;a.set([HX-35+u*71.2,TRUNK_Y,z],k*3);k++;}});
    trunkP.geometry.attributes.position.needsUpdate=true;trunkP.material.opacity=fabricT*comm;
    const b=curveP.geometry.attributes.position.array;
    curves.forEach((c,i)=>{const up=c.getPoint(sstep(0,1,commU*1.6));const dn=curves[(i+5)%curves.length].getPoint(1-sstep(0,1,commU*1.6-0.6));b.set([up.x,up.y,up.z],i*3);b.set([dn.x,dn.y,dn.z],(curves.length+i)*3);});
    curveP.geometry.attributes.position.needsUpdate=true;curveP.material.opacity=fabricT*comm;
    const pc=night>.5?'#d2f7ff':'#2f7fc1';trunkP.material.color.set(pc);curveP.material.color.set(pc);
  }
  /* training */
  interactive=trainT>0.6;
  lossLine.visible=trainT>0.002;
  lossGeo.instanceCount=Math.max(1,Math.floor(sim.runT*LOSS_N));lossMat.opacity=trainT;
  axisMat.opacity=trainT*0.4;axisMat.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);
  const hp=lossPos(sim.runT);headP.geometry.attributes.position.array.set([hp.x,hp.y,hp.z]);headP.geometry.attributes.position.needsUpdate=true;headP.material.opacity=trainT;
  ckP.geometry.setDrawRange(0,Math.min(8,Math.floor(sim.runT/0.12+1e-6)));ckP.material.opacity=trainT;
  beacon.visible=failBox.visible;if(beacon.visible){beacon.position.set(failBox.position.x,FLOOR+2.3,failBox.position.z);beaconMat.opacity=failMat.opacity*1.4;}
  if(failBox.visible){failMat.opacity=(sim.state==='resume'?1-sstep(0,1.2,time-sim.t0):1)*(0.45+0.4*Math.abs(Math.sin(time*5)))*Math.max(trainT,0.0);}
  if(interactive&&!isMobile){hoverId=pickRack();}else hoverId=-1;
  hoverEdge.visible=hoverId>=0&&!RACKS[hoverId].hero&&(sim.state==='run'||sim.state==='resume');
  if(hoverEdge.visible){const r=RACKS[hoverId];hoverEdge.position.set(r.x,FLOOR+1.15,r.z);}
  canvas.style.cursor=hoverEdge.visible?'pointer':'';
  if(trainT>0.05){
    const steps=Math.round(sim.runT*150000/100)*100,L=lossVal(sim.runT).toFixed(2),f=sim.fail>=0?rackName(sim.fail):'';
    const vars={steps:steps.toLocaleString('en-US'),loss:L,rack:f,lost:sim.lost.toLocaleString('en-US')};
    const st=[{run:'',stall:'bad',rewind:'warn',resume:'',done:''}[sim.state],txt('training.status.'+sim.state,vars)];
    if(statusTxt.textContent!==st[1])statusTxt.textContent=st[1];trainStatus.className='status '+st[0];
  }
  /* globe */
  globe.visible=globeT>0.002;
  const cs=Math.exp(Math.log(0.002)*sstep(0.1,1,globeT));campus.scale.setScalar(cs);campus.visible=globeT<0.995;
  groundMat.opacity=1-sstep(0,0.3,globeT);groundMat.depthWrite=groundMat.opacity>0.99;
  if(globe.visible){
    land.material.opacity=globeT*lerp(.8,.95,night);land.material.color.copy(LAND_DAY).lerp(LAND_NIGHT,night);
    gratMat.opacity=globeT*lerp(.08,.07,night);gratMat.color.copy(LAND_DAY).lerp(EDGE_NIGHT,night);
    const warm=tmpC.copy(WARM_DAY).lerp(WARM_NIGHT,night);
    arcMat.color.copy(warm);arcMat.opacity=globeT*lerp(.5,.32,night);
    tokens.material.color.copy(warm);tokens.material.opacity=globeT;luxDot.material.color.copy(warm);luxDot.material.opacity=globeT;
    ring.material.color.copy(warm);const rp=(tt*0.5)%1;ring.scale.setScalar(20+rp*130);ring.material.opacity=sstep(.6,1,globeT)*(1-rp)*0.8;
    const a=tokens.geometry.attributes.position.array;let k=0;
    arcs.forEach((path,j)=>{for(let q=0;q<3;q++){const u=((tt*0.11+j*0.137+q/3)%1);const f=u*(path.length-1);const i0=Math.floor(f);const v=path[i0].clone().lerp(path[Math.min(path.length-1,i0+1)],f-i0);a.set([v.x,v.y,v.z],k*3);k++;}});
    tokens.geometry.attributes.position.needsUpdate=true;
  }

  /* camera */
  cameraAt(p,cam);
  mx+=(ptx-mx)*(1-Math.exp(-dt*2));my+=(pty-my)*(1-Math.exp(-dt*2));
  const sway=reduceMotion?0:1;
  const az=(cam.az+sway*(Math.sin(time*.13)*1.2+mx*2.2))*Math.PI/180,el=clamp(cam.el+sway*(Math.sin(time*.1)*.6-my*1.6),2,88)*Math.PI/180;
  camera.position.set(cam.t.x+cam.d*Math.cos(el)*Math.sin(az),cam.t.y+cam.d*Math.sin(el),cam.t.z+cam.d*Math.cos(el)*Math.cos(az));
  camera.lookAt(cam.t);
  if(!isMobile&&!QS.has('noshift')){const w=innerWidth,h=innerHeight;camera.setViewOffset(w,h,-w*0.13*(1-0.5*sstep(.75,.8,p)*(1-sstep(.81,.85,p))),0,w,h);}
  camera.near=Math.max(0.0005,cam.d*0.02);camera.far=cam.d*60+60;camera.updateProjectionMatrix();
  scene.fog.near=cam.d*1.5;scene.fog.far=cam.d*(globeT>0?9:7);

  /* shadow frustum follows the subject */
  const s=clamp(cam.d*1.1,0.6,460);const L=cam.d*3+30;
  sun.target.position.copy(cam.t);sun.position.copy(cam.t).addScaledVector(SUN_DIR,L);
  const sc=sun.shadow.camera;sc.left=-s;sc.right=s;sc.top=s;sc.bottom=-s;sc.near=Math.max(0.01,L-s*2.5);sc.far=L+s*2.5;sc.updateProjectionMatrix();
  sun.shadow.normalBias=s*0.0015;

  /* lens */
  lens.uniforms.amount.value=(0.55+0.45*sstep(90,320,cam.d))*(1-0.4*night)*(1-thermal*0.7)*(1-globeT);
  lens.uniforms.vign.value=lerp(.28,.65,night);

  /* call-outs */
  labelsT+=((labelsOn?1:0)-labelsT)*(1-Math.exp(-dt*8));
  const cardRects=cards.filter(c=>+c.el.style.opacity>0.3).map(c=>c.el.getBoundingClientRect());
  for(const c of CALLOUTS){
    let o=labelsT*sstep(c.a,c.a+0.012,p)*(1-sstep(c.b-0.012,c.b,p))*(1-globeT);
    if(o<0.01){if(c.vis){c.el.style.opacity=0;c.vis=false;}continue;}
    tmpV.copy(c.pos).project(camera);
    if(tmpV.z>1||Math.abs(tmpV.x)>1.05||Math.abs(tmpV.y)>1.05){if(c.vis){c.el.style.opacity=0;c.vis=false;}continue;}
    const sx=(tmpV.x+1)/2*innerWidth,sy=(1-tmpV.y)/2*innerHeight;
    if(!c.w)c.w=c.el.offsetWidth||c.t.length*8+20;
    const L=sx-c.w/2-6,R=sx+c.w/2+6,T=sy-52,Bm=sy+6;
    let clash=T<62||L<8||R>innerWidth-8||(R>innerWidth-150&&Math.abs(sy-innerHeight/2)<95)||(L<150&&Bm>innerHeight-80);
    for(const r of cardRects){if(R>r.left&&L<r.right&&Bm>r.top&&T<r.bottom){clash=true;break;}}
    c.fade=(c.fade??1)+((clash?0:1)-(c.fade??1))*(1-Math.exp(-dt*10));o*=c.fade;
    c.vis=true;c.el.style.opacity=o;c.el.style.left=sx+'px';c.el.style.top=sy+'px';
  }
  /* HUD */
  for(const c of cards){const o=sstep(c.a,c.a+0.018,p)*(1-sstep(c.b-0.018,c.b,p));c.el.style.opacity=o;c.el.style.transform=`translateY(calc(${isMobile?'0px':'-50%'} + ${(1-o)*18}px))`;c.el.classList.toggle('on',o>.5);}
  hint.style.opacity=1-sstep(.005,.03,p);
  let on=0;navBtns.forEach((b,i)=>{if(p>=parseFloat(b.dataset.go)-0.03)on=i;});navBtns.forEach((b,i)=>b.classList.toggle('on',i===on));
  const fw=2*cam.d*Math.tan(camera.fov*Math.PI/360)*camera.aspect*Math.exp(Math.log(6371000/R)*globeT);
  scaleVal.textContent='≈ '+fmtLen(fw);
  const placeTag=(el,v,o)=>{if(o<=0.01){el.style.opacity=0;return;}tmpV.copy(v).project(camera);if(tmpV.z>1){el.style.opacity=0;return;}el.style.left=((tmpV.x+1)/2*innerWidth)+'px';el.style.top=((1-tmpV.y)/2*innerHeight)+'px';el.style.opacity=o;};
  placeTag(lossTag,hp,trainT);if(trainT>0.05)lossTag.textContent=txt('training.tag.loss',{loss:lossVal(sim.runT).toFixed(2)});
  if(failBox.visible){failTag.textContent=sim.state==='resume'?txt('training.tag.spare'):txt('training.tag.failed',{rack:rackName(sim.fail)});placeTag(failTag,tmpV.copy(failBox.position).setY(FLOOR+11.3),trainT*(sim.state==='resume'?1-sstep(0,1.2,time-sim.t0):1));}else failTag.style.opacity=0;
  if(globeT>0.4){tmpV.set(0,0,0).project(camera);luxTag.style.left=((tmpV.x+1)/2*innerWidth)+'px';luxTag.style.top=((1-tmpV.y)/2*innerHeight)+'px';luxTag.style.opacity=sstep(.5,.9,globeT);}else luxTag.style.opacity=0;

  composer.render(dt);
  if(++frames===3){document.getElementById('veil').classList.add('gone');window.__ready=true;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
