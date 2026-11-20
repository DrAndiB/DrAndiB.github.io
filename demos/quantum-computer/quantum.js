/* The Quantum Computer: scroll-through 3D explainer. Andreas Braun, 2026. */
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
import { setupCopy } from './copy-edit.js';
const COPY=await setupCopy({url:new URL('copy.json',import.meta.url),demo:'quantum-computer'});
const txt=COPY.t;
const escHtml=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ---------------- helpers ---------------- */
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const softEase=t=>lerp(t,t*t*(3-2*t),0.75);
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const DEG=Math.PI/180;
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const isMobile=matchMedia('(max-width: 760px)').matches;

/* ---------------- renderer ---------------- */
const canvas=document.getElementById('gl');
let renderer;
try{ renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'high-performance'}); }
catch(e){ document.getElementById('veil').textContent='This demo needs WebGL.'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2));
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.NeutralToneMapping;
renderer.toneMappingExposure=1.0;

const scene=new THREE.Scene();
const DAY_BG=new THREE.Color('#e7e4de'), NIGHT_BG=new THREE.Color('#040913');
scene.background=DAY_BG.clone();
scene.fog=new THREE.Fog(DAY_BG.clone(),20,120);
const camera=new THREE.PerspectiveCamera(35,innerWidth/innerHeight,0.1,500);

/* ---------------- palette: every material knows its model + blueprint colour ---------------- */
const pal=[];
const THERM=new THREE.Color('#c4c8cc');
function pmat(day,night,o={}){
  const m=new THREE.MeshStandardMaterial({color:day,roughness:o.rough??0.86,metalness:o.metal??0,
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1,...(o.extra||{})});
  pal.push({m,day:new THREE.Color(day),night:new THREE.Color(night),therm:o.therm??1,stage:o.stage,glow:m.emissive.clone()});
  return m;
}
const glow=(c)=>({emissive:new THREE.Color(c),emissiveIntensity:0});
const M={
  white:pmat('#f4f2ed','#0b1424'),
  light:pmat('#e3e0d9','#0a1221'),
  grey:pmat('#c8c4bc','#0d182b'),
  dark:pmat('#8e8a83','#13213a'),
  pad:pmat('#ebe8e2','#060d19'),
  metal:pmat('#bdbab4','#101b30',{rough:.4,metal:.35}),
  copper:pmat('#ead9c6','#161c2c',{rough:.5,metal:.1,stage:5}),
  pipeC:pmat('#2f7fc1','#0c2a48',{extra:glow('#2f9be6')}),
  pipeW:pmat('#d9643a','#3a1a10',{extra:glow('#ff7a3d')}),
  coaxD:pmat('#cf7a3a','#3a1a10',{stage:5,rough:.5,extra:glow('#ff9a4d')}),
  coaxR:pmat('#3f8ccc','#0c2a48',{stage:5,rough:.5,extra:glow('#4fc3ff')}),
  led:pmat('#58c48c','#0d3a2a',{therm:0,extra:glow('#59e0ff')}),
};
const groundMat=pmat('#dedad3','#050b16');groundMat.polygonOffset=false;

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
  build(parent,edgeMat=E,cast=true,recv=true){
    for(const [mat,list] of this.parts){const m=new THREE.Mesh(mergeGeometries(list,false),mat);m.castShadow=cast;m.receiveShadow=recv;parent.add(m);}
    if(this.edges.length) parent.add(new THREE.LineSegments(mergeGeometries(this.edges,false),edgeMat));
  }
}
const box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
const cyl=(rt,rb,h,s=16)=>new THREE.CylinderGeometry(rt,rb,h,s);
const tube=(a,c,b,r,seg=20)=>new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(a,c,b),seg,r,6,false);

/* ---------------- textures ---------------- */
function canvasTex(w,h,draw,srgb=true){const c=document.createElement('canvas');c.width=w;c.height=h;draw(c.getContext('2d'),w,h);const t=new THREE.CanvasTexture(c);if(srgb)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;}
const dotTex=canvasTex(64,64,(g,w)=>{const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,255,255,1)');r.addColorStop(.35,'rgba(255,255,255,.9)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,w,w);});
function rackFace(g,w,h,em){
  g.fillStyle=em?'#000':'#f6f5f1';g.fillRect(0,0,w,h);
  const n=14;
  for(let i=0;i<n;i++){
    const y=8+i*(h-16)/n,hh=(h-16)/n-4;
    if(!em){g.fillStyle=i%4===3?'#bdb9b1':'#e6e3dc';g.fillRect(6,y+2,w-12,hh);}
    g.fillStyle=em?(i%4===3?'#7fffd4':'#bff3ff'):'#5fbf8a';
    for(let k=0;k<(i%4===3?2:6);k++) g.fillRect(12+k*17,y+6,5,3);
    if(!em&&i%4!==3){g.fillStyle='#c9c5bd';for(let k=0;k<6;k++){g.beginPath();g.arc(15+k*17,y+hh-3,2.4,0,7);g.fill();}}
  }
  if(!em){g.strokeStyle='#cfcbc3';g.lineWidth=3;g.strokeRect(2,2,w-4,h-4);}
}
const rackMap=canvasTex(128,256,(g,w,h)=>rackFace(g,w,h,false));
const rackEm=canvasTex(128,256,(g,w,h)=>rackFace(g,w,h,true));
const rackSide=pmat('#f5f3ee','#0b1424');
const rackFront=pmat('#ffffff','#0c1628',{extra:{map:rackMap,emissiveMap:rackEm,...glow('#59e0ff')}});

/* ---------------- lights ---------------- */
const hemi=new THREE.HemisphereLight('#ffffff','#d5d0c6',1.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff6ea',2.4);sun.castShadow=true;
sun.shadow.mapSize.set(isMobile?1024:2048,isMobile?1024:2048);sun.shadow.bias=-0.0004;
scene.add(sun);scene.add(sun.target);
const SUN_DIR=V(0.5,0.95,0.6).normalize();

/* ================= LAB ================= */
const lab=new THREE.Group();scene.add(lab);
const B=new Bucket();
const FLOOR=0.06;
const ground=new THREE.Mesh(new THREE.PlaneGeometry(3000,3000),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;lab.add(ground);
B.add(box(13,FLOOR,10),M.pad,0,FLOOR/2,0);
const tileMat=emat(.4);
{const pts=[];for(let i=1;i<20;i++){const x=-6.5+i*0.65;pts.push(V(x,FLOOR+0.002,-5),V(x,FLOOR+0.002,5));}
 for(let i=1;i<16;i++){const z=-5+i*0.625;pts.push(V(-6.5,FLOOR+0.002,z),V(6.5,FLOOR+0.002,z));}
 lab.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),tileMat));}

/* walls: two sides of a model-kit room, fade away for the hall */
const wallMat=pmat('#f4f2ed','#0b1424',{extra:{transparent:true}});
const wallEdge=emat(1);
const walls=new THREE.Group();lab.add(walls);
{const WB=new Bucket();
 WB.add(box(13.15,0.9,0.15),wallMat,-0.075,0.45,-5.075);
 WB.add(box(0.15,0.9,10),wallMat,-6.575,0.45,0);
 WB.build(walls,wallEdge,false,true);}

/* support frame */
const FR=0.8;
for(const sx of [-1,1])for(const sz of [-1,1]) B.add(box(0.09,3.1,0.09),M.grey,sx*FR,FLOOR+1.55,sz*FR);
for(const s of [-1,1]){B.add(box(2*FR+0.09,0.09,0.09),M.grey,0,FLOOR+3.1,s*FR);B.add(box(0.09,0.09,2*FR+0.09),M.grey,s*FR,FLOOR+3.1,0);
  B.add(box(2*FR,0.06,0.06),M.grey,0,2.675,s*0.39);}

/* cryostat: plates (index 0 = room temperature flange) */
const PY=[2.62,2.30,1.98,1.68,1.44,1.20], PR=[0.34,0.29,0.27,0.24,0.22,0.20], PT=[0.04,0.025,0.025,0.025,0.025,0.025];
const GOLD=new THREE.Color('#dcc48f'), GOLD_NIGHT=new THREE.Color('#141d2e');
const TCOL=['#d9643a','#e9b45f','#b9d6e6','#74afe0','#3f84d2','#2a5cb5'].map(c=>new THREE.Color(c));
// per-stage materials, so cables, rods and the dilution unit take the colour of the stage they sit in
const GAPS=[0,1,2,3,4];
const coaxDg=GAPS.map(i=>pmat('#cf7a3a','#3a1a10',{stage:i+.5,rough:.5,extra:glow('#ff9a4d')}));
const coaxRg=GAPS.map(i=>pmat('#3f8ccc','#0c2a48',{stage:i+.5,rough:.5,extra:glow('#4fc3ff')}));
const rodM=GAPS.map(i=>pmat('#bdbab4','#101b30',{stage:i+.5,rough:.4,metal:.35}));
const cuAt=st=>pmat('#ead9c6','#161c2c',{rough:.5,metal:.1,stage:st});
const COAX=[M.coaxD,M.coaxR,...coaxDg,...coaxRg];
const plateM=PY.map(()=>new THREE.MeshStandardMaterial({color:'#dcc48f',roughness:.42,metalness:.25,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1}));
PY.forEach((y,i)=>B.add(cyl(PR[i],PR[i],PT[i],48),plateM[i],0,y,0));
for(let i=0;i<5;i++){const y0=PY[i]-PT[i]/2,y1=PY[i+1]+PT[i+1]/2;
  for(const a of [30,150,270]){const r=PR[i+1]-0.03;B.add(cyl(.006,.006,y0-y1,8),rodM[i],r*Math.cos(a*DEG),(y0+y1)/2,r*Math.sin(a*DEG),{edges:false});}}
