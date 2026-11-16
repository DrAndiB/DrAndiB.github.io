/* Machine definition: Boulton & Watt rotative beam engine of the 1780s. Used with exploded.js. */
import { THREE, TAU, PI, DEG, lerp, clamp, smooth, revolve, merge, mx, my, mz } from '../exploded.js';

/* Layout in metres. X runs along the beam, Y is up, Z points at the viewer. */
const O = [0, 4.0], R = 2.1, LNK = .9, RB = R / 2;        // beam pivot, half length, link length, bridle rod length
const S = [2.1, 1.0], RHO = .61, LC = 3.0, GR = .305, NT = 24;   // flywheel shaft, planet orbit radius, connecting rod, gears
const CX = -R, CB = [-R, O[1] - LNK];                     // cylinder axis, fixed pivot of the bridle rods
const XV = -1.6, XP = -1.05, CD = [-1.27, -.22];          // valve chest, air pump, condenser (x, z)

const vlathe = (pts, x = 0, z = 0, o) => revolve(pts, o).rotateZ(PI / 2).translate(x, 0, z);            // [[y, r], ...] around a vertical axis
const zring = (z0, z1, r0, r1, x = 0, y = 0) => revolve([[z0, r0], [z1, r0], [z1, r1], [z0, r1]]).rotateY(-PI / 2).translate(x, y, 0);
const box = (sx, sy, sz, x, y, z = 0) => new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z);
const vcyl = (r, y0, y1, x, z = 0, s = 20) => new THREE.CylinderGeometry(r, r, y1 - y0, s).translate(x, (y0 + y1) / 2, z);
const zcyl = (r, z0, z1, x, y, s = 20) => new THREE.CylinderGeometry(r, r, z1 - z0, s).rotateX(PI / 2).translate(x, y, (z0 + z1) / 2);
const xcyl = (r, x0, x1, y, z = 0, s = 16) => new THREE.CylinderGeometry(r, r, x1 - x0, s).rotateZ(PI / 2).translate((x0 + x1) / 2, y, z);
const bar = (len, w, t) => merge([box(w, len, t, 0, len / 2, 0), zcyl(w * .8, -t * .7, t * .7, 0, 0, 14), zcyl(w * .8, -t * .7, t * .7, 0, len, 14)]);   // link along +Y from its origin
const slant = (x0, y0, x1, y1, w, t, z) => { const dx = x1 - x0, dy = y1 - y0; return new THREE.BoxGeometry(w, Math.hypot(dx, dy), t).rotateZ(Math.atan2(dy, dx) - PI / 2).translate((x0 + x1) / 2, (y0 + y1) / 2, z); };
const tube = (pts, r) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), 40, r, 10, false);
function gear(rp, n, w) {
  const sh = new THREE.Shape(), p = TAU / n, rr = rp - .03, rt = rp + .027;
  for (let k = 0; k < n; k++) {
    const a = k * p;
    for (const [r, da] of [[rr, -.3], [rt, -.13], [rt, .13], [rr, .3]]) { const x = r * Math.cos(a + da * p), y = r * Math.sin(a + da * p); k === 0 && da === -.3 ? sh.moveTo(x, y) : sh.lineTo(x, y); }
  }
  sh.closePath();
  for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + .3, h = new THREE.Path(); h.absarc(rp * .56 * Math.cos(a), rp * .56 * Math.sin(a), rp * .19, 0, TAU, true); sh.holes.push(h); }
  return new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -w / 2);
}