// pulse tube cooler
const PTX=0.215*Math.cos(215*DEG),PTZ=0.215*Math.sin(215*DEG);
B.add(cyl(.085,.085,.26,24),M.light,PTX,2.77,PTZ);
B.add(box(.17,.12,.21),M.grey,PTX,2.96,PTZ);
B.add(cyl(.05,.05,PY[0]-PY[1]-0.03,16),rodM[0],PTX,(PY[0]+PY[1])/2,PTZ);
B.add(cyl(.032,.032,PY[1]-PY[2]-0.025,16),rodM[1],PTX,(PY[1]+PY[2])/2,PTZ);
B.add(cyl(.05,.05,.02,16),cuAt(2),PTX,PY[2]+0.0225,PTZ);
// dilution unit down the middle
const cu3=cuAt(3),cu35=cuAt(3.5),cu45=cuAt(4.5);
B.add(cyl(.055,.055,.06,24),cu3,0,PY[3]-0.0425,0);
B.add(cyl(.012,.012,PY[3]-PY[5]-0.1,10),rodM[4],0,(PY[3]+PY[5])/2-0.02,0,{edges:false});
for(let k=0;k<5;k++) B.add(cyl(.046,.046,.014,24),cu45,0,lerp(PY[4]-0.04,PY[5]+0.04,k/4),0);
B.add(cyl(.02,.02,.09,12),cu35,0,(PY[3]+PY[4])/2,0);
B.add(cyl(.06,.06,.06,24),M.copper,0,PY[5]-0.0425,0);
// coaxial lines
const LR=0.13, LINES=[];
const arc=(n,a0,a1,kind)=>{for(let k=0;k<n;k++){const a=lerp(a0,a1,n>1?k/(n-1):0)*DEG;LINES.push({x:LR*Math.cos(a),z:LR*Math.sin(a),kind,a});}};
arc(12,65,175,'d');arc(6,5,55,'r');arc(8,245,345,'d');
for(const l of LINES){const mats=l.kind==='d'?coaxDg:coaxRg;
  for(let i=0;i<5;i++){const y0=PY[i]-PT[i]/2,y1=PY[i+1]+PT[i+1]/2;B.add(cyl(.0035,.0035,y0-y1,6),mats[i],l.x,(y0+y1)/2,l.z,{edges:false});}
  B.add(cyl(.006,.006,.03,8),M.metal,l.x,PY[0]+0.035,l.z,{edges:false});
  if(l.kind==='d'){for(let i=1;i<6;i++) B.add(box(.014,.03,.014),M.dark,l.x,PY[i]+PT[i]/2+0.02,l.z,{edges:false});}
  else{B.add(box(.03,.045,.022),M.grey,l.x,PY[2]+0.04,l.z,{ry:-l.a});B.add(box(.022,.022,.022),M.grey,l.x,PY[5]+0.03,l.z,{ry:-l.a});}
}
// umbilical, cable tray, drop to the racks
B.add(box(.16,.66,.16),M.dark,0.05,2.97,0.02);
B.add(box(.3,.05,3.9),M.light,0.05,3.3,-1.85);
B.add(box(.2,1.27,.12),M.dark,0.05,2.69,-3.6);

/* control racks */
const RACK_X=[-0.6,0.05,0.7],RACK_Z=-3.6;
const rackGeo=box(0.62,2.0,0.9);
const racks=new THREE.InstancedMesh(rackGeo,[rackSide,rackSide,rackSide,rackSide,rackFront,rackFront],3);
racks.castShadow=racks.receiveShadow=true;
{const m4=new THREE.Matrix4(),eg=[],base=new THREE.EdgesGeometry(rackGeo);
 RACK_X.forEach((x,i)=>{m4.makeTranslation(x,FLOOR+1,RACK_Z);racks.setMatrixAt(i,m4);eg.push(base.clone().translate(x,FLOOR+1,RACK_Z));});
 lab.add(new THREE.LineSegments(mergeGeometries(eg,false),E));}
lab.add(racks);

/* gas handling, compressor, desk, a figure for scale */
const GX=-2.7,GZ=-0.3,KX=3.6,KZ=-1.4;
B.add(box(.9,1.8,.7),M.white,GX,FLOOR+0.9,GZ);
B.add(box(.7,.5,.02),M.light,GX,FLOOR+1.35,GZ+0.36);
for(let k=0;k<4;k++) B.add(cyl(.06,.06,.02,20),M.dark,GX-0.27+k*0.18,FLOOR+1.42,GZ+0.38,{rx:Math.PI/2});
for(const z of [0.75,1.25]) B.add(cyl(.16,.16,.5,20),M.grey,GX,FLOOR+0.2,GZ+z,{rz:Math.PI/2});
for(const [dx,mat] of [[-0.05,M.pipeC],[0.05,M.pipeW]]) B.add(tube(V(GX+dx,FLOOR+1.8,GZ),V(-1.5,3.5,-0.1),V(-0.12+dx*1.4,PY[0]+0.02,0.2),.02,28),mat,0,0,0,{edges:false});
B.add(box(.7,.75,.6),M.light,KX,FLOOR+0.375,KZ);
for(let k=0;k<4;k++) B.add(box(.5,.02,.04),M.grey,KX,FLOOR+0.2+k*0.12,KZ+0.31,{edges:false});
for(const dx of [-0.06,0.06]) B.add(tube(V(KX+dx,FLOOR+0.75,KZ),V(2.0,3.75,-1.2),V(PTX+dx*0.7,3.02,PTZ),.022,28),M.metal,0,0,0,{edges:false});
B.add(box(1.6,.04,.75),M.white,3.9,0.78,1.6);
for(const sx of [-1,1])for(const sz of [-1,1]) B.add(box(.05,.72,.05),M.grey,3.9+sx*0.74,FLOOR+0.36,1.6+sz*0.32,{edges:false});
B.add(box(.6,.36,.03),M.dark,3.9,1.14,1.38);B.add(box(.05,.16,.05),M.grey,3.9,0.88,1.38,{edges:false});
B.add(new THREE.CapsuleGeometry(.14,1.08,4,12),M.white,3.0,FLOOR+0.68,0.9,{edges:false});
B.add(new THREE.SphereGeometry(.11,16,12),M.white,3.0,FLOOR+1.55,0.9,{edges:false});

/* sample stage and chip package under the mixing chamber */
const STAGE_Y=0.992, PKG_TOP=1.005, CY=PKG_TOP+0.0006;
B.add(cyl(.1,.1,.006,32),M.copper,0,STAGE_Y,0);
for(const a of [90,210,330]) B.add(cyl(.004,.004,PY[5]-PT[5]/2-STAGE_Y,8),M.metal,.088*Math.cos(a*DEG),(PY[5]-PT[5]/2+STAGE_Y)/2,.088*Math.sin(a*DEG),{edges:false});
B.add(box(.06,.01,.06),M.copper,0,1.0,0);
{const con=[];for(let k=0;k<4;k++){const t=-0.018+k*0.012;con.push([0.036,t,-22+k*14],[-0.036,t,202-k*14],[t,-0.036,250+k*13.3]);}
 for(const [x,z,deg] of con){const horiz=Math.abs(x)>Math.abs(z);
  B.add(cyl(.0025,.0025,.012,8),M.metal,x,1.0,z,{rz:horiz?Math.PI/2:0,rx:horiz?0:Math.PI/2,edges:false});
  const out=V(x*1.17,1.0,z*1.17),top=V(LR*Math.cos(deg*DEG),PY[5]-PT[5]/2,LR*Math.sin(deg*DEG));
  B.add(tube(top,V(top.x*0.95,1.03,top.z*0.95),out,.0013,16),x>0.03?M.coaxR:M.coaxD,0,0,0,{edges:false});}}
B.build(lab);

/* vacuum can and radiation shields: slide down and fade */
const CANS=[[0.345,0.62,2.60,'#f4f2ed'],[0.30,0.72,2.285,'#e9e4d8'],[0.275,0.82,1.965,'#e0d9c8']].map(([r,y0,y1,col])=>{
  const mat=pmat(col,'#0b1424',{extra:{transparent:true}}),ed=emat(1),g=new THREE.Group();lab.add(g);
  const cb=new Bucket();cb.add(cyl(r,r,y1-y0,48),mat,0,(y0+y1)/2,0);cb.build(g,ed);return {g,mat,ed};});
const shieldMat=pmat('#e3e0d9','#0a1221',{stage:5,extra:{transparent:true}}),shieldEdge=emat(1);
const shield=new THREE.Group();lab.add(shield);
{const sb=new Bucket();sb.add(cyl(.115,.115,.22,32),shieldMat,0,1.07,0);sb.build(shield,shieldEdge);}
const lidMat=pmat('#ead9c6','#161c2c',{rough:.5,metal:.1,stage:5,extra:{transparent:true}}),lidEdge=emat(1);
const lid=new THREE.Group();lab.add(lid);
{const lb=new Bucket();lb.add(box(.06,.005,.06),lidMat,0,0,0);lb.build(lid,lidEdge);}
const LID_Y=CY+0.0035;