const P = (id, name, group, kind, ext, at, dir, len, text, specs, view) => ({ id, name, group, kind, ext, label: { at, dir, len }, text, specs, view });
const PARTS = [
  P('steam', 'Steam pipe and throttle', 'Steam and cylinder', 's', true, [XV, 2.11, -1.1], [-.5, .6, -.6], [.5, .4],
    ['Brings steam from the boiler, which stood in its own house and is not shown. The steam is only slightly above atmospheric pressure, far gentler than in any later engine.',
     'A butterfly valve in the pipe, the throttle, limits how much steam reaches the cylinder. The governor moves it.'],
    [['Steam pressure', 'A few tenths of a bar above atmosphere'], ['Throttle', 'Butterfly valve'], ['Moved by', 'Governor']]),
  P('chest', 'Valve chest', 'Steam and cylinder', 's', true, [XV, 2.18, .13], [.2, .5, .85], [.6, .4],
    ['Two valve boxes, one at the top of the cylinder and one at the bottom, joined by upright pipes. Each box holds a steam valve and an exhaust valve.',
     'They let steam in above the piston while the space below is opened to the condenser, then swap. Pushing the piston in both directions made the engine double-acting, which Watt patented in 1782.'],
    [['Valves', '4'], ['Double-acting', 'Patented 1782'], ['Worked by', 'Plug rod']]),
  P('plug', 'Plug rod', 'Steam and cylinder', 'a', true, [XV, 3.4, .36], [.3, .2, .93], [.7, .4],
    ['A rod that hangs from the beam and rises and falls with it. Pegs on the rod knock the valve handles over near the end of each stroke, so the engine times its own valves.',
     'This self-acting valve gear was inherited from the Newcomen engines of the early 1700s.'],
    [['Driven by', 'Beam'], ['Also called', 'Plug tree']]),
  P('cyl', 'Cylinder', 'Steam and cylinder', 's', true, [-2.41, 1.5, 0], [-1, .1, .2], [.5, .4],
    ['The working cylinder, closed at both ends. Steam drives the piston down and then up again.',
     'Watt kept it hot at all times. A steam-filled jacket surrounds the bore, so fresh steam does not waste its heat warming cold iron. Together with the separate condenser this cut coal use to less than a third of what the older Newcomen engines burned.'],
    [['Bore', '18¾ in (0.48 m)'], ['Stroke', '4 ft (1.22 m)'], ['Kept hot by', 'Steam jacket']]),
  P('cover', 'Cylinder cover', 'Steam and cylinder', 's', true, [-2.38, 2.26, .27], [-.8, .5, .3], [.5, .35],
    ['Closes the top of the cylinder so that steam can also press on the upper face of the piston. Newcomen\'s cylinder was open to the air.',
     'The piston rod passes through a stuffing box, a collar packed with greased rope that keeps the steam in.'],
    [['Seal', 'Stuffing box'], ['Packing', 'Greased hemp rope']]),
  P('piston', 'Piston and rod', 'Steam and cylinder', 'a', true, [CX, 2.75, .03], [-.9, .3, .3], [.6, .4],
    ['A cast-iron disc sealed against the bore with hemp packing and tallow. It has low-pressure steam on one side and a vacuum on the other.',
     'Most of the push comes from the vacuum that the condenser creates, not from the steam pressure itself.'],
    [['Working pressure difference', '≈ 0.7 bar'], ['Travel', '1.22 m each way'], ['Packing', 'Hemp and tallow']]),
  P('cond', 'Separate condenser', 'Condensing', 's', false, [CD[0], .64, CD[1]], [-.1, .75, -.65], [1.0, .4],
    ['Watt\'s key invention, conceived in 1765 and patented in 1769. Spent steam is drawn out of the cylinder into this cold vessel, where a jet of water turns it back into water and leaves a vacuum behind.',
     'Because the condensing happens here, the cylinder never has to be cooled.'],
    [['Idea', '1765'], ['Patent', '1769'], ['Cooled by', 'Cold-water jet']]),
  P('pump', 'Air pump', 'Condensing', 'a', true, [XP, .95, .17], [.4, .6, .7], [.7, .4],
    ['Worked from the beam, it draws the condensed steam, the injection water and any air that has leaked in out of the condenser. Without it the vacuum would be gone within a few strokes.',
     'The warm water it lifts out was fed back to the boiler.'],
    [['Driven by', 'Beam, at half the piston stroke'], ['Removes', 'Water and air']]),
  P('cistern', 'Cold-water cistern', 'Condensing', 's', true, [-1.0, .4, .5], [.2, -.2, .96], [.6, .4],
    ['A tank of cold water in which the condenser and the air pump stand. It keeps both cold and supplies the injection jet.'],
    [['Holds', 'Condenser and air pump'], ['Built of', 'Timber']]),
  P('pmotion', 'Parallel motion', 'Beam and motion', 'a', true, [-1.58, 3.1, .3], [-.5, .35, .8], [.7, .45],
    ['A set of jointed links that guides the top of the piston rod in a nearly straight line while the beam end swings in an arc. The chains used before could only pull. Rigid links can push as well, which a double-acting engine needs.',
     'Watt patented it in 1784 and said he was prouder of it than of any other mechanical invention he had made.'],
    [['Patented', '1784'], ['Also guides', 'Air-pump rod']]),
  P('beam', 'Beam', 'Beam and motion', 'a', true, [.9, 4.21, 0], [.1, 1, .1], [.45, .4],
    ['Rocks on its central pivot and carries the piston\'s push across to the connecting rod. Early beams were timber strapped with iron, as shown here. Cast iron came later.'],
    [['Length', '≈ 4.3 m (model)'], ['Swing', '≈ ±17°']]),
  P('rod', 'Connecting rod', 'Beam and motion', 'a', true, [2.1, 2.9, .04], [.7, .2, .68], [.7, .45],
    ['Hangs from the beam and passes its rocking down to the gears. A plain crank would have done the job, but a rival patent covered the crank on steam engines, so Boulton &amp; Watt found another way.'],
    [['Length', '≈ 3 m (model)'], ['Carries', 'Planet gear']], [.4, .2]),
  P('planet', 'Planet gear', 'Beam and motion', 'a', true, [2.71, 1.0, -.05], [.6, -.3, .74], [.7, .45],
    ['A gear bolted rigidly to the foot of the connecting rod. It cannot spin. It is carried round the sun gear instead, and a loose link keeps the two in mesh.',
     'The arrangement was devised by William Murdoch at Boulton &amp; Watt and patented by Watt in October 1781.'],
    [['Patented', '1781'], ['Devised by', 'William Murdoch'], ['Fixed to', 'Connecting rod']], [.4, .2]),
  P('sun', 'Sun gear', 'Beam and motion', 'b', true, [2.1, 1.0, -.05], [-.35, -.5, .8], [.8, .45],
    ['Fixed on the flywheel shaft. As the planet circles it, the sun is driven round. With two gears of equal size the shaft makes two turns for every down-and-up cycle of the piston.',
     'The doubling was welcome, because factory machinery wanted more speed than a slow beam could give.'],
    [['Shaft turns', '2 per piston cycle'], ['Teeth', '24 (model)']], [.4, .2]),
  P('shaft', 'Flywheel shaft and bearings', 'Beam and motion', 'b', true, [2.1, 1.11, -.42], [.9, .35, .2], [1.0, .45],
    ['Carries the sun gear, the flywheel and the pulley for the governor belt. From here the engine\'s power went to the line shafts of the factory.'],
    [['Bearings', 'Brass, on masonry'], ['Drives', 'Factory line shafts']], [.5, .22]),
  P('fly', 'Flywheel', 'Beam and motion', 'b', true, [3.44, 2.34, -.82], [.6, .6, .5], [.5, .4],
    ['A heavy wheel that stores energy. The piston pushes in surges and not at all at the ends of its stroke. The flywheel smooths this into steady rotation.'],
    [['Diameter', '≈ 3.8 m (model)'], ['Turns', '2 per piston cycle']], [.5, .22]),
  P('gov', 'Centrifugal governor', 'Control and structure', 'b', true, [.95, 2.52, -.3], [.1, 1, .3], [.6, .4],
    ['Two balls spin with the engine. If it speeds up they swing outward, lift a sleeve and, through a long rod, close the throttle a little. If it slows they drop and open it.',
     'Watt adapted the idea from windmills. The 1788 Lap Engine was the first steam engine fitted with one, and it is an early example of automatic feedback control.'],
    [['First fitted', '1788'], ['Driven by', 'Belt from the flywheel shaft'], ['Acts on', 'Throttle valve']]),
  P('frame', 'Frame and foundations', 'Control and structure', 's', true, [0, 1.6, .61], [.25, -.1, .96], [.7, .5],
    ['Timber posts carry the beam pivot four metres above the floor. Masonry carries the cylinder and the shaft bearings, and a pit gives the flywheel room to turn.',
     'Many early engines had no frame of their own. The walls of the engine house did the job.'],
    [['Beam pivot height', '4 m (model)'], ['Flywheel', 'Runs in a pit']]),
];