/* ================= CHIP ================= */
const A=0.002;                       // qubit pitch, 2 mm
const C=V(0,CY,0);
const chipG=new THREE.Group();chipG.position.copy(C);lab.add(chipG);
const dIdx=(i,j)=>j*7+i;
const DATA=[];for(let j=0;j<7;j++)for(let i=0;i<7;i++)DATA.push({i,j,x:(i-3)*A,z:(j-3)*A});
const MEAS=[];
for(let pj=-1;pj<=6;pj++)for(let pi=-1;pi<=6;pi++){
  const inner=pi>=0&&pi<=5&&pj>=0&&pj<=5,type=(((pi+pj)%2)+2)%2===0?'X':'Z';
  const lr=(pi===-1||pi===6)&&pj>=0&&pj<=5,tb=(pj===-1||pj===6)&&pi>=0&&pi<=5;
  if(inner||(lr&&type==='Z')||(tb&&type==='X')) MEAS.push({pi,pj,type,x:(pi+.5-3)*A,z:(pj+.5-3)*A});
}
const HERO=dIdx(3,3);
function chipDraw(g,w,h,em){
  const s=w/20,X=mm=>(mm+10)*s;
  g.fillStyle=em?'#000':'#c6ccd5';g.fillRect(0,0,w,h);
  const line=em?'rgba(110,215,255,.42)':'#939ca9',trench=em?'rgba(0,0,0,0)':'#8791a0';
  g.lineCap='round';g.lineJoin='round';
  // bond pads and feed lines
  for(let side=0;side<4;side++)for(let k=0;k<22;k++){
    const t=-8.4+k*0.8,p=9.2,q=7.5;
    const P=side===0?[t,-p]:side===1?[t,p]:side===2?[-p,t]:[p,t];
    const Q=side===0?[t*.84,-q]:side===1?[t*.84,q]:side===2?[-q,t*.84]:[q,t*.84];
    const R=[Q[0]*.93,Q[1]*.93];
    g.strokeStyle=line;g.lineWidth=s*0.035;g.beginPath();g.moveTo(X(P[0]),X(P[1]));g.lineTo(X(Q[0]),X(Q[1]));g.lineTo(X(R[0]),X(R[1]));g.stroke();
    if(em){g.strokeStyle='rgba(120,220,255,.55)';g.lineWidth=s*0.03;g.strokeRect(X(P[0]-.21),X(P[1]-.21),s*.42,s*.42);}
    else{g.fillStyle='#e9ecf1';g.fillRect(X(P[0]-.21),X(P[1]-.21),s*.42,s*.42);g.strokeStyle='#8d95a2';g.lineWidth=1;g.strokeRect(X(P[0]-.21),X(P[1]-.21),s*.42,s*.42);}
  }
  const cross=(x,z,L,W,rot)=>{g.save();g.translate(X(x),X(z));g.rotate(rot);g.fillRect(-L/2*s,-W/2*s,L*s,W*s);g.fillRect(-W/2*s,-L/2*s,W*s,L*s);g.restore();};
  const snake=(x,z,dir)=>{g.beginPath();let px=x,up=true;g.moveTo(X(px),X(z+0.15));for(let k=0;k<5;k++){g.lineTo(X(px),X(z+(up?-0.15:0.15)));px+=dir*0.05;g.lineTo(X(px),X(z+(up?-0.15:0.15)));up=!up;}g.stroke();};
  const heroZone=(x,z)=>Math.abs(x)<0.95&&Math.abs(z)<0.95;
  // couplers
  g.strokeStyle=em?'rgba(110,215,255,.16)':'#a3abb7';g.lineWidth=s*0.03;
  for(const m of MEAS)for(const [di,dj] of [[0,0],[1,0],[0,1],[1,1]]){const i=m.pi+di,j=m.pj+dj;if(i<0||i>6||j<0||j>6)continue;
    const dx=(i-3)*2,dz=(j-3)*2,mx=m.x*1000,mz=m.z*1000;if(heroZone(dx,dz))continue;g.beginPath();g.moveTo(X(mx),X(mz));g.lineTo(X(dx),X(dz));g.stroke();}
  for(const d of DATA){const x=d.x*1000,z=d.z*1000;if(heroZone(x,z))continue;
    g.fillStyle=trench;cross(x,z,0.92,0.22,0);
    g.strokeStyle=line;g.lineWidth=s*0.022;snake(x+0.52,z,1);}
  for(const m of MEAS){const x=m.x*1000,z=m.z*1000;
    g.fillStyle=trench;cross(x,z,0.66,0.2,Math.PI/4);
    g.strokeStyle=line;g.lineWidth=s*0.022;snake(x-0.4,z-0.42,-1);}
  g.strokeStyle=em?'rgba(120,220,255,.8)':'rgba(60,66,78,.55)';g.lineWidth=s*0.06;g.strokeRect(s*.12,s*.12,w-s*.24,h-s*.24);
}
const TEXN=isMobile?1024:2048;
const chipMap=canvasTex(TEXN,TEXN,(g,w,h)=>chipDraw(g,w,h,false));
const chipEm=canvasTex(TEXN,TEXN,(g,w,h)=>chipDraw(g,w,h,true));
const chipTop=pmat('#ffffff','#0b1730',{rough:.38,metal:.3,therm:0,extra:{map:chipMap,emissiveMap:chipEm,...glow('#47d2ff')}});
const chipSide=pmat('#8e96a3','#0a1428');
{const g=box(0.02,0.0006,0.02);const m=new THREE.Mesh(g,[chipSide,chipSide,chipTop,chipSide,chipSide,chipSide]);m.position.y=-0.0003;chipG.add(m);
 const e=new THREE.LineSegments(new THREE.EdgesGeometry(g),E);e.position.y=-0.0003;chipG.add(e);}
const crossGeo=(L,W,H)=>mergeGeometries([box(L,H,W).toNonIndexed(),box(W,H,L).toNonIndexed()],false);
const QH=0.000001,QY=0.0000009;   // metal film: 1 µm thick, sitting 0.4 µm up
const qMat=pmat('#ffffff','#22395c',{rough:.4,metal:.2,therm:0});
const mMat=pmat('#ffffff','#16263f',{rough:.4,metal:.2,therm:0});
const dataMesh=new THREE.InstancedMesh(crossGeo(0.0008,0.00012,QH),qMat,DATA.length);
const measMesh=new THREE.InstancedMesh(crossGeo(0.00055,0.0001,QH),mMat,MEAS.length);
{const o=new THREE.Object3D();
 DATA.forEach((d,k)=>{o.position.set(d.x,QY,d.z);o.rotation.set(0,0,0);o.scale.setScalar(k===HERO?0:1);o.updateMatrix();dataMesh.setMatrixAt(k,o.matrix);dataMesh.setColorAt(k,new THREE.Color(1,1,1));});
 MEAS.forEach((m,k)=>{o.position.set(m.x,QY,m.z);o.rotation.set(0,Math.PI/4,0);o.scale.setScalar(1);o.updateMatrix();measMesh.setMatrixAt(k,o.matrix);measMesh.setColorAt(k,new THREE.Color(1,1,1));});}
dataMesh.frustumCulled=measMesh.frustumCulled=false;chipG.add(dataMesh,measMesh);
// glow layer (blueprint look)
const NQ=DATA.length+MEAS.length;
const qGlow=(()=>{const g=new THREE.BufferGeometry();const pos=new Float32Array(NQ*3);
  DATA.forEach((d,k)=>pos.set([d.x,0.00003,d.z],k*3));MEAS.forEach((m,k)=>pos.set([m.x,0.00003,m.z],(DATA.length+k)*3));
  g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(NQ*3),3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size:0.0021,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:0}));
  p.frustumCulled=false;chipG.add(p);return p;})();
// couplers, in the four layers of a surface-code cycle
const coupMat=[0,1,2,3].map(()=>new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false}));
[[0,0],[1,0],[0,1],[1,1]].forEach(([di,dj],k)=>{const pts=[];
  for(const m of MEAS){const i=m.pi+di,j=m.pj+dj;if(i<0||i>6||j<0||j>6)continue;pts.push(V(m.x,0.000004,m.z),V((i-3)*A,0.000004,(j-3)*A));}
  chipG.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),coupMat[k]));});
const patchMat=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
const patchLine=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(-1,0,-1),V(1,0,-1),V(1,0,1),V(-1,0,1)]),patchMat);patchLine.position.y=0.000006;chipG.add(patchLine);
const hoverRing=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({length:40},(_,k)=>V(Math.cos(k/40*6.2832)*0.00062,0,Math.sin(k/40*6.2832)*0.00062))),new THREE.LineBasicMaterial({color:'#ffffff',transparent:true,opacity:.95,depthWrite:false}));
hoverRing.position.y=0.000008;hoverRing.visible=false;chipG.add(hoverRing);

/* hero qubit, drawn out in full */
const heroMat=pmat('#ffffff','#1d3557',{rough:.35,metal:.3,therm:0,extra:glow('#59e0ff')});
const trenchMat=pmat('#7a8492','#040a14',{therm:0});
const resMat=pmat('#eef1f6','#12304a',{rough:.4,therm:0,extra:glow('#4fc3ff')});
const drvMat=pmat('#f0d6ba','#3a2010',{rough:.4,therm:0,extra:glow('#ff9a4d')});
const al1=pmat('#f4f2ed','#1d3557',{rough:.4,metal:.3,therm:0,extra:glow('#59e0ff')});
const al2=pmat('#d6d2c9','#2a4a75',{rough:.4,metal:.3,therm:0,extra:glow('#8fe6ff')});
const oxMat=pmat('#cf5f27','#5a2a10',{rough:.5,therm:0,extra:glow('#ffb35c')});
const JZ=-0.00042, J=C.clone().add(V(0,0.0000005,JZ));
{const HB=new Bucket();
 HB.add(box(0.00092,4e-7,0.00022),trenchMat,0,2e-7,0,{edges:false});HB.add(box(0.00022,4e-7,0.00092),trenchMat,0,2e-7,0,{edges:false});
 HB.add(box(0.0008,QH,0.00012),heroMat,0,QY,0);HB.add(box(0.00012,QH,0.0008),heroMat,0,QY,0);
 // readout resonator on the +x side
 HB.add(box(0.00002,QH,0.00026),resMat,0.00049,QY,0);
 for(let k=0;k<5;k++){const x=0.00054+k*0.00005;HB.add(box(0.000014,QH,0.0003),resMat,x,QY,0,{edges:false});
   if(k<4)HB.add(box(0.000064,QH,0.000014),resMat,x+0.000025,QY,(k%2?1:-1)*0.000143,{edges:false});}
 HB.add(box(0.000014,QH,0.00012),resMat,0.00051,QY,0.00009,{edges:false});
 // drive line on the -x side
 HB.add(box(0.00048,QH,0.000014),drvMat,-0.00071,QY,0,{edges:false});HB.add(box(0.000014,QH,0.00008),drvMat,-0.00047,QY,0,{edges:false});
 // couplers to the four neighbours
 for(const sx of [-1,1])for(const sz of [-1,1]) HB.add(box(0.00066,QH,0.00002),M.metal,sx*0.00037,QY,sz*0.00037,{ry:-sx*sz*Math.PI/4,edges:false});
 HB.build(chipG,E,false,false);
 // Josephson junction between the -z arm and the ground plane
 const jG=new THREE.Group();jG.position.set(0,0,JZ);chipG.add(jG);
 const JB=new Bucket(),y0=4e-7;
 JB.add(box(2e-7,1e-7,4e-6),al1,0,y0+0.5e-7,0);
 JB.add(box(2.6e-7,3e-8,2.6e-7),oxMat,0,y0+1.15e-7,0,{edges:false});
 JB.add(box(4e-6,1e-7,2e-7),al2,0,y0+1.8e-7,0);
 JB.add(box(1e-6,1e-7,3e-6),al1,0,y0+0.5e-7,3.5e-6);JB.add(box(4e-6,3e-7,1.5e-5),al1,0,y0+1.5e-7,1.25e-5);
 JB.add(box(3e-6,1e-7,1e-6),al2,3.5e-6,y0+1.8e-7,0);JB.add(box(4e-6,3e-7,1.95e-5),al2,5e-6,y0+1.5e-7,-1.025e-5);
 JB.build(jG,E,false,false);}

/* Bloch sphere above the hero qubit */
const RB=0.00034, BLOCH_Y=0.00066;
const blochG=new THREE.Group();blochG.position.set(0,BLOCH_Y,0);chipG.add(blochG);
const blochMat=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
const blochDim=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
{const pts=[],N=72;for(let k=0;k<N;k++){const a=k/N*Math.PI*2,b=(k+1)/N*Math.PI*2;
   pts.push(V(Math.cos(a),0,Math.sin(a)),V(Math.cos(b),0,Math.sin(b)),V(Math.cos(a),Math.sin(a),0),V(Math.cos(b),Math.sin(b),0),V(0,Math.sin(a),Math.cos(a)),V(0,Math.sin(b),Math.cos(b)));}
 const ring=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),blochMat);ring.scale.setScalar(RB);blochG.add(ring);
 const ax=[V(0,-1,0),V(0,1,0),V(-1,0,0),V(1,0,0),V(0,0,-1),V(0,0,1),V(0,-1,0),V(0,-(BLOCH_Y-0.00001)/RB,0)];
 const axes=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ax),blochDim);axes.scale.setScalar(RB);blochG.add(axes);}
const blochShell=new THREE.Mesh(new THREE.SphereGeometry(RB,40,24),new THREE.MeshBasicMaterial({color:'#4fd1ff',transparent:true,opacity:0,depthWrite:false}));blochG.add(blochShell);
const arrowGeo=new LineGeometry();arrowGeo.setPositions([0,0,0,0,RB,0]);
const arrowMat=new LineMaterial({color:0xffb35c,linewidth:5,transparent:true,opacity:0,depthWrite:false});
const arrow=new Line2(arrowGeo,arrowMat);arrow.frustumCulled=false;blochG.add(arrow);

/* moving points */
function pointsLayer(n,size,color,parent){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial({size,map:dotTex,color,transparent:true,depthWrite:false,opacity:1});const p=new THREE.Points(g,m);p.frustumCulled=false;parent.add(p);return p;}
const tip=pointsLayer(1,0.00022,'#ffe2b0',blochG);
const poles=pointsLayer(2,0.00009,'#d2f7ff',blochG);poles.geometry.attributes.position.array.set([0,RB,0,0,-RB,0]);
const D_LINES=LINES.filter(l=>l.kind==='d'),R_LINES=LINES.filter(l=>l.kind==='r');
const sigD=pointsLayer(D_LINES.length*3,0.05,'#e07a2c',lab);
const sigU=pointsLayer(R_LINES.length*3,0.05,'#3d9bf0',lab);
function linePath(l){const pts=[V(0.05,3.3,RACK_Z),V(0.05,3.3,0.02),V(l.x,PY[0]+0.05,l.z),V(l.x,PY[5]+0.0125,l.z)];const c=[0];for(let i=1;i<pts.length;i++)c.push(c[i-1]+pts[i].distanceTo(pts[i-1]));return {pts,c};}
D_LINES.forEach(l=>l.path=linePath(l));R_LINES.forEach(l=>l.path=linePath(l));
function along(path,u,out){const d=u*path.c[path.c.length-1];let i=1;while(i<path.c.length-1&&d>path.c[i])i++;const t=(d-path.c[i-1])/(path.c[i]-path.c[i-1]);return out.copy(path.pts[i-1]).lerp(path.pts[i],t);}
// heat noise between the plates: crowded and restless at the top, almost none and almost still at the bottom
const NOISE_N=260, NOISE_W=[0.50,0.33,0.13,0.03,0.01], NOISE_SP=[1,0.55,0.22,0.08,0.03];
const noiseSeed=[];
{let g=0,acc=NOISE_W[0];for(let i=0;i<NOISE_N;i++){while(g<4&&i/NOISE_N>=acc){g++;acc+=NOISE_W[g];}noiseSeed.push([rnd(),rnd(),rnd(),rnd(),g]);}}
const noise=(()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(NOISE_N*3),3));
  const col=new Float32Array(NOISE_N*3),c=new THREE.Color();
  noiseSeed.forEach((sd,i)=>{const st=sd[4]+0.5,k=Math.min(4,Math.floor(st));c.copy(TCOL[k]).lerp(TCOL[k+1],st-k);col.set([c.r,c.g,c.b],i*3);});
  g.setAttribute('color',new THREE.BufferAttribute(col,3));
  const p=new THREE.Points(g,new THREE.PointsMaterial({size:0.055,map:dotTex,vertexColors:true,transparent:true,depthWrite:false,opacity:0}));p.frustumCulled=false;lab.add(p);return p;})();
const chipDot=pointsLayer(1,0.11,'#8fe6ff',lab);chipDot.geometry.attributes.position.array.set([0,CY+0.002,0]);chipDot.material.blending=THREE.AdditiveBlending;

/* night grid */
const gridMat=new THREE.LineBasicMaterial({color:'#46c8ff',transparent:true,opacity:0,depthWrite:false});
{const pts=[];for(let i=-60;i<=60;i++){pts.push(V(i,0.07,-60),V(i,0.07,60),V(-60,0.07,i),V(60,0.07,i));}
 lab.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),gridMat));}

/* ================= HALL: many refrigerators, one machine ================= */
const hall=new THREE.Group();scene.add(hall);hall.visible=false;
const HDX=5.5,HDZ=6,HALL_C=V(0,1.5,-6);
const unitT=new THREE.Group();
{const UB=new Bucket();
 UB.add(cyl(.345,.345,1.98,32),M.white,0,1.61,0);UB.add(cyl(.34,.34,.04,32),M.grey,0,2.62,0);
 for(const sx of [-1,1])for(const sz of [-1,1]) UB.add(box(0.09,3.1,0.09),M.grey,sx*FR,FLOOR+1.55,sz*FR);
 for(const s of [-1,1]){UB.add(box(2*FR+0.09,0.09,0.09),M.grey,0,FLOOR+3.1,s*FR);UB.add(box(0.09,0.09,2*FR+0.09),M.grey,s*FR,FLOOR+3.1,0);}
 UB.add(cyl(.085,.085,.26,16),M.light,PTX,2.77,PTZ);UB.add(box(.16,.66,.16),M.dark,0.05,2.97,0.02);
 UB.add(box(.3,.05,3.9),M.light,0.05,3.3,-1.85);UB.add(box(1.92,2.0,0.9),M.white,0.05,FLOOR+1,RACK_Z);UB.add(box(.2,1.27,.12),M.dark,0.05,2.69,RACK_Z);
 UB.build(unitT);}