export default {
  docTitle: 'Beam Engine Exploded View',
  eyebrow: 'Exploded · Plate 02', title: 'Beam Engine', sub: 'Watt\'s rotative steam engine of the 1780s, taken apart into 18 assemblies',
  facts: [{ k: 'Cylinder', v: '0.48 × 1.22 m', tip: 'Bore and stroke of the 1788 Lap Engine' }, { k: 'Power', v: '≈ 10 hp' }, { k: 'Flywheel', v: '2 turns per cycle' }],
  note: 'Illustrative model built from simple geometry. Bore, stroke and power follow Boulton & Watt\'s Lap Engine of 1788 in the Science Museum, London. Framing, valve gear and many details are simplified, speeds are typical values, and the boiler is not shown.',
  kinds: { a: { short: 'Rocking', label: 'Reciprocating' }, b: { short: 'Turning', label: 'Rotating' }, s: { short: 'Static', label: 'Static' } },
  groups: ['Steam and cylinder', 'Condensing', 'Beam and motion', 'Control and structure'],
  parts: PARTS,
  controls: { run: 'Engine', power: 'Throttle', flow: 'Steam', powerDefault: .5 },
  gauges: [{ label: 'Flywheel rpm', color: 'var(--n2)', arc: true }, { label: 'Piston cycles / min', color: 'var(--n1)', arc: true }, { label: 'Power hp' }],
  gaugeNote: 'Motion shown at real speed',
  camera: { az: -.5, el: .2, paz: -.78, pel: .3, focus: [-.3, .16] },
  materials(std, phy) {
    const wood = rot => {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d'); let s = 7;
      const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      g.fillStyle = '#8c6b46'; g.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 90; i++) { const y = rnd() * 256; g.strokeStyle = rnd() < .6 ? `rgba(70,48,26,${.08 + rnd() * .22})` : `rgba(190,156,112,${.06 + rnd() * .16})`; g.lineWidth = .6 + rnd() * 2.4;
        g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + rnd() * 8 - 4, 170, y + rnd() * 8 - 4, 256, y + rnd() * 6 - 3); g.stroke(); }
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; if (rot) { t.center.set(.5, .5); t.rotation = PI / 2; } return t;
    };
    return {
      timberH: std(0xffffff, 0, .82, { map: wood(false) }), timberV: std(0xffffff, 0, .82, { map: wood(true) }),
      iron: std(0x596068, .85, .46), ironDark: std(0x353a40, .8, .52),
      green: phy(0x2f7052, .35, .42, { clearcoat: .5, clearcoatRoughness: .3 }),
      stone: std(0x6b6862, 0, .96), stoneDark: std(0x86817a, 0, .96),
      rope: std(0xbca67e, 0, .9), leather: std(0x5d412b, 0, .85),
      water: phy(0x3c86b5, 0, .12, { transparent: true, opacity: .45 }),
    };
  },

  build(ctx) {
    const { add, piece, byId, scene } = ctx;
    const CUT0 = [[0, 0, -1, 0, 0, 0]], CUTC = [[0, 0, -1, 0, 0, CD[1]]];     // cutaway removes the front half
    const sub = (pc, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); pc.inner.add(g); return g; };
    const into = (g, mesh) => { g.add(mesh); return mesh; };
    const M4 = () => new THREE.Matrix4();

    /* 18 frame and foundations (static base, never moves) */
    { const pc = piece('frame');
      add(pc, merge([box(3.2, 1, 2.9, -1.5, -.5, -.45), box(4.1, 1, 1.57, 2.15, -.5, .215), box(4.1, 1, .65, 2.15, -.5, -1.575), box(4.1, .05, .68, 2.15, -.975, -.91)]), 'stone');
      add(pc, merge([box(1.2, .7, .3, S[0], .35, -.42), box(1.2, .7, .3, S[0], .35, -1.4), box(.95, .66, .95, CX, .33, 0)]), 'stoneDark');
      add(pc, merge([box(.26, 3.78, .22, 0, 1.89, .5), box(.26, 3.78, .22, 0, 1.89, -.5), box(.22, 3.19, .2, -2.75, 1.595, .5), box(.22, 3.19, .2, -2.75, 1.595, -.5),
        slant(.6, 0, 0, 2.0, .16, .16, .5), slant(.6, 0, 0, 2.0, .16, .16, -.5)]), 'timberV');
      add(pc, merge([box(2.9, .18, .18, -1.31, 3.1, .5), box(2.9, .18, .18, -1.31, 3.1, -.5), box(.2, .16, 1.18, -2.75, 3.27, 0), box(.2, .16, .78, 0, 3.3, 0)]), 'timberH');
      add(pc, merge([box(.4, .2, .24, 0, 3.88, .5), box(.4, .2, .24, 0, 3.88, -.5), box(.22, .07, .24, 0, 4.045, .5), box(.22, .07, .24, 0, 4.045, -.5),
        box(.1, .1, .12, CB[0], CB[1], .355), box(.1, .1, .12, CB[0], CB[1], -.355), zcyl(.022, .26, .42, CB[0], CB[1], 10), zcyl(.022, -.42, -.26, CB[0], CB[1], 10)]), 'iron'); }

    /* 11 beam */
    let beamG;
    { const pc = piece('beam', { moves: [my(1.9, .05, .5)] }); beamG = sub(pc, O[0], O[1]);
      into(beamG, add(pc, box(4.3, .42, .26, 0, 0, 0), 'timberH'));
      into(beamG, add(pc, merge([-1.75, -.9, 0, .9, 1.75].map(x => box(.07, .45, .29, x, 0, 0)).concat([box(.14, .46, .3, -R, 0, 0), box(.14, .46, .3, R, 0, 0)])), 'iron'));
      into(beamG, add(pc, merge([zcyl(.06, -.64, .64, 0, 0), zcyl(.035, -.3, .3, -R, 0), zcyl(.035, -.3, .3, R, 0), zcyl(.03, -.3, .3, -RB, 0), zcyl(.025, 0, .4, XV, 0)]), 'steel')); }

    /* 10 parallel motion: two sets of links, one each side of the beam */
    const pm = { main: [], back: [], bridle: [], par: [], pins: [] };
    { const pc = piece('pmotion', { moves: [my(.8, .1, .5)] });
      for (const s of [1, -1]) {
        pm.main.push([add(pc, bar(LNK, .05, .03), 'steel'), .17 * s]); pm.back.push([add(pc, bar(LNK, .05, .03), 'steel'), .25 * s]);
        pm.bridle.push([add(pc, bar(RB, .045, .03), 'steel'), .285 * s]); pm.par.push([add(pc, bar(RB, .04, .03), 'steel'), .205 * s]);
      }
      pm.pins.push(add(pc, zcyl(.02, -.3, .3, 0, 0, 10), 'iron')); }

    /* 04 cylinder, 05 cover, 06 piston */
    let pistonG, steamTop, steamBot;
    { let pc = piece('cyl', { clip: CUT0, shell: 1, moves: [mx(-1.5, .45, .9)] });
      add(pc, vlathe([[.72, .40], [.78, .40], [.78, .31], [2.15, .31], [2.15, .40], [2.2, .40], [2.2, .24], [.78, .24], [.78, 0], [.72, 0]], CX), 'green');
      add(pc, vlathe([[.66, 0], [.66, .45], [.72, .45], [.72, 0]], CX), 'iron');
      const sm = () => new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
      const sg = new THREE.CylinderGeometry(.236, .236, 1, 28).translate(0, .5, 0);
      steamTop = new THREE.Mesh(sg, sm()); steamBot = new THREE.Mesh(sg, sm()); steamTop.position.set(CX, 2, 0); steamBot.position.set(CX, .78, 0); pc.inner.add(steamTop, steamBot);

      pc = piece('cover', { clip: CUT0, moves: [mx(-1.5, .45, .9), my(1.95, .55, 1)] });
      add(pc, vlathe([[2.2, .03], [2.2, .40], [2.26, .40], [2.26, .08], [2.42, .08], [2.42, .03]], CX), 'iron');
      add(pc, merge([...Array(12)].map((_, i) => vcyl(.016, 2.26, 2.29, CX + .35 * Math.cos(i / 12 * TAU + .26), .35 * Math.sin(i / 12 * TAU + .26), 8))), 'steel');

      pc = piece('piston', { moves: [mx(-1.5, .45, .9), my(1.9, .55, 1)] }); pistonG = sub(pc);
      into(pistonG, add(pc, vlathe([[1.43, 0], [1.43, .236], [1.55, .236], [1.55, 0]], CX), 'ironDark'));
      into(pistonG, add(pc, vlathe([[1.47, .2], [1.47, .239], [1.51, .239], [1.51, .2]], CX), 'rope'));
      into(pistonG, add(pc, vcyl(.026, 1.55, 3.1, CX), 'steel'));
      into(pistonG, add(pc, merge([box(.09, .06, .1, CX, 3.1, 0), zcyl(.022, -.225, .225, CX, 3.1, 10)]), 'iron')); }

    /* 02 valve chest, 03 plug rod, 01 steam pipe and throttle */
    let plugG; const handles = [];
    { let pc = piece('chest', { clip: CUT0, shell: 1, moves: [mz(1.0, .15, .55), mx(-1.5, .45, .9)] });
      add(pc, merge([box(.22, .26, .26, XV, 2.05, 0), box(.22, .26, .26, XV, .9, 0), vcyl(.045, 1.03, 1.92, XV, .07), vcyl(.045, 1.03, 1.92, XV, -.07),
        xcyl(.07, -1.79, -1.71, 2.05), xcyl(.07, -1.79, -1.71, .9)]), 'green');
      for (const y of [2.05, .9]) { const h = add(pc, merge([box(.3, .03, .02, 0, 0, 0), box(.05, .05, .03, .14, 0, 0)]), 'gold'); h.position.set(XV, y, .145); handles.push(h); }

      pc = piece('plug', { moves: [mz(1.3, .1, .5), mx(-.6, .4, .85)] }); plugG = sub(pc);
      into(plugG, add(pc, vcyl(.018, .75, 4.0, XV, .36, 10), 'steel'));
      into(plugG, add(pc, merge([2.2, 1.9, 1.05, .75].map(y => box(.05, .04, .2, XV, y, .27))), 'timberH'));

      pc = piece('steam', { shell: 1, moves: [mz(-1.1, .15, .55), mx(-1.5, .45, .9)] });
      add(pc, merge([zcyl(.06, -1.7, -.13, XV, 2.05), zcyl(.1, -1.7, -1.67, XV, 2.05), zcyl(.095, -.5, -.47, XV, 2.05), zcyl(.095, -.21, -.18, XV, 2.05)]), 'copper');
      add(pc, merge([zcyl(.085, -.46, -.22, XV, 2.05), vcyl(.01, 2.05, 2.4, XV, -.3, 8), box(.14, .02, .02, XV + .05, 2.38, -.3)]), 'iron'); }

    /* 07 condenser, 08 air pump, 09 cistern */
    let bucketG;
    { let pc = piece('cond', { clip: CUTC, shell: 1, moves: [mz(2.2, .15, .6), my(1.7, .6, 1), mx(-.3, .6, 1)] });
      add(pc, vlathe([[.1, 0], [.1, .12], [.62, .12], [.62, .04], [.66, .04], [.66, .025], [.6, .025], [.6, .105], [.115, .105], [.115, 0]], CD[0], CD[1]), 'iron');
      add(pc, tube([[-1.49, .9, -.07], [-1.4, .9, -.12], [-1.31, .88, -.2], [CD[0], .8, CD[1]], [CD[0], .64, CD[1]]], .04), 'iron');
      add(pc, tube([[CD[0], .13, CD[1]], [-1.18, .13, -.12], [XP - .12, .13, -.02]], .032), 'iron');
      add(pc, merge([xcyl(.018, CD[0] - .2, CD[0] - .1, .42, CD[1], 10), box(.02, .08, .02, CD[0] - .2, .45, CD[1])]), 'gold');

      pc = piece('pump', { clip: CUT0, shell: 1, moves: [mz(2.2, .15, .6), my(1.7, .6, 1), mx(.3, .6, 1)] });
      add(pc, vlathe([[.08, 0], [.08, .17], [.95, .17], [.95, .15], [.11, .15], [.11, 0]], XP), 'iron');
      add(pc, box(.16, .06, .08, XP + .23, .9, 0), 'iron');
      pc = piece('pump', { moves: [mz(2.2, .15, .6), my(1.7, .6, 1), mx(.3, .6, 1)] }); bucketG = sub(pc);
      into(bucketG, add(pc, vlathe([[.52, 0], [.52, .145], [.58, .145], [.58, 0]], XP), 'ironDark'));
      into(bucketG, add(pc, vcyl(.016, .58, 3.55, XP, 0, 10), 'steel'));

      pc = piece('cistern', { clip: CUT0, shell: 1, moves: [mz(2.2, .15, .6)] });
      add(pc, merge([box(.05, .8, 1.0, -1.435, .4, 0), box(.05, .8, 1.0, -.625, .4, 0), box(.86, .8, .05, -1.03, .4, -.475), box(.86, .8, .05, -1.03, .4, .475), box(.86, .05, 1.0, -1.03, .025, 0)]), 'timberH');
      add(pc, merge([.2, .62].flatMap(y => [box(.9, .05, .012, -1.03, y, .506), box(.9, .05, .012, -1.03, y, -.506), box(.012, .05, 1.02, -1.466, y, 0), box(.012, .05, 1.02, -.594, y, 0)])), 'ironDark');
      const w = add(pc, box(.76, .62, .9, -1.03, .37, 0), 'water'); w.castShadow = false; w.userData.noEdge = true; }

    /* 12 connecting rod, 13 planet, 14 sun, 15 shaft and bearings, 16 flywheel */
    let rodG, planetG, sunG, arm, shaftG, flyG;
    { let pc = piece('rod', { moves: [my(1.7, .3, .7), mz(1.9, .5, .95)] }); rodG = sub(pc);
      into(rodG, add(pc, bar(LC, .11, .06), 'steel'));
      pc = piece('planet', { moves: [my(1.7, .3, .7), mz(1.2, .5, .95)] }); planetG = sub(pc);
      into(planetG, add(pc, gear(GR, NT, .12).translate(0, 0, -.12), 'iron'));
      into(planetG, add(pc, merge([zcyl(.07, -.2, -.03, 0, 0, 16), ...[0, 1, 2, 3].map(i => zcyl(.014, -.05, -.03, .045 * Math.cos(i * PI / 2 + .8), .045 * Math.sin(i * PI / 2 + .8), 6))]), 'steel'));
      pc = piece('sun', { moves: [my(1.7, .3, .7), mz(.6, .5, .95)] }); sunG = sub(pc, S[0], S[1]);
      into(sunG, add(pc, gear(GR, NT, .12).translate(0, 0, -.12), 'iron'));
      into(sunG, add(pc, zcyl(.1, -.2, -.04, 0, 0, 20), 'steel'));
      arm = add(pc, bar(RHO, .05, .025).translate(0, 0, -.215), 'steel'); arm.position.set(S[0], S[1], 0);
      pc = piece('shaft', { moves: [my(1.7, .3, .7)] }); shaftG = sub(pc, S[0], S[1]);
      into(shaftG, add(pc, merge([zcyl(.07, -1.62, -.05, 0, 0, 20), box(.03, .03, .34, .075, 0, -.2), box(.03, .03, .3, .075, 0, -.9)]), 'steel'));
      into(shaftG, add(pc, merge([zring(-.72, -.64, .06, .2), zring(-.69, -.67, .2, .215)]), 'iron'));
      add(pc, merge([box(.36, .2, .22, S[0], .8, -.42), box(.36, .2, .22, S[0], .8, -1.4)]), 'iron');
      add(pc, merge([zring(-.52, -.32, .07, .108, S[0], S[1]), zring(-1.5, -1.3, .07, .108, S[0], S[1])]), 'gold');
      pc = piece('fly', { moves: [my(1.7, .3, .7), mz(-1.7, .5, .95)] }); flyG = sub(pc, S[0], S[1], -.9);
      into(flyG, add(pc, merge([zring(-.08, .08, 1.74, 1.9), ...[0, 1, 2, 3, 4, 5].map(k => box(.11, 1.6, .07, 0, .96, 0).applyMatrix4(M4().makeRotationZ(k * PI / 3)))]), 'green'));
      into(flyG, add(pc, zring(-.13, .13, .07, .21), 'iron')); }

    /* 17 governor */
    const GL = .42, gov = { arms: [], links: [], balls: [] }; let govG, sleeve, govRod;
    { const pc = piece('gov', { moves: [mz(1.6, .2, .65), mx(-.3, .6, .9)] }); govG = sub(pc, .95, 0, -.3);
      add(pc, vlathe([[0, .2], [.04, .2], [.1, .09], [1.45, .055], [1.5, .075], [1.52, .075], [1.52, .02]], .95, -.3, { closed: false }), 'green');
      add(pc, merge([zring(-.72, -.64, .02, .12, .95, .55), zcyl(.02, -.72, -.3, .95, .55, 10)]), 'iron');
      add(pc, merge([slant(S[0], S[1] + .2, .95, .67, .012, .05, -.68), slant(S[0], S[1] - .2, .95, .43, .012, .05, -.68)]), 'leather');
      govRod = add(pc, merge([xcyl(.008, XV, .8, 2.38, -.26, 8), slant(.93, 2.2, .8, 2.38, .016, .016, -.28)]), 'steel');
      into(govG, add(pc, merge([vcyl(.018, 1.5, 2.56, 0, 0, 10), box(.06, .05, .05, 0, 2.5, 0)]), 'steel'));
      for (const s of [1, -1]) {
        const a = into(govG, add(pc, bar(GL, .022, .015), 'steel')); a.position.set(0, 2.5, 0); gov.arms.push([a, s]);
        const l = into(govG, add(pc, bar(GL / 2, .016, .012), 'steel')); gov.links.push([l, s]);
        gov.balls.push([into(govG, add(pc, new THREE.SphereGeometry(.075, 22, 14), 'gold')), s]);
      }
      sleeve = into(govG, add(pc, vcyl(.036, -.04, .04, 0, 0, 16), 'gold')); }

    /* steam particles along the pipes */
    const V = a => new THREE.Vector3(...a), hotC = [1, .9, .72], coldC = [.5, .78, 1];
    const paths = [
      { pts: [[XV, 2.05, -1.7], [XV, 2.05, -.1], [-1.75, 2.05, 0], [-1.95, 2.05, 0]], col: hotC, down: true },
      { pts: [[XV, 2.05, -1.7], [XV, 2.05, -.1], [XV, 1.9, .07], [XV, 1.0, .07], [-1.75, .9, 0], [-1.95, .9, 0]], col: hotC, down: false },
      { pts: [[-1.95, .9, 0], [-1.75, .9, 0], [-1.49, .9, -.07], [-1.4, .9, -.12], [CD[0], .82, CD[1]], [CD[0], .3, CD[1]]], col: coldC, down: true },
      { pts: [[-1.95, 2.05, 0], [-1.75, 2.05, 0], [XV, 1.9, -.07], [XV, 1.0, -.07], [-1.49, .9, -.07], [-1.4, .9, -.12], [CD[0], .82, CD[1]], [CD[0], .3, CD[1]]], col: coldC, down: false },
    ].map(p => { const v = p.pts.map(V), cum = [0]; for (let i = 1; i < v.length; i++) cum.push(cum[i - 1] + v[i].distanceTo(v[i - 1])); return { ...p, v, cum, len: cum[cum.length - 1], a: 0 }; });
    const NP = 90, N = NP * paths.length, pos = new Float32Array(N * 3), col = new Float32Array(N * 4), pu = new Float32Array(N), pj = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pu[i] = Math.random(); for (let k = 0; k < 3; k++) pj[i * 3 + k] = (Math.random() - .5) * .05; }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    pg.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
    const pmat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 1000 }, uSize: { value: .05 } },
      vertexShader: `attribute vec4 aCol; varying vec4 vC; uniform float uScale; uniform float uSize;
        void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, uSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vC.a; gl_FragColor = vec4(vC.rgb * a, a); }` });
    const points = new THREE.Points(pg, pmat); points.frustumCulled = false; points.visible = false; scene.add(points);
    const tv = new THREE.Vector3();
    function stepSteam(dt, vis, goingDown, speed) {
      points.visible = vis > .005; if (!points.visible) return;
      pmat.uniforms.uScale.value = ctx.view.scale;
      paths.forEach((p, k) => {
        p.a += ((p.down === goingDown ? 1 : 0) - p.a) * (1 - Math.exp(-dt * 6));
        for (let j = 0; j < NP; j++) {
          const i = k * NP + j; let u = pu[i] + dt * (.25 + speed * .9) / p.len; if (u > 1) u -= 1; pu[i] = u;
          const d = u * p.len; let s = 1; while (s < p.cum.length - 1 && p.cum[s] < d) s++;
          tv.lerpVectors(p.v[s - 1], p.v[s], (d - p.cum[s - 1]) / (p.cum[s] - p.cum[s - 1]));
          pos[i * 3] = tv.x + pj[i * 3]; pos[i * 3 + 1] = tv.y + pj[i * 3 + 1]; pos[i * 3 + 2] = tv.z + pj[i * 3 + 2];
          col[i * 4] = p.col[0]; col[i * 4 + 1] = p.col[1]; col[i * 4 + 2] = p.col[2]; col[i * 4 + 3] = vis * p.a * smooth(u / .12) * smooth((1 - u) / .15) * .9;
        }
      });
      pg.attributes.position.needsUpdate = true; pg.attributes.aCol.needsUpdate = true;
    }

    /* linkage: the flywheel angle is the master, everything else follows from it */
    const K = { theta: 0, psi: 0, phi: 0, alpha: 0, G: [0, 0], Ar: [0, 0], A: [0, 0], B: [0, 0], D: [0, 0], E: [0, 0], Pm: [0, 0] };
    function rodAt(psi) {
      const gx = S[0] + RHO * Math.cos(psi), gy = S[1] + RHO * Math.sin(psi), dx = gx - O[0], dy = gy - O[1], d = Math.hypot(dx, dy);
      const phi = Math.atan2(dy, dx) + Math.acos(clamp((R * R + d * d - LC * LC) / (2 * R * d), -1, 1));
      K.G[0] = gx; K.G[1] = gy; K.phi = phi; K.Ar[0] = O[0] + R * Math.cos(phi); K.Ar[1] = O[1] + R * Math.sin(phi);
      return Math.atan2(K.Ar[1] - gy, K.Ar[0] - gx) - PI / 2;
    }
    function solve(theta) {
      let psi = K.psi + (theta - K.theta) / 2;
      for (let i = 0; i < 5; i++) psi = (theta + rodAt(psi) + PI / NT) / 2;     // sun angle = 2·psi − rod angle − half a tooth
      K.alpha = rodAt(psi); K.psi = psi; K.theta = theta;
      const c = Math.cos(K.phi), s = Math.sin(K.phi);
      K.A[0] = O[0] - R * c; K.A[1] = O[1] - R * s; K.B[0] = O[0] - RB * c; K.B[1] = O[1] - RB * s;
      const vx = K.B[0] - CB[0], vy = K.B[1] - CB[1], d = Math.hypot(vx, vy), a = (RB * RB - LNK * LNK + d * d) / (2 * d), h = Math.sqrt(Math.max(0, RB * RB - a * a));
      const mxx = CB[0] + a * vx / d, myy = CB[1] + a * vy / d, y1 = myy - h * vx / d, sg = y1 < myy + h * vx / d ? 1 : -1;
      K.D[0] = mxx + sg * h * vy / d; K.D[1] = myy - sg * h * vx / d;
      K.E[0] = K.A[0] + K.D[0] - K.B[0]; K.E[1] = K.A[1] + K.D[1] - K.B[1];
      K.Pm[0] = (K.B[0] + K.D[0]) / 2; K.Pm[1] = (K.B[1] + K.D[1]) / 2;
    }
    const link = ([m, z], p, q) => { m.position.set(p[0], p[1], z); m.rotation.z = Math.atan2(q[1] - p[1], q[0] - p[0]) - PI / 2; };
    const E0 = 3.1;   // crosshead height at mid stroke, the pose the parts are built in
    solve(0);
    const run = { rpm: ctx.reduced ? 0 : 35, theta: 0, lastE: K.E[1], dir: -1, valve: 0 };
    const hot = new THREE.Color(1, .82, .56), cold = new THREE.Color(.42, .68, 1);

    function pose(dt, s) {
      solve(run.theta);
      beamG.rotation.z = K.phi;
      pm.main.forEach(l => link(l, K.A, K.E)); pm.back.forEach(l => link(l, K.B, K.D)); pm.bridle.forEach(l => link(l, CB, K.D)); pm.par.forEach(l => link(l, K.D, K.E));
      pm.pins[0].position.set(K.D[0], K.D[1], 0);
      pistonG.position.y = K.E[1] - E0; bucketG.position.y = K.Pm[1] - 3.55; plugG.position.y = XV * Math.sin(K.phi);
      rodG.position.set(K.G[0], K.G[1], 0); rodG.rotation.z = K.alpha; planetG.position.set(K.G[0], K.G[1], 0); planetG.rotation.z = K.alpha;
      sunG.rotation.z = shaftG.rotation.z = flyG.rotation.z = run.theta; arm.rotation.z = K.psi - PI / 2;
      if (byId.planet.anchor) byId.planet.anchor.set(K.G[0], K.G[1], -.05);
      const vE = K.E[1] - run.lastE; run.lastE = K.E[1]; if (Math.abs(vE) > 1e-5) run.dir = vE < 0 ? -1 : 1;
      run.valve += (run.dir - run.valve) * (1 - Math.exp(-dt * 14));
      handles[0].rotation.z = .4 * run.valve; handles[1].rotation.z = -.4 * run.valve;
      const beta = lerp(16, 52, clamp(run.rpm / 50, 0, 1)) * DEG, cb = Math.cos(beta), sb = Math.sin(beta);
      govG.rotation.y = run.theta * 2.5; sleeve.position.y = 2.5 - GL * cb; govRod.position.x = (beta - .6) * .06;
      for (const [m, sd] of gov.arms) m.rotation.z = PI + sd * beta;
      for (const [m, sd] of gov.links) { m.position.set(sd * GL / 2 * sb, 2.5 - GL / 2 * cb, 0); m.rotation.z = PI - sd * beta; }
      for (const [m, sd] of gov.balls) m.position.set(sd * GL * sb, 2.5 - GL * cb, 0);
      const pc = 1.49 + K.E[1] - E0, down = run.dir < 0, v = s ? s.flowVis : 0;
      steamTop.position.y = pc + .06; steamTop.scale.y = Math.max(.001, 2.2 - pc - .06); steamBot.scale.y = Math.max(.001, pc - .06 - .78);
      steamTop.material.color.copy(down ? hot : cold); steamBot.material.color.copy(down ? cold : hot);
      steamTop.material.opacity = v * (down ? .34 : .16); steamBot.material.opacity = v * (down ? .16 : .34);
      steamTop.visible = steamBot.visible = v > .005;
      stepSteam(dt, v, down, run.rpm / 50);
    }
    pose(0, null);
    return {
      step(dt, s) {
        const target = s.run ? 20 + 30 * s.power : 0;
        run.rpm += (target - run.rpm) * (1 - Math.exp(-dt / (s.run ? 1.8 : 3.5)));
        if (run.rpm < .05 && !s.run) run.rpm = 0;
        run.theta += run.rpm / 60 * TAU * dt;
        pose(dt, s);
      },
      readouts: () => [
        { v: run.rpm.toFixed(0), sub: '2 turns per cycle', f: run.rpm / 50 },
        { v: (run.rpm / 2).toFixed(1), sub: 'down and up', f: run.rpm / 50 },
        { v: (run.rpm / 5).toFixed(1), sub: 'approximate' }],
      active: () => run.rpm > .05,
    };
  },
};