const hallUnits=[];
for(let m=-3;m<=1;m++)for(let k=-3;k<=3;k++){if(!k&&!m)continue;const g=unitT.clone();g.position.set(k*HDX,0,m*HDZ);g.scale.setScalar(1e-4);hall.add(g);hallUnits.push({g,dist:Math.hypot(k,m)});}
{const fb=new Bucket();fb.add(box(7*HDX+3,0.04,5*HDZ+6),M.pad,0,0.012,-HDZ-1.4,{edges:true});fb.build(hall,E,false,true);}
const linkMat=new THREE.LineBasicMaterial({color:'#6fe0ff',transparent:true,opacity:0,depthWrite:false});
const LINKS=[];
for(let m=-3;m<=1;m++)for(let k=-3;k<3;k++) LINKS.push([V(k*HDX+0.2,3.42,m*HDZ),V((k+1)*HDX-0.1,3.42,m*HDZ)]);
for(let k=-3;k<=3;k++)for(let m=-3;m<1;m++) LINKS.push([V(k*HDX+0.05,3.42,m*HDZ+0.1),V(k*HDX+0.05,3.42,(m+1)*HDZ-3.8)]);
hall.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(LINKS.flat()),linkMat));
const linkP=pointsLayer(LINKS.length,0.55,'#d2f7ff',hall);
const hallDots=pointsLayer(35,1.5,'#8fe6ff',hall);hallDots.material.blending=THREE.AdditiveBlending;
{const a=hallDots.geometry.attributes.position.array;let n=0;for(let m=-3;m<=1;m++)for(let k=-3;k<=3;k++){a.set([k*HDX,1.0,m*HDZ],n*3);n++;}}

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
const BC=C.clone().add(V(0,BLOCH_Y-0.00016,0));
const KEYS=[
  [0.00,V(-1.4,1.55,0.7),13.5,32,22],
  [0.07,V(-0.4,1.55,0.2),12,44,19],
  [0.17,V(0.2,1.6,0),8.6,24,16],
  [0.225,V(0,1.82,0),4.6,16,14],
  [0.30,V(0,1.86,0),3.15,6,13],
  [0.375,V(0,1.86,0),3.05,-10,12],
  [0.425,V(0,1.78,0),2.0,-22,5],
  [0.485,V(0,1.5,0),1.55,-10,3],
  [0.535,V(0,1.12,0),0.78,4,7],
  [0.59,C.clone().add(V(0,0.012,0)),0.2,12,34],
  [0.645,C.clone(),0.052,6,56],
  [0.705,C.clone(),0.036,0,64],
  [0.75,C.clone(),0.0021,-8,50],
  [0.81,C.clone(),0.0017,6,56],
  [0.85,J.clone(),0.0000085,14,44],
  [0.885,J.clone(),0.0000068,22,48],
  [0.925,BC.clone(),0.0031,-6,15],
  [0.995,BC.clone(),0.0029,8,13],
  [1.04,C.clone(),0.043,-10,50],
  [1.10,C.clone(),0.041,0,64],
  [1.225,C.clone(),0.039,8,60],
  [1.275,V(0,1.55,0),9.5,30,22],
  [1.34,HALL_C.clone(),50,38,33],
  [1.44,HALL_C.clone(),56,50,31],
];
function cameraAt(p,out){
  let i=0;while(i<KEYS.length-2&&p>KEYS[i+1][0])i++;
  const K0=KEYS[i],K1=KEYS[i+1];const e=softEase(clamp((p-K0[0])/(K1[0]-K0[0]),0,1));
  const d=Math.exp(lerp(Math.log(K0[2]),Math.log(K1[2]),e));
  const w=Math.abs(K0[2]-K1[2])<1e-12?e:(K0[2]-d)/(K0[2]-K1[2]);
  out.t.copy(K0[1]).lerp(K1[1],w);out.d=d;out.az=lerp(K0[3],K1[3],e);out.el=lerp(K0[4],K1[4],e);return out;
}

/* ---------------- call-outs: [label, world position, from, to] in scroll units ---------------- */
const CP=(x,y,z)=>C.clone().add(V(x,y,z));
const onLine=(a,y)=>V(LR*Math.cos(a*DEG),y,LR*Math.sin(a*DEG));
const CALLOUTS=[
  ['label.cryostat',V(0,2.66,0.3),.06,.19],['label.racks',V(0.05,2.08,RACK_Z),.06,.19],['label.gas',V(GX,1.88,GZ),.06,.19],
  ['label.compressor',V(KX,0.83,KZ),.06,.19],['label.cables',V(0.05,3.34,-1.9),.06,.19],['label.frame',V(FR,3.22,FR),.06,.19],
  ['label.t300',V(PR[0],PY[0],0),.25,.375],['label.t50',V(PR[1],PY[1],0),.25,.375],['label.t4',V(PR[2],PY[2],0),.25,.375],
  ['label.still',V(PR[3],PY[3],0),.25,.375],['label.cp',V(PR[4],PY[4],0),.25,.375],['label.mxc',V(PR[5],PY[5],0),.25,.375],
  ['label.drive',onLine(130,1.86),.415,.49],['label.readout',onLine(30,1.57),.415,.49],['label.atten',onLine(95,PY[3]+0.05),.415,.49],
  ['label.amp',onLine(20,PY[2]+0.065),.415,.49],['label.pulseTube',V(PTX,2.13,PTZ),.415,.49],['label.exchanger',V(0.046,1.33,0),.415,.49],
  ['label.shield',V(0.115,1.1,0),.51,.55],
  ['label.package',V(0,LID_Y+0.003,0.03),.585,.615],['label.stage',V(-0.08,STAGE_Y+0.003,0.05),.585,.635],['label.chipCables',V(0.085,1.05,0.03),.585,.635],
  ['label.dataQ',CP(2*A,0,-A),.655,.715],['label.measQ',CP(-1.5*A,0,1.5*A),.655,.715],['label.pads',CP(0.0092,0,-0.002),.655,.715],
  ['label.island',CP(0,0,0.00028),.755,.82],['label.junction',CP(0,0,JZ),.755,.82],['label.resonator',CP(0.00064,0,0),.755,.82],
  ['label.driveLine',CP(-0.00072,0,0),.755,.82],['label.coupler',CP(0.00048,0,0.00048),.755,.82],
  ['label.alBottom',J.clone().add(V(0,0,1.6e-6)),.852,.89],['label.alTop',J.clone().add(V(-1.5e-6,0,0)),.852,.89],['label.oxide',J.clone(),.852,.89],
  ['label.patch',CP(0,0,-3.5*A),1.105,1.225],
  ['label.fridges',V(HDX,2.7,0),1.33,1.44],['label.links',V(-HDX/2,3.42,-HDZ),1.33,1.44],
].map(([key,pos,a,b])=>({key,pos,a,b}));
const coLayer=document.getElementById('callouts');
CALLOUTS.forEach(c=>{c.el=document.createElement('div');c.el.className='callout';c.el.dataset.copy=c.key;c.el.textContent=txt(c.key);coLayer.appendChild(c.el);});
const patchCallout=CALLOUTS.find(c=>c.key==='label.patch');
let labelsOn=true,labelsT=1;
const labelsBtn=document.getElementById('labelsBtn');
const setLabels=v=>{labelsOn=v;labelsBtn.setAttribute('aria-pressed',v);};
labelsBtn.onclick=()=>setLabels(!labelsOn);
addEventListener('keydown',e=>{const tg=e.target;if(tg&&(tg.isContentEditable||/^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName)))return;if((e.key==='l'||e.key==='L')&&!e.metaKey&&!e.ctrlKey&&!e.altKey)setLabels(!labelsOn);});

/* ---------------- UI state ---------------- */
const QS=new URLSearchParams(location.search);
let look=QS.get('look')||'auto';
const press=(sel,attr,val)=>document.querySelectorAll(sel).forEach(b=>b.setAttribute('aria-pressed',b.dataset[attr]===String(val)));
press('[data-look]','look',look);
document.querySelectorAll('[data-look]').forEach(b=>b.onclick=()=>{look=b.dataset.look;press('[data-look]','look',look);});
const U=1.44;
const maxScroll=()=>document.documentElement.scrollHeight-innerHeight;
document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>scrollTo({top:parseFloat(b.dataset.go)/U*maxScroll(),behavior:'smooth'}));
document.getElementById('toTop').onclick=()=>scrollTo({top:0,behavior:'smooth'});
const cards=[...document.querySelectorAll('.card')].map(el=>({el,a:+el.dataset.a,b:+el.dataset.b}));
const navBtns=[...document.querySelectorAll('[data-go]')];
const scaleVal=document.getElementById('scaleVal'),tempVal=document.getElementById('tempVal'),hint=document.getElementById('hint');
const zeroTag=document.getElementById('zeroTag'),oneTag=document.getElementById('oneTag'),qecTag=document.getElementById('qecTag');
const coarse=matchMedia('(pointer: coarse)').matches;
if(coarse){const h=document.getElementById('qecHint');h.dataset.copy='qec.hint.touch';h.textContent=txt('qec.hint.touch');}

/* ---- the qubit state on the Bloch sphere ---- */
const stateStatus=document.getElementById('stateStatus'),stateTxt=stateStatus.querySelector('span');
const tallyEl=[document.getElementById('tally0'),document.getElementById('tally1')];
const bloch={v:V(0,1,0),from:V(0,1,0),to:null,axis:null,t0:0,busy:false,counts:[0,0],last:null,dur:.5};
const nowS=()=>performance.now()/1000;
function gate(kind){ if(bloch.busy)return; const b=bloch;b.from.copy(b.v);b.t0=nowS();b.busy=true;b.last=null;b.to=null;b.axis=null;b.dur=.5;
  if(kind==='h')b.axis=V(1,1,0).normalize();
  else if(kind==='x')b.axis=V(1,0,0);
  else if(kind==='m'){const p0=clamp((1+b.v.y)/2,0,1);const bit=Math.random()<p0?0:1;b.to=V(0,bit?-1:1,0);b.counts[bit]++;b.last=bit;b.dur=.32;}
  else if(kind==='r'){b.to=V(0,1,0);b.counts=[0,0];b.dur=.32;}
  renderTally();}
function renderTally(){const n=bloch.counts[0]+bloch.counts[1];bloch.counts.forEach((c,i)=>{tallyEl[i].querySelector('i').style.width=(n?c/n*100:0)+'%';tallyEl[i].querySelector('b').textContent=c;});}
function renderState(){const b=bloch;let s,cls='';
  if(b.last!==null){s=txt('state.status.measured',{bit:b.last});cls='warn';}
  else if(Math.abs(b.v.y)>0.999)s=txt('state.status.pole',{bit:b.v.y>0?0:1});
  else{const p0=Math.round((1+b.v.y)/2*100);s=txt('state.status.super',{p0,p1:100-p0});}
  if(stateTxt.textContent!==s)stateTxt.textContent=s;stateStatus.className='status '+cls;}
document.querySelectorAll('[data-gate]').forEach(b=>b.onclick=()=>gate(b.dataset.gate));
renderTally();renderState();

/* ---- error correction on the surface code ---- */
const qecStatus=document.getElementById('qecStatus'),qecTxt=qecStatus.querySelector('span'),qecStats=document.getElementById('qecStats');
const qec={d:+(QS.get('d')||7),flips:new Set(),state:'idle',t0:0,idleAt:0,caught:0,n:0,checks:0,born:nowS(),flash:new Float32Array(DATA.length)};
const patchOf=d=>{const o=(7-d)/2;return {o,hi:o+d-1};};
const dataActive=(k,d)=>{const {o,hi}=patchOf(d),q=DATA[k];return q.i>=o&&q.i<=hi&&q.j>=o&&q.j<=hi;};
const measActive=(m,d)=>{const {o,hi}=patchOf(d),inI=m.pi>=o&&m.pi<=hi-1,inJ=m.pj>=o&&m.pj<=hi-1;if(inI&&inJ)return true;
  const lr=(m.pi===o-1||m.pi===hi)&&inJ,tb=(m.pj===o-1||m.pj===hi)&&inI;return (lr&&m.type==='Z')||(tb&&m.type==='X');};
function syndrome(m,d){if(m.type!=='Z'||!measActive(m,d))return false;let par=0;
  for(const [di,dj] of [[0,0],[1,0],[0,1],[1,1]]){const i=m.pi+di,j=m.pj+dj;if(i<0||i>6||j<0||j>6)continue;const k=dIdx(i,j);if(dataActive(k,d)&&qec.flips.has(k))par^=1;}
  return par===1;}
function renderQec(){const d=qec.d;
  qecStats.innerHTML=`<dt>${escHtml(txt('qec.stat1.label'))}</dt><dd>${escHtml(txt('qec.stat1',{n:2*d*d-1}))}</dd><dt>${escHtml(txt('qec.stat2.label'))}</dt><dd>${escHtml(txt('qec.stat2',{n:(d-1)/2}))}</dd><dt>${escHtml(txt('qec.stat3.label'))}</dt><dd>${escHtml(txt('qec.stat3.d'+d))}</dd>`;
  press('[data-dist]','dist',d);
  const h=d*A/2+0.0002;patchLine.scale.set(h,1,h);patchCallout.pos.set(-h*0.55,CY,-h);}
function setDist(d){qec.d=d;qec.flips.clear();qec.state='idle';qec.idleAt=nowS();renderQec();}
document.querySelectorAll('[data-dist]').forEach(b=>b.onclick=()=>setDist(+b.dataset.dist));
function flipQubit(k,time=nowS()){ if(qec.state==='fail'||k===undefined||k<0||!dataActive(k,qec.d))return;
  if(qec.flips.has(k))qec.flips.delete(k);else qec.flips.add(k);
  if(!qec.flips.size){qec.state='idle';qec.idleAt=time;return;}
  if(qec.state!=='detect'){qec.state='detect';qec.t0=time;}else qec.t0=Math.max(qec.t0,time-0.5);}
renderQec();
COPY.onChange(k=>{if(k.startsWith('label.'))CALLOUTS.forEach(c=>{if(c.key===k)c.w=0;});if(k.startsWith('qec.stat'))renderQec();if(k.startsWith('state.status'))renderState();});

/* ---- pointer ---- */
let ptx=0,pty=0,mx=0,my=0;
const ndc=new THREE.Vector2(9,9),ray=new THREE.Raycaster(),chipPlane=new THREE.Plane(V(0,1,0),-CY),hitP=V(0,0,0);
let hoverId=-1,interactive=false;
addEventListener('pointermove',e=>{ptx=(e.clientX/innerWidth-.5)*2;pty=(e.clientY/innerHeight-.5)*2;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);});
function pickQubit(){ray.setFromCamera(ndc,camera);if(!ray.ray.intersectPlane(chipPlane,hitP))return -1;
  const i=Math.round(hitP.x/A+3),j=Math.round(hitP.z/A+3);if(i<0||i>6||j<0||j>6)return -1;
  if(Math.hypot(hitP.x-(i-3)*A,hitP.z-(j-3)*A)>A*0.46)return -1;const k=dIdx(i,j);return dataActive(k,qec.d)?k:-1;}
canvas.addEventListener('click',e=>{if(!interactive)return;ndc.set(e.clientX/innerWidth*2-1,-(e.clientY/innerHeight)*2+1);const k=pickQubit();if(k>=0)flipQubit(k);});

function resize(){const w=innerWidth,h=innerHeight;arrowMat.resolution.set(w,h);renderer.setSize(w,h,false);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  const pr=renderer.getPixelRatio();lens.uniforms.res.value.set(w*pr,h*pr);lens.uniforms.pr.value=pr;}
addEventListener('resize',resize);resize();

const FORCE_P=QS.has('p')?parseFloat(QS.get('p')):null;
let pS=FORCE_P??0,night=0,last=performance.now(),frames=0;
const cam={t:V(0,0,0),d:1,az:0,el:0};
const tmpC=new THREE.Color(),tmpV=V(0,0,0),pv=V(0,0,0);
const WHITE=new THREE.Color(1,1,1),RED=new THREE.Color('#ff3b30'),AMBER=new THREE.Color('#ffb02e'),
  G_DATA=new THREE.Color('#8fe6ff'),G_MEAS=new THREE.Color('#3a6fb0'),D_OFF=new THREE.Color('#b9bcc0'),M_BASE=new THREE.Color('#c9cdd3'),M_Z=new THREE.Color('#aab6c6');
const arrowArr=arrowGeo.attributes.instanceStart.data;

function fmtLen(m){if(m>=1000)return (m/1000).toFixed(1)+' km';if(m>=1)return m.toFixed(m>=100?0:1)+' m';if(m>=0.01)return (m*100).toFixed(1)+' cm';
  if(m>=0.001)return (m*1000).toFixed(1)+' mm';if(m>=1e-6)return (m*1e6).toFixed(m>=1e-4?0:1)+' µm';return (m*1e9).toFixed(0)+' nm';}
function tempAt(c,opened){if(c.d>5||opened<0.5)return '293 K';const y=c.t.y;
  return y>2.46?'293 K':y>2.14?'50 K':y>1.83?'4 K':y>1.56?'0.8 K':y>1.32?'0.1 K':'0.01 K';}

function frame(now){
  const dt=Math.min(0.05,(now-last)/1000);last=now;const time=now/1000;
  const pT=FORCE_P??clamp(scrollY/Math.max(1,maxScroll()),0,1)*U;
  pS+=(pT-pS)*(1-Math.exp(-dt*(reduceMotion?20:4.5)));
  const p=pS,tt=reduceMotion?0:time;

  /* state curves */
  const nightAuto=sstep(.5,.535,p);
  const nightTarget=look==='auto'?nightAuto:(look==='blueprint'?1:0);
  night+=(nightTarget-night)*(1-Math.exp(-dt*(look==='auto'?14:3.5)));
  if(FORCE_P!==null) night=nightTarget;
  const closeT=1-sstep(1.235,1.27,p);
  const thermal=sstep(.215,.26,p)*(1-sstep(.375,.41,p));
  const canT=CANS.map((c,i)=>sstep(.17+i*.02,.235+i*.02,p)*closeT);
  const shieldT=sstep(.545,.585,p)*closeT,lidT=sstep(.6,.64,p)*closeT;
  const wireT=sstep(.385,.42,p)*(1-sstep(.6,.66,p));
  const chipT=sstep(.6,.65,p)*closeT;
  const blochT=sstep(.885,.92,p)*(1-sstep(.995,1.02,p));
  const gateT=sstep(1.0,1.03,p)*(1-sstep(1.075,1.095,p));
  const qecT=sstep(1.085,1.11,p)*(1-sstep(1.225,1.25,p));
  const hallT=sstep(1.265,1.335,p);

  /* palette */
  const stageCol=st=>{const i=Math.min(4,Math.floor(st));return tmpC.copy(TCOL[i]).lerp(TCOL[i+1],st-i);};
  for(const e of pal){e.m.color.copy(e.day);if(e.stage!==undefined){e.m.color.lerp(stageCol(e.stage),thermal*0.92);if(e.glow.r+e.glow.g+e.glow.b>0)e.m.emissive.copy(e.glow).lerp(tmpC,thermal);}else e.m.color.lerp(THERM,thermal*0.7*e.therm);e.m.color.lerp(e.night,night);}
  plateM.forEach((m,i)=>{tmpC.copy(TCOL[i]);m.color.copy(GOLD).lerp(tmpC,thermal*0.95).lerp(GOLD_NIGHT,night);m.emissive.copy(tmpC);m.emissiveIntensity=thermal*lerp(0.38,0.55,night);});
  for(const m of edgeMats){m.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);m.opacity=lerp(.2,.85,night)*m.userData.k;m.visible=m.opacity>0.003;}
  gridMat.opacity=night*0.08*(1-sstep(0.5,2.5,1/Math.max(cam.d,1e-9)));
  scene.background.copy(DAY_BG).lerp(NIGHT_BG,night);scene.fog.color.copy(scene.background);
  document.body.classList.toggle('night',night>0.5);
  hemi.intensity=lerp(1.3,0.05,night);sun.intensity=lerp(2.4,0,night);
  const beat=0.5+0.5*Math.sin(time*5);
  M.pipeC.emissiveIntensity=M.pipeW.emissiveIntensity=night*0.45;
  {const ci=night*lerp(0.1,0.42,sstep(0.25,1.6,cam.d))*(0.8+0.3*beat);for(const m of COAX)m.emissiveIntensity=ci;}
  M.led.emissiveIntensity=night*3;rackFront.emissiveIntensity=night*(1.2+0.5*beat);
  chipTop.emissiveIntensity=night*(0.85+0.25*Math.sin(time*2.2));
  {const zf=sstep(0.00004,0.0012,cam.d);heroMat.emissiveIntensity=night*(0.03+zf*(0.13+0.05*Math.sin(time*2.2)));
   al1.emissiveIntensity=al2.emissiveIntensity=night*lerp(0.07,0.03,sstep(0.00001,0.0002,cam.d));}
  resMat.emissiveIntensity=drvMat.emissiveIntensity=night*0.3;
  oxMat.emissiveIntensity=night*(1.4+0.8*beat);
  bloom.strength=night*(1.0-0.3*hallT);bloom.threshold=lerp(0.95,0.06,night);

  /* model-kit animations */
  CANS.forEach((c,i)=>{const t=canT[i];c.g.position.y=-t*0.55;c.mat.opacity=1-t;c.mat.depthWrite=t<0.5;c.g.visible=t<0.995;c.ed.userData.k=1-t;});
  shield.position.y=-shieldT*0.2;shieldMat.opacity=1-shieldT;shieldMat.depthWrite=shieldT<0.5;shield.visible=shieldT<0.995;shieldEdge.userData.k=1-shieldT;
  lid.position.set(0,LID_Y+lidT*0.025,0);lidMat.opacity=1-lidT;lidMat.depthWrite=lidT<0.5;lid.visible=lidT<0.995;lidEdge.userData.k=1-lidT;
  wallMat.opacity=1-hallT;wallMat.depthWrite=hallT<0.5;walls.visible=hallT<0.995;wallEdge.userData.k=1-hallT;tileMat.userData.k=0.4*(1-hallT);

  /* signals on the lines */
  {const o=Math.max(wireT,night*0.9)*(1-sstep(0.9,0.3,cam.d))*(1-hallT);sigD.visible=sigU.visible=o>0.01;
   if(sigD.visible){const a=sigD.geometry.attributes.position.array;let k=0;
     D_LINES.forEach((l,n)=>{for(let j=0;j<3;j++){along(l.path,(j/3+tt*0.16+n*0.137)%1,pv);a.set([pv.x,pv.y,pv.z],k*3);k++;}});
     const b=sigU.geometry.attributes.position.array;k=0;
     R_LINES.forEach((l,n)=>{for(let j=0;j<3;j++){along(l.path,1-((j/3+tt*0.11+n*0.21)%1),pv);b.set([pv.x,pv.y,pv.z],k*3);k++;}});
     sigD.geometry.attributes.position.needsUpdate=sigU.geometry.attributes.position.needsUpdate=true;
     sigD.material.opacity=o;sigU.material.opacity=o*0.9;
     sigD.material.color.set(night>.5?'#ffb35c':'#e07a2c');sigU.material.color.set(night>.5?'#6fd6ff':'#2f7fc1');
     sigD.material.size=sigU.material.size=clamp(cam.d*0.02,0.012,0.11);}}
  /* heat noise, paced by the stage it sits in */
  {const o=thermal;noise.visible=o>0.01;
   if(noise.visible){const a=noise.geometry.attributes.position.array;
     for(let i=0;i<NOISE_N;i++){const [s1,s2,s3,s4,g]=noiseSeed[i],sp=NOISE_SP[g];
       const yT=PY[g]-PT[g]/2-0.012,yB=PY[g+1]+PT[g+1]/2+0.012,amp=0.004+0.014*Math.sqrt(sp),f=1+13*sp;
       const ang=s1*6.283+tt*sp*(0.5+s3)*1.7,r=0.03+s2*(PR[g+1]+0.03),y=lerp(yB,yT,(s4+tt*sp*0.5*(s3-.5)+10)%1);
       a.set([r*Math.cos(ang)+Math.sin(tt*f*(0.7+s3)+i)*amp,y+Math.sin(tt*f*(0.6+s2)+i*1.7)*amp,r*Math.sin(ang)+Math.cos(tt*f*(0.8+s1)+i*2.3)*amp],i*3);}
     noise.geometry.attributes.position.needsUpdate=true;noise.material.opacity=o*lerp(0.9,1,night);noise.material.blending=night>.5?THREE.AdditiveBlending:THREE.NormalBlending;}}
  chipDot.material.opacity=night*sstep(0.12,0.5,cam.d)*(1-hallT)*(0.7+0.3*beat);chipDot.visible=chipDot.material.opacity>0.01;
  chipDot.material.size=clamp(cam.d*0.035,0.02,0.2);

  /* ---- qubits on the chip ---- */
  const dAct=qecT>0.4?qec.d:7;
  if(qecT>0.3){
    if(qec.state==='idle'&&time-qec.idleAt>2.4&&document.visibilityState==='visible'){const act=DATA.map((q,k)=>k).filter(k=>dataActive(k,qec.d)&&k!==hoverId);flipQubit(act[Math.floor(Math.random()*act.length)],time);}
    if(qec.state==='detect'&&time-qec.t0>1.15){qec.n=qec.flips.size;
      if(qec.n<=(qec.d-1)/2){for(const k of qec.flips)qec.flash[k]=1;qec.caught+=qec.n;qec.flips.clear();qec.state='fixed';}else qec.state='fail';qec.t0=time;}
    else if(qec.state==='fixed'&&time-qec.t0>1.2){qec.state='idle';qec.idleAt=time;}
    else if(qec.state==='fail'&&time-qec.t0>2.8){qec.flips.clear();qec.state='idle';qec.idleAt=time;}
  }
  const failing=qec.state==='fail'&&qecT>0.3;
  if(chipT>0.002){
    const gc=qGlow.geometry.attributes.color.array,gph=0.5+0.5*Math.sin(time*3.1);let checks=0;
    DATA.forEach((q,k)=>{const act=dataActive(k,dAct),fl=qecT>0.3&&qec.flips.has(k);qec.flash[k]=Math.max(0,qec.flash[k]-dt*1.6);
      // model colour
      tmpC.copy(act?WHITE:D_OFF);if(fl||(failing&&act))tmpC.lerp(RED,failing?0.55+0.4*beat:0.92);tmpC.lerp(G_DATA,qec.flash[k]*0.6);dataMesh.setColorAt(k,tmpC);
      // glow colour
      if(k===HERO&&cam.d<0.012){gc[k*3]=gc[k*3+1]=gc[k*3+2]=0;return;}
      const tw=gateT>0.01?0.6+0.4*Math.sin(time*4+q.i*1.3+q.j*2.1):1;
      tmpC.copy(G_DATA).multiplyScalar(act?0.55*lerp(1,tw,gateT):0.07);if(fl||(failing&&act))tmpC.copy(RED).multiplyScalar(failing?0.6+0.6*beat:1.25);
      tmpC.lerp(WHITE,qec.flash[k]);gc[k*3]=tmpC.r;gc[k*3+1]=tmpC.g;gc[k*3+2]=tmpC.b;});
    MEAS.forEach((m,k)=>{const act=measActive(m,dAct),lit=qecT>0.3&&syndrome(m,qec.d);if(lit)checks++;
      tmpC.copy(act?(m.type==='Z'?M_Z:M_BASE):D_OFF);if(lit)tmpC.copy(AMBER);if(failing&&act)tmpC.lerp(RED,0.3+0.3*beat);measMesh.setColorAt(k,tmpC);
      const n=DATA.length+k;tmpC.copy(G_MEAS).multiplyScalar(act?0.5+0.25*gph*Math.max(gateT,qecT):0.06);if(lit)tmpC.copy(AMBER).multiplyScalar(1.3);
      gc[n*3]=tmpC.r;gc[n*3+1]=tmpC.g;gc[n*3+2]=tmpC.b;});
    qec.checks=checks;
    dataMesh.instanceColor.needsUpdate=measMesh.instanceColor.needsUpdate=true;qGlow.geometry.attributes.color.needsUpdate=true;
    qGlow.material.opacity=night*chipT*sstep(0.004,0.02,cam.d);qGlow.visible=qGlow.material.opacity>0.01;
    const ph=(tt*0.8)%1,run=Math.max(gateT,qecT);
    coupMat.forEach((m,k)=>{const pulse=Math.max(0,1-Math.abs(ph*4-k-0.5)*2);m.opacity=chipT*(0.16+run*(0.1+0.6*pulse))*sstep(0.003,0.02,cam.d);m.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);m.visible=m.opacity>0.01;});
  } else {qGlow.visible=false;coupMat.forEach(m=>m.visible=false);}
  patchMat.opacity=qecT*(failing?0.5+0.5*beat:0.8);patchMat.color.copy(failing?RED:tmpC.copy(EDGE_DAY).lerp(EDGE_NIGHT,night));patchLine.visible=qecT>0.01;
  interactive=qecT>0.6;
  hoverId=interactive&&!coarse?pickQubit():-1;
  hoverRing.visible=hoverId>=0&&qec.state!=='fail';if(hoverRing.visible)hoverRing.position.set(DATA[hoverId].x,0.000008,DATA[hoverId].z);
  hoverRing.material.color.set(night>.5?'#ffffff':'#1c1b19');
  canvas.style.cursor=hoverRing.visible?'pointer':'';
  if(qecT>0.05){const d=qec.d,vars={cycles:Math.floor((time-qec.born)*909000).toLocaleString('en-US'),caught:qec.caught,n:qec.state==='detect'?qec.flips.size:qec.n,checks:qec.checks,d};
    const key={idle:'run',detect:'detect',fixed:'fixed',fail:'fail'}[qec.state],s=txt('qec.status.'+key,vars);
    if(qecTxt.textContent!==s)qecTxt.textContent=s;qecStatus.className='status '+({detect:'warn',fail:'bad'}[qec.state]||'');}

  /* ---- Bloch sphere ---- */
  blochG.visible=blochT>0.002;
  if(blochG.visible){const b=bloch;
    if(b.busy){const k=clamp((nowS()-b.t0)/b.dur,0,1),e=k*k*(3-2*k);
      if(b.axis)b.v.copy(b.from).applyAxisAngle(b.axis,Math.PI*e);else b.v.copy(b.from).lerp(b.to,e);
      if(k>=1){b.busy=false;b.v.set(Math.abs(b.v.x)<1e-6?0:b.v.x,Math.abs(b.v.y)<1e-6?0:b.v.y,Math.abs(b.v.z)<1e-6?0:b.v.z);if(b.v.lengthSq()>0)b.v.normalize();renderState();}}
    const a=arrowArr.array;a[3]=b.v.x*RB;a[4]=b.v.y*RB;a[5]=b.v.z*RB;arrowArr.needsUpdate=true;
    tip.geometry.attributes.position.array.set([b.v.x*RB,b.v.y*RB,b.v.z*RB]);tip.geometry.attributes.position.needsUpdate=true;
    const lc=tmpC.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);
    blochMat.color.copy(lc);blochDim.color.copy(lc);blochMat.opacity=blochT*lerp(.55,.7,night);blochDim.opacity=blochT*0.3;
    blochShell.material.opacity=blochT*lerp(.10,.05,night);blochShell.material.color.set(night>.5?'#4fd1ff':'#2f7fc1');
    arrowMat.opacity=blochT;arrowMat.color.set(night>.5?0xffb35c:0xcf5f27);tip.material.opacity=blochT;tip.material.color.set(night>.5?'#ffe2b0':'#cf5f27');
    poles.material.opacity=blochT;poles.material.color.set(night>.5?'#d2f7ff':'#5f5b54');
  }

  /* ---- hall ---- */
  hall.visible=hallT>0.002;
  if(hall.visible){
    for(const u of hallUnits){const s=sstep(u.dist*0.1,u.dist*0.1+0.45,hallT);u.g.scale.setScalar(Math.max(1e-4,s));u.g.visible=s>0.001;}
    const ph=(tt*0.35)%1;
    linkMat.opacity=hallT*hallT*lerp(.35,.5,night);linkMat.color.copy(EDGE_DAY).lerp(EDGE_NIGHT,night);
    const a=linkP.geometry.attributes.position.array;LINKS.forEach(([s,e],k)=>{pv.copy(s).lerp(e,(ph+k*0.173)%1);a.set([pv.x,pv.y,pv.z],k*3);});
    linkP.geometry.attributes.position.needsUpdate=true;linkP.material.opacity=sstep(.7,1,hallT);linkP.material.color.set(night>.5?'#d2f7ff':'#2f7fc1');
    hallDots.material.opacity=night*sstep(.75,1,hallT)*(0.65+0.25*beat);
  }

  /* camera */
  cameraAt(p,cam);cam.d*=clamp(Math.sqrt(1.5/camera.aspect),1,1.9);   // step back on narrow screens
  mx+=(ptx-mx)*(1-Math.exp(-dt*2));my+=(pty-my)*(1-Math.exp(-dt*2));
  const sway=reduceMotion?0:1;
  const az=(cam.az+sway*(Math.sin(time*.13)*1.2+mx*2.2))*DEG,el=clamp(cam.el+sway*(Math.sin(time*.1)*.6-my*1.6),1,88)*DEG;
  camera.position.set(cam.t.x+cam.d*Math.cos(el)*Math.sin(az),cam.t.y+cam.d*Math.sin(el),cam.t.z+cam.d*Math.cos(el)*Math.cos(az));
  camera.lookAt(cam.t);
  if(!isMobile&&!QS.has('noshift')){const w=innerWidth,h=innerHeight;camera.setViewOffset(w,h,-w*0.13,0,w,h);}
  else if(isMobile){const w=innerWidth,h=innerHeight;camera.setViewOffset(w,h,0,h*lerp(-0.15,0.17,sstep(0.03,0.08,p)),w,h);}
  camera.near=cam.d*0.02;camera.far=cam.d*60+60;camera.updateProjectionMatrix();
  {const fk=sstep(0.02,0.6,cam.d);scene.fog.near=cam.d*1.6+2*fk;scene.fog.far=cam.d*8+40*fk;}

  /* shadow frustum follows the subject */
  const s=clamp(cam.d*1.1,0.5,60);const L=cam.d*3+12;
  sun.target.position.copy(cam.t);sun.position.copy(cam.t).addScaledVector(SUN_DIR,L);
  const sc=sun.shadow.camera;sc.left=-s;sc.right=s;sc.top=s;sc.bottom=-s;sc.near=Math.max(0.01,L-s*2.5);sc.far=L+s*2.5;sc.updateProjectionMatrix();
  sun.shadow.normalBias=s*0.0015;

  /* lens */
  lens.uniforms.amount.value=(0.3+0.35*sstep(4,14,cam.d))*(1-0.4*night)*(1-thermal*0.7)*(1-blochT)*(1-qecT*0.7);
  lens.uniforms.vign.value=lerp(.28,.65,night);

  /* call-outs */
  labelsT+=((labelsOn?1:0)-labelsT)*(1-Math.exp(-dt*8));
  const cardRects=cards.filter(c=>+c.el.style.opacity>0.3).map(c=>c.el.getBoundingClientRect());
  for(const c of CALLOUTS){
    let o=labelsT*sstep(c.a,c.a+0.012,p)*(1-sstep(c.b-0.012,c.b,p));
    if(o<0.01){if(c.vis){c.el.style.opacity=0;c.vis=false;}continue;}
    tmpV.copy(c.pos).project(camera);
    if(tmpV.z>1||Math.abs(tmpV.x)>1.05||Math.abs(tmpV.y)>1.05){if(c.vis){c.el.style.opacity=0;c.vis=false;}continue;}
    const sx=(tmpV.x+1)/2*innerWidth,sy=(1-tmpV.y)/2*innerHeight;
    if(!c.w)c.w=c.el.offsetWidth||120;
    const Lx=sx-c.w/2-6,Rx=sx+c.w/2+6,T=sy-52,Bm=sy+6;
    let clash=T<62||Lx<8||Rx>innerWidth-8||(Rx>innerWidth-150&&Math.abs(sy-innerHeight/2)<110)||(Lx<230&&Bm>innerHeight-110);
    for(const r of cardRects){if(Rx>r.left&&Lx<r.right&&Bm>r.top&&T<r.bottom){clash=true;break;}}
    c.fade=(c.fade??1)+((clash?0:1)-(c.fade??1))*(1-Math.exp(-dt*10));o*=c.fade;
    c.vis=true;c.el.style.opacity=o;c.el.style.left=sx+'px';c.el.style.top=sy+'px';
  }
  /* HUD */
  for(const c of cards){const o=sstep(c.a,c.a+0.018,p)*(1-sstep(c.b-0.018,c.b,p));c.el.style.opacity=o;c.el.style.transform=`translateY(calc(${isMobile?'0px':'-50%'} + ${(1-o)*18}px))`;c.el.classList.toggle('on',o>.5);}
  hint.style.opacity=1-sstep(.005,.03,p);
  let on=0;navBtns.forEach((b,i)=>{if(p>=parseFloat(b.dataset.go)-0.03)on=i;});navBtns.forEach((b,i)=>b.classList.toggle('on',i===on));
  const fw=2*cam.d*Math.tan(camera.fov*Math.PI/360)*camera.aspect;
  scaleVal.textContent='≈ '+fmtLen(fw);
  const tv=tempAt(cam,canT[0]);if(tempVal.textContent!==tv)tempVal.textContent=tv;
  const placeTag=(el,v,o)=>{if(o<=0.01){el.style.opacity=0;return;}tmpV.copy(v).project(camera);if(tmpV.z>1){el.style.opacity=0;return;}el.style.left=((tmpV.x+1)/2*innerWidth)+'px';el.style.top=((1-tmpV.y)/2*innerHeight)+'px';el.style.opacity=o;};
  placeTag(zeroTag,pv.copy(C).add(tmpV.set(0,BLOCH_Y+RB,0)),blochT);placeTag(oneTag,pv.copy(C).add(tmpV.set(0,BLOCH_Y-RB,0)),blochT);
  {const show=qecT>0.3&&(qec.state==='fail'||qec.state==='fixed');
   if(show){const s=txt(qec.state==='fail'?'qec.tag.fail':'qec.tag.fixed');if(qecTag.textContent!==s)qecTag.textContent=s;qecTag.className='tag '+(qec.state==='fail'?'fail':'ok');
     placeTag(qecTag,pv.set(0,CY,qec.d*A/2+0.0021),qecT*(qec.state==='fixed'?1-sstep(.6,1.2,time-qec.t0):1));}else qecTag.style.opacity=0;}

  composer.render(dt);
  if(++frames===3){document.getElementById('veil').classList.add('gone');window.__ready=true;}
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
if(QS.has('debug')) window.__demo={qec,bloch,gate,flipQubit,setDist,screen:k=>{const v=V(DATA[k].x,0,DATA[k].z).add(C).project(camera);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight];}};
