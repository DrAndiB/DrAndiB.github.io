/* Machine definition: nine-cylinder radial aircraft engine, after the Pratt & Whitney R-1340 Wasp. Used with exploded.js. */
import { THREE, TAU, PI, DEG, lerp, clamp, revolve, rect, blade, merge, cylX, cylY, boxAt, mx, my, mv } from '../exploded.js';

/* Layout in metres. X is the crankshaft axis with the propeller at -X. Cylinder 1 points straight up (+Y);
   angles run from +Y towards +Z, the same convention the viewer's revolve() uses. */
const NC = 9, RC = .073, LM = .30, RK = .075, LL = LM - RK;      // cylinders, crank radius, master rod, knuckle pin radius, link rod
const A = i => i * TAU / NC;
const LIFT = .012, EX_OPEN = 140, IN_OPEN = 340, DUR = 240;      // valve lift and timing in crank degrees after firing top dead centre

const ylathe = (pts, o) => revolve(pts, o).rotateZ(PI / 2);      // [[height, radius], ...] around cylinder 1's axis
const toX = g => g.applyMatrix4(new THREE.Matrix4().set(0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1));   // shape drawn in (y, z), extruded along x
const ext = (shape, w, x0) => toX(new THREE.ExtrudeGeometry(shape, { depth: w, bevelEnabled: false, curveSegments: 16 })).translate(x0, 0, 0);
const fins = (y0, y1, n, rb, rf) => { const p = (y1 - y0) / n, o = []; for (let i = 0; i < n; i++) { const y = y0 + i * p; o.push([y, rb(y)], [y + p * .14, rf(y)], [y + p * .5, rf(y)], [y + p * .64, rb(y)]); } o.push([y1, rb(y1)]); return o; };
const tube = (pts, r, seg = 24) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p))), seg, r, 8, false);

const P = (id, name, group, kind, ext_, at, len, text, specs, o = {}) => {
  const [x, th, r] = at, c = Math.cos(th * DEG), s = Math.sin(th * DEG);
  return { id, name, group, kind, ext: ext_, text, specs, view: o.view, label: { at: [x, r * c, r * s], dir: o.dir || [-(o.fx || 0), c, s], len } };
};
const FRONT = [-.72, .28], REAR = [.62, .26];
const PARTS = [
  P('prop', 'Propeller hub', 'Propeller and nose', 'b', true, [-.56, 30, .075], [.4, .35],
    ['The propeller bolts straight onto the front of the crankshaft and turns at engine speed. Some versions of this engine drove it through a 3:2 reduction gear instead.',
     'The blades are shown cut short. A real propeller for this engine is more than two metres across.'],
    [['Drive', 'Direct, at engine speed'], ['Geared versions', '3 : 2 reduction'], ['Blades', 'Shown cut short']], { dir: [-.7, .6, .4], view: FRONT }),
  P('nose', 'Nose case', 'Propeller and nose', 's', true, [-.22, -30, .15], [.75, .3],
    ['The front cover of the engine. It carries the thrust bearing that takes the pull of the propeller, and it houses the cam ring and the tappets that work the valves.'],
    [['Holds', 'Thrust bearing, cam ring, tappets'], ['Tappet guides', '18']], { view: FRONT }),
  P('cam', 'Cam ring', 'Propeller and nose', 'b', false, [-.135, 100, .16], [.75, .35],
    ['A radial engine has no camshaft. One ring with lobes on its rim sits around the crankshaft and works every valve in turn. One track serves the exhaust valves, the other the intake valves.',
     'On a nine-cylinder engine the usual ring has four lobes per track and is geared to turn at one eighth of crankshaft speed, against the direction of the crank.'],
    [['Lobes', '4 per track'], ['Speed', '1/8 of crankshaft'], ['Direction', 'Opposite to crankshaft']], { view: FRONT }),
  P('push', 'Tappets and pushrods', 'Valve gear', 'a', false, [-.11, -44, .4], [.5, .3],
    ['A roller tappet rides on each cam track. When a lobe passes, it lifts a pushrod that reaches up the front of the cylinder to the rocker arm.'],
    [['Count', '18, two per cylinder'], ['Lift', '12 mm (model)']], { view: FRONT, fx: 1 }),
  P('tubes', 'Pushrod tubes', 'Valve gear', 's', true, [-.115, 84, .42], [.45, .3],
    ['Thin tubes that enclose the pushrods, keep dirt out and let oil drain back from the rocker boxes. The V they form in front of each cylinder is one of the marks of a radial engine.'],
    [['Count', '18'], ['Also', 'Oil return from the rockers']], { view: FRONT, fx: 1 }),
  P('rock', 'Rocker arms', 'Valve gear', 'a', false, [-.035, -5, .615], [.3, .25],
    ['A small lever in a box on top of each cylinder head. The pushrod lifts its front end, and its rear end presses the valve open.'],
    [['Count', '18'], ['Housed in', 'Rocker boxes on the heads']], { fx: 1 }),
  P('valve', 'Valves and springs', 'Valve gear', 'a', false, [0, -5, .57], [.5, .25],
    ['Two per cylinder, one for intake and one for exhaust. Each opens once in every two turns of the crankshaft and is closed again by its springs.'],
    [['Per cylinder', '1 intake, 1 exhaust'], ['Opens', 'Once per 2 crank turns']], { fx: -1 }),
  P('head', 'Cylinder heads', 'Cylinders', 's', true, [-.05, -11, .56], [.45, .3],
    ['Cast aluminium, fixed to the top of the steel barrel. The dome forms the combustion chamber and carries the valves, two spark plugs and the rocker boxes.',
     'Deep fins shed the heat into the airstream. Air is the only coolant this engine has.'],
    [['Material', 'Cast aluminium'], ['Compression ratio', '6 : 1'], ['Cooling', 'Air, through fins']], { fx: 1.2 }),
  P('barrel', 'Cylinder barrels', 'Cylinders', 's', true, [-.113, -120, .34], [.5, .3],
    ['A steel tube with thin fins on the outside, in which the piston runs. Its lower end, the skirt, reaches into the crankcase.'],
    [['Bore', '5¾ in (146 mm)'], ['Stroke', '5¾ in (146 mm)'], ['Material', 'Steel']], { fx: 1.5 }),
  P('piston', 'Pistons', 'Cylinders', 'a', false, [0, 40, .30], [.6, .3],
    ['Aluminium, with rings that seal the gas above and scrape the oil below. Each piston makes four strokes per cycle: intake, compression, power and exhaust.',
     'In the exploded view every cylinder is lifted off its piston, and cylinder 1 at the top is taken apart completely. With Cutaway and Combustion switched on you can follow the firing order round the star. Every second cylinder fires, so two turns of the crank reach all nine.'],
    [['Displacement', '22 litres in total'], ['Firing order', '1-3-5-7-9-2-4-6-8']]),
  P('master', 'Master rod', 'Crank mechanism', 'a', false, [0, 8, .2], [.75, .35],
    ['All nine cylinders lie in one plane, so nine ordinary connecting rods cannot share the single crankpin. One rod, the master rod, grips the crankpin. The other eight are pinned to a ring of holes around its big end.'],
    [['Grips', 'Crankpin'], ['Carries', '8 knuckle pins'], ['Serves', 'Cylinder 1']]),
  P('link', 'Link rods', 'Crank mechanism', 'a', false, [0, 160, .2], [.75, .4],
    ['Eight shorter rods, also called articulated rods, that hinge on knuckle pins in the master rod. Their pistons follow slightly different paths from the master piston, an imperfection the designers accepted.'],
    [['Count', '8'], ['Hinge on', 'Knuckle pins']]),
  P('crank', 'Crankshaft', 'Crank mechanism', 'b', true, [-.42, 180, .03], [.5, .3],
    ['A single throw with one crankpin, balanced by heavy counterweights on the opposite side. The front end carries the propeller. The rear end drives the supercharger and the accessories.'],
    [['Throws', '1'], ['Take-off speed', '2,250 rpm'], ['Crank radius', '73 mm']]),
  P('case', 'Crankcase', 'Crank mechanism', 's', true, [-.06, 180, .21], [.7, .3],
    ['The hub that holds everything together. On the Wasp it was forged in aluminium in two halves that meet on the centre line of the cylinders. That was unusual at the time and saved a good deal of weight.'],
    [['Material', 'Forged aluminium'], ['Halves', '2']]),
  P('imp', 'Supercharger impeller', 'Rear sections', 'b', false, [.15, 120, .1], [.8, .35],
    ['A centrifugal fan geared to spin ten times faster than the crankshaft. It flings the fuel and air mixture outward and compresses it, so the cylinders still fill properly in the thin air at altitude.'],
    [['Speed', '10 × crankshaft'], ['At take-off', '22,500 rpm'], ['Type', 'Single-speed centrifugal']], { view: REAR }),
  P('blower', 'Blower section and intake pipes', 'Rear sections', 's', true, [.19, -60, .235], [.65, .3],
    ['The housing around the impeller collects the compressed mixture and sends it through nine pipes to the intake ports at the back of the cylinder heads.'],
    [['Intake pipes', '9']], { view: REAR }),
  P('ign', 'Ignition system', 'Rear sections', 's', true, [.135, -100, .285], [.5, .3],
    ['Two magnetos at the rear make the spark without any battery. Each cylinder has two spark plugs, one fired by each magneto, so the engine keeps running if one system fails.'],
    [['Magnetos', '2'], ['Spark plugs', '18']], { view: REAR }),
  P('acc', 'Accessory case', 'Rear sections', 's', true, [.34, -20, .15], [.4, .3],
    ['The rear cover. It carries the drives for the magnetos, the oil pump, the starter and the generator, all geared from the back of the crankshaft.'],
    [['Drives', 'Magnetos, oil pump, starter, generator']], { view: REAR, fx: -1.5 }),
  P('carb', 'Carburettor', 'Rear sections', 's', true, [.29, 180, .37], [.3, .25],
    ['Mixes fuel into the air before it enters the supercharger. The Wasp used a two-barrel Stromberg carburettor.'],
    [['Type', 'Two-barrel Stromberg'], ['Feeds', 'Supercharger']], { view: REAR }),
];

export default {
  docTitle: 'Radial Engine Exploded View',
  eyebrow: 'Exploded · Plate 03', title: 'Radial Engine', sub: 'Nine-cylinder aircraft engine of the 1920s and 30s, taken apart into 19 assemblies',
  facts: [{ k: 'Cylinders', v: '9 × 146 mm bore' }, { k: 'Displacement', v: '22 litres' }, { k: 'Power', v: '600 hp at 2,250 rpm' }],
  note: 'Illustrative model built from simple geometry. Bore, stroke, displacement, power, compression and blower ratio follow the Pratt & Whitney R-1340 Wasp, first run in 1925. The cam drive, the rod proportions and many details are simplified or typical of nine-cylinder radials, and the propeller blades are cut short.',
  kinds: { a: { short: 'Sliding', label: 'Reciprocating' }, b: { short: 'Turning', label: 'Rotating' }, s: { short: 'Static', label: 'Static' } },
  groups: ['Propeller and nose', 'Valve gear', 'Cylinders', 'Crank mechanism', 'Rear sections'],
  parts: PARTS,
  controls: { run: 'Engine', power: 'Throttle', flow: 'Combustion', powerDefault: .4 },
  gauges: [{ label: 'Crankshaft rpm', color: 'var(--n2)', arc: true }, { label: 'Cam ring rpm', color: 'var(--n1)', arc: true }, { label: 'Power hp' }],
  gaugeNote: 'Motion shown 30× slower than real',
  camera: { az: -.9, el: .24, paz: -1.1, pel: .34, focus: [-.6, .22] },
  materials(std, phy) {
    return {
      caseGrey: phy(0x7d848b, .55, .5, { clearcoat: .3, clearcoatRoughness: .4 }),
      gunmetal: std(0x4b5056, .9, .42),
      ceramic: std(0xe9e6dc, 0, .5),
    };
  },

  build(ctx) {
    const { add, reg, M } = ctx;
    const QUAD = [[0, -1, 0, 0, 0, 0], [0, 0, -1, 0, 0, 0]];     // cutaway removes the upper front quarter
    const piece = (id, o = {}) => { const pc = ctx.piece(id, { ...o, clip: o.clip ? QUAD : null }); pc.b = 0; pc.c = 0; pc.rows = []; return pc; };
    const mb = (d, a, b) => mv('b', d, a, b), mc = (d, a, b) => mv('c', d, a, b);   // b: every cylinder moves out from the crankshaft; c: cylinder 1 comes apart further
    const sub = pc => { const g = new THREE.Group(); pc.inner.add(g); return g; };
    const into = (g, mesh) => { g.add(mesh); return mesh; };
    const RX = a => new THREE.Matrix4().makeRotationX(a), TR = (x, y, z) => new THREE.Matrix4().makeTranslation(x, y, z);
    const m1 = new THREE.Matrix4(), m2 = new THREE.Matrix4(), m3 = new THREE.Matrix4();

    /* One geometry repeated round the crankshaft. Each instance is rotX(angle) · burst · base · live motion. */
    function setRow(pc, r, local) {
      for (let i = 0; i < r.ang.length; i++) {
        m1.makeRotationX(r.ang[i]).multiply(m2.makeTranslation(0, pc.b + (r.cyl(i) ? 0 : pc.c), 0));
        if (r.base) m1.multiply(r.base[i]); if (local) m1.multiply(local(i));
        r.im.setMatrixAt(i, m1);
      }
      r.im.instanceMatrix.needsUpdate = true; r.im.boundingSphere = null; r.im.boundingBox = null;
    }
    function grow(pc) {     // keep the piece's bounds and its callout in step with the burst
      if (!pc.box0) { if (pc.box.isEmpty()) return; pc.box0 = pc.box.clone(); }
      const b = pc.b, p = pc.part; pc.box.copy(pc.box0); pc.box.min.y -= b; pc.box.max.y += b + pc.c; pc.box.min.z -= b; pc.box.max.z += b;
      if (p.anchor && pc === p.pieces[0]) { if (!p.anchor0) { p.anchor0 = p.anchor.clone(); p.rad = new THREE.Vector3(0, p.anchor.y, p.anchor.z).normalize(); } p.anchor.copy(p.anchor0).addScaledVector(p.rad, b + (p.rad.y > .96 ? pc.c : 0)); }
    }
    function row(pc, geom, k, n, o = {}) {
      const im = new THREE.InstancedMesh(geom, M(pc, k), n); im.userData.inst = true; im.frustumCulled = false;
      const r = { im, ang: [...Array(n)].map((_, i) => o.ang ? o.ang(i) : A(i)), base: o.base || null, live: !!o.live, cyl: o.cyl || (i => i) };
      pc.rows.push(r); setRow(pc, r); reg(pc, im);
      if (!pc.onChan) pc.onChan = ch => { pc.b = ch.b || 0; pc.c = ch.c || 0; for (const q of pc.rows) if (!q.live) setRow(pc, q); grow(pc); };
      return r;
    }
    const side = i => (i & 1 ? 1 : -1), cyl2 = i => A(i >> 1), two = i => i >> 1;   // two valves per cylinder: even = exhaust (-Z side), odd = intake (+Z side)
    const pushBase = [], pushLen = [];
    for (let i = 0; i < 18; i++) {
      const s = side(i), B = new THREE.Vector3(s < 0 ? -.145 : -.125, .164 * Math.cos(9 * DEG), s * .164 * Math.sin(9 * DEG)), T = new THREE.Vector3(-.078, .612, s * .055), d = T.clone().sub(B);
      pushLen.push(d.length()); pushBase.push(TR(B.x, B.y, B.z).multiply(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()))));
    }
    const PL = pushLen[0];

    /* 01 propeller hub */
    let propG;
    { const pc = piece('prop', { moves: [mx(-1.15, .1, .85)] }); propG = sub(pc);
      into(propG, add(pc, revolve([[-.62, 0], [-.62, .05], [-.60, .078], [-.50, .078], [-.48, .05], [-.48, 0]]), 'steel'));
      const r = row(pc, blade({ r0: .07, r1: .6, c0: .085, c1: .15, stag: f => (35 + 27 * f) * DEG, th0: .3, th1: .1, cam0: -.03, nS: 10, nP: 9, x: -.55 }), 'lip', 2, { ang: i => i * PI });
      into(propG, r.im);
      const sweep = new THREE.Mesh(new THREE.BoxGeometry(.1, 1.2, 1.2).translate(-.55, 0, 0)); sweep.visible = false; pc.inner.add(sweep); }   // keeps the turning blades inside the framed area

    /* 02 nose case, 03 cam ring */
    let camG;
    { let pc = piece('nose', { clip: 1, shell: 1, moves: [mx(-.78)] });
      add(pc, revolve([[-.09, .21], [-.115, .212], [-.16, .20], [-.20, .165], [-.26, .11], [-.30, .085], [-.335, .085], [-.335, .045], [-.29, .045], [-.29, .073], [-.255, .098], [-.20, .152], [-.16, .187], [-.115, .199], [-.09, .197]]), 'caseGrey');
      add(pc, rect(-.36, -.335, .05, .075), 'steel');
      row(pc, cylY(.015, .185, .24, -.145), 'caseGrey', 9, { ang: i => A(i) - 9 * DEG });
      row(pc, cylY(.015, .185, .24, -.125), 'caseGrey', 9, { ang: i => A(i) + 9 * DEG });

      pc = piece('cam', { moves: [mx(-.5)] }); camG = sub(pc);
      const track = ph => { const s = new THREE.Shape(), h = new THREE.Path();
        for (let k = 0; k <= 180; k++) { const a = k * 2, d = ((a - ph) % 90 + 135) % 90 - 45, r = .150 + (Math.abs(d) < 17 ? .012 * Math.cos(d / 17 * PI / 2) ** 2 : 0); k ? s.lineTo(r * Math.cos(a * DEG), r * Math.sin(a * DEG)) : s.moveTo(r, 0); }
        h.absarc(0, 0, .128, 0, TAU, true); s.holes.push(h); return s; };
      into(camG, add(pc, merge([ext(track(EX_OPEN / 8 + DUR / 16 - 9), .018, -.154), ext(track(IN_OPEN / 8 + DUR / 16 + 9), .018, -.134)]), 'steel'));
      into(camG, add(pc, merge([rect(-.142, -.128, .05, .129), rect(-.19, -.142, .05, .062)]), 'gold'));
      const gs = new THREE.Shape(), n = 44, p = TAU / n;
      for (let k = 0; k < n; k++) for (const [r, da] of [[.098, -.3], [.108, -.13], [.108, .13], [.098, .3]]) { const a = (k + da) * p; k || da > -.3 ? gs.lineTo(r * Math.cos(a), r * Math.sin(a)) : gs.moveTo(r * Math.cos(a), r * Math.sin(a)); }
      const gh = new THREE.Path(); gh.absarc(0, 0, .06, 0, TAU, true); gs.holes.push(gh);
      into(camG, add(pc, ext(gs, .014, -.186), 'steel')); }

    /* 04 tappets and pushrods, 05 pushrod tubes, 06 rocker arms, 07 valves */
    let pushPc, pushRow, rockPc, rockRow, valvePc, valveRow;
    { pushPc = piece('push', { moves: [mx(-.3, .35, .9)] });
      pushRow = row(pushPc, merge([new THREE.CylinderGeometry(.012, .012, .05, 12).translate(0, .025, 0), new THREE.CylinderGeometry(.0045, .0045, PL - .05, 8).translate(0, .05 + (PL - .05) / 2, 0), new THREE.CylinderGeometry(.012, .012, .014, 12).rotateZ(PI / 2).translate(0, .004, 0)]), 'steel', 18, { ang: cyl2, cyl: two, base: pushBase, live: 1 });

      let pc = piece('tubes', { clip: 1, shell: 1, moves: [mb(.32, .05, .4), mx(-.14, .4, .9)] });
      row(pc, merge([new THREE.CylinderGeometry(.011, .011, PL - .105, 12, 1, true).translate(0, .075 + (PL - .105) / 2, 0), new THREE.CylinderGeometry(.015, .015, .02, 12, 1, true).translate(0, .085, 0), new THREE.CylinderGeometry(.015, .015, .02, 12, 1, true).translate(0, PL - .04, 0)]), 'black', 18, { ang: cyl2, cyl: two, base: pushBase });

      rockPc = piece('rock', { moves: [mb(.32, .05, .4), mc(.58, .4, .85)] });
      rockRow = row(rockPc, merge([boxAt(.082, .012, .012, -.002, 0, 0), new THREE.CylinderGeometry(.011, .011, .03, 12).rotateX(PI / 2), boxAt(.012, .016, .014, .035, -.006, 0)]), 'steel', 18,
        { ang: cyl2, cyl: two, base: [...Array(18)].map((_, i) => TR(-.035, .612, side(i) * .055)), live: 1 });

      valvePc = piece('valve', { moves: [mb(.32, .05, .4), mc(.46, .4, .85)] });
      valveRow = row(valvePc, merge([ylathe([[0, 0], [0, .027], [.006, .027], [.018, .006], [.15, .0045], [.15, 0]], { seg: 18, closed: false }),
        ylathe([[.092, 0], ...fins(.094, .14, 5, () => .009, () => .0155), [.146, .017], [.146, 0]], { seg: 16 })]), 'nickel', 18,
        { ang: cyl2, cyl: two, base: [...Array(18)].map((_, i) => TR(0, .452, side(i) * .032).multiply(RX(side(i) * 12 * DEG))), live: 1 }); }

    /* 08 cylinder heads, 09 barrels, 10 pistons */
    let pistonPc, pistonRow, gas;
    { let pc = piece('head', { clip: 1, shell: 1, moves: [mb(.32, .05, .4), mc(.16, .4, .85)] });
      const headLoop = [[.425, .092], [.425, .118], ...fins(.432, .52, 7, () => .10, () => .128), ...fins(.522, .588, 5, y => lerp(.10, .058, (y - .522) / .066), y => lerp(.126, .08, (y - .522) / .066)),
        [.60, .05], [.60, 0], [.50, 0], [.495, .03], [.48, .055], [.455, .072], [.44, .0735], [.44, .092]];
      row(pc, merge([ylathe(headLoop, { seg: 40 }), boxAt(.12, .055, .045, -.035, .6125, .055), boxAt(.12, .055, .045, -.035, .6125, -.055), cylX(.028, .07, -.145, .505, 14), cylX(.026, .065, .07, .49, 14)]), 'alu', NC);

      pc = piece('barrel', { clip: 1, shell: 1, moves: [mb(.32, .05, .4)] });
      row(pc, ylathe([[.175, .079], [.212, .079], [.212, .104], [.228, .104], [.228, .083], ...fins(.245, .425, 14, () => .083, () => .113), [.44, .083], [.44, .0735], [.175, .0735]], { seg: 40 }), 'gunmetal', NC);

      pistonPc = piece('piston');
      const pl = [[-.05, .0728], [.02, .0728], [.02, .070], [.026, .070], [.026, .0728], [.034, .0728], [.034, .070], [.04, .070], [.04, .0728], [.048, .0728], [.048, .070], [.054, .070], [.054, .0728], [.06, .0728], [.066, .06], [.068, 0], [.05, 0], [.048, .05], [.03, .062], [-.05, .064]];
      pistonRow = row(pistonPc, merge([ylathe(pl, { seg: 36 }), cylX(.013, .13, -.065, 0, 12)]), 'alu', NC, { live: 1 });
      gas = new THREE.InstancedMesh(new THREE.CylinderGeometry(.071, .071, 1, 24).translate(0, .5, 0), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), NC);
      gas.frustumCulled = false; gas.visible = false; for (let i = 0; i < NC; i++) { gas.setMatrixAt(i, m1.identity()); gas.setColorAt(i, new THREE.Color(0, 0, 0)); }
      pistonPc.inner.add(gas); }

    /* 11 master rod, 12 link rods, 13 crankshaft, 14 crankcase halves */
    let master, links, crankG;
    { let pc = piece('master');
      master = add(pc, merge([cylX(.058, .05, -.025, 0, 28), cylX(.092, .008, -.024, 0, 32), cylX(.092, .008, .016, 0, 32), boxAt(.026, LM - .07, .034, 0, .04 + (LM - .07) / 2, 0), cylX(.026, .04, -.02, LM, 18)]), 'steel');
      pc = piece('link');
      links = new THREE.InstancedMesh(merge([boxAt(.022, LL - .03, .024, 0, LL / 2, 0), cylX(.019, .028, -.014, 0, 14), cylX(.019, .028, -.014, LL, 14)]), M(pc, 'tiDark'), NC - 1);
      links.userData.inst = true; links.frustumCulled = false; for (let i = 0; i < NC - 1; i++) links.setMatrixAt(i, m1.identity()); reg(pc, links);

      pc = piece('crank'); crankG = sub(pc);
      into(crankG, add(pc, merge([revolve([[-.62, 0], [-.62, .028], [-.5, .03], [-.30, .034], [-.30, .04], [-.058, .04], [-.058, 0]]), revolve([[.058, 0], [.058, .04], [.11, .04], [.11, 0]]), cylX(.04, .06, -.03, RC, 24)]), 'steel'));
      const cheek = () => { const s = new THREE.Shape();
        for (let a = -90; a <= 90; a += 15) a === -90 ? s.moveTo(RC, -.052) : s.lineTo(RC + .052 * Math.cos(a * DEG), .052 * Math.sin(a * DEG));
        for (let a = 115; a <= 245; a += 10) s.lineTo(.135 * Math.cos(a * DEG), .135 * Math.sin(a * DEG));
        s.closePath(); return s; };
      into(crankG, add(pc, merge([ext(cheek(), .028, -.058), ext(cheek(), .028, .03)]), 'tiDark'));

      pc = piece('case', { clip: 1, shell: 1, moves: [mx(-.22, .4, .9)] });
      add(pc, revolve([[-.09, .21], [0, .21], [0, .172], [-.075, .172], [-.075, .06], [-.09, .06]]), 'caseGrey');
      pc = piece('case', { clip: 1, shell: 1, moves: [mx(.22, .4, .9)] });
      add(pc, revolve([[0, .21], [.09, .21], [.09, .06], [.075, .06], [.075, .172], [0, .172]]), 'caseGrey'); }

    /* 15 impeller, 16 blower section and intake pipes, 17 ignition, 18 accessory case, 19 carburettor */
    let impG;
    { let pc = piece('imp', { moves: [mx(.45, .35, .9)] }); impG = sub(pc);
      into(impG, add(pc, merge([revolve([[.12, 0], [.12, .03], [.165, .05], [.165, .115], [.173, .115], [.173, 0]]), ...[...Array(12)].map((_, k) => boxAt(.04, .085, .004, .145, .0725, 0).applyMatrix4(RX(k * PI / 6)))]), 'alu'));

      pc = piece('blower', { clip: 1, shell: 1, moves: [mx(.75)] });
      add(pc, revolve([[.09, .21], [.12, .228], [.19, .238], [.215, .205], [.24, .205], [.24, .19], [.21, .19], [.185, .224], [.123, .214], [.09, .196]]), 'caseGrey');
      row(pc, tube([[.17, .222, .081], [.2, .30, .075], [.21, .40, .04], [.18, .47, .01], [.135, .49, 0]], .022), 'black', NC);

      pc = piece('ign', { moves: [mx(.5)] });
      add(pc, new THREE.TorusGeometry(.285, .009, 8, 72).rotateY(PI / 2).translate(.135, 0, 0), 'gold');
      row(pc, merge([tube([[.135, .285, .02], [.125, .38, .04], [.1, .47, .045], [.125, .515, .04]], .005, 16), tube([[.135, .285, -.03], [.12, .36, -.12], [0, .44, -.142], [-.08, .5, -.1], [-.125, .515, -.04]], .005, 20)]), 'gold', NC);
      row(pc, merge([cylX(.009, .06, .09, .515, 8).translate(0, 0, .04), cylX(.009, .06, -.15, .515, 8).translate(0, 0, -.04)]), 'ceramic', NC);
      pc = piece('ign', { moves: [mx(1.45)] });
      row(pc, merge([boxAt(.11, .085, .075, .43, .125, 0), cylX(.032, .025, .485, .125, 16)]), 'black', 2, { ang: i => (i ? 1 : -1) * 40 * DEG });

      pc = piece('acc', { clip: 1, shell: 1, moves: [mx(1.1)] });
      add(pc, revolve([[.24, .205], [.30, .19], [.36, .14], [.38, .09], [.38, 0], [.368, 0], [.368, .085], [.35, .132], [.295, .178], [.24, .19]]), 'caseGrey');
      add(pc, cylX(.055, .13, .37, 0, 20), 'castDark');
      add(pc, cylX(.04, .15, .33, .12, 16).applyMatrix4(RX(150 * DEG)), 'castDark');
      add(pc, boxAt(.08, .07, .08, .33, -.165, 0), 'blueAnod');

      pc = piece('carb', { moves: [mx(.75), my(-.5, .5, .95)] });
      add(pc, merge([boxAt(.11, .12, .11, .29, -.31, 0), cylY(.04, -.25, -.19, .27)]), 'castAl');
      add(pc, merge([cylY(.042, -.43, -.37, .29), boxAt(.03, .02, .14, .29, -.3, 0)]), 'gold'); }

    /* motion: the crank angle is the master, rods, pistons and valve gear follow from it */
    const S = new Float32Array(NC), lift = new Float32Array(18), phase = new Float32Array(NC);
    const bump = (c, open) => c >= open && c <= open + DUR ? Math.sin(PI * (c - open) / DUR) ** 2 : 0;
    const run = { rpm: ctx.reduced ? 0 : 1100, theta: 0 }, col = new THREE.Color();
    function pose(vis) {
      const th = run.theta, pu = RC * Math.cos(th), pv = RC * Math.sin(th);
      crankG.rotation.x = propG.rotation.x = th; camG.rotation.x = -th / 8; impG.rotation.x = th * 10;
      S[0] = pu + Math.sqrt(LM * LM - pv * pv);
      const phm = Math.atan2(-pv, S[0] - pu);
      master.position.set(0, pu, pv); master.rotation.x = phm;
      for (let i = 1; i < NC; i++) {
        const a = A(i), ca = Math.cos(a), sa = Math.sin(a), ku = pu + RK * Math.cos(phm + a), kv = pv + RK * Math.sin(phm + a), d = ku * ca + kv * sa;
        S[i] = d + Math.sqrt(Math.max(0, LL * LL - (ku * ku + kv * kv - d * d)));
        links.setMatrixAt(i - 1, m1.makeTranslation(0, ku, kv).multiply(m2.makeRotationX(Math.atan2(S[i] * sa - kv, S[i] * ca - ku))));
      }
      links.instanceMatrix.needsUpdate = true; links.boundingSphere = null;
      setRow(pistonPc, pistonRow, i => m3.makeTranslation(0, S[i], 0));
      const deg = th / DEG;
      for (let i = 0; i < NC; i++) {     // cylinder i fires at 40°·i, plus one full turn for the even-numbered cylinders
        const c = (((deg - 40 * i - (i & 1 ? 360 : 0)) % 720) + 720) % 720; phase[i] = c;
        lift[2 * i] = bump(c, EX_OPEN); lift[2 * i + 1] = bump(c, IN_OPEN);
      }
      setRow(pushPc, pushRow, i => m3.makeTranslation(0, lift[i] * LIFT, 0));
      setRow(rockPc, rockRow, i => m3.makeRotationZ(-lift[i] * .28));
      setRow(valvePc, valveRow, i => m3.makeTranslation(0, -lift[i] * LIFT, 0));
      gas.visible = vis > .005; if (!gas.visible) return;
      for (let i = 0; i < NC; i++) {
        const c = phase[i], top = S[i] + .068;
        m1.makeRotationX(A(i)).multiply(m2.makeTranslation(0, top + pistonPc.b, 0)).multiply(m3.makeScale(1, Math.max(.004, .468 - top), 1)); gas.setMatrixAt(i, m1);
        if (c < 180) { const k = Math.pow(1 - c / 180, 1.6); col.setRGB(.25 + 1.1 * k, .12 + .5 * k, .06 + .1 * k); }          // power: bright flash that fades
        else if (c < 360) col.setRGB(.26, .16, .13);                                                                         // exhaust
        else if (c < 540) col.setRGB(.12, .3, .6);                                                                           // intake
        else { const k = (c - 540) / 180; col.setRGB(.12 + .5 * k, .3 + .45 * k, .6 + .35 * k); }                             // compression
        gas.setColorAt(i, col.multiplyScalar(vis));
      }
      gas.instanceMatrix.needsUpdate = true; gas.instanceColor.needsUpdate = true;
    }
    pose(0);
    const fmt = n => Math.round(n).toLocaleString('en-US');
    return {
      step(dt, s) {
        const target = s.run ? 600 + 1650 * s.power : 0;
        run.rpm += (target - run.rpm) * (1 - Math.exp(-dt / (s.run ? 1.6 : 3)));
        if (!s.run && run.rpm < 2) run.rpm = 0;
        run.theta += run.rpm / 60 / 30 * TAU * dt;
        pose(s.flowVis);
      },
      readouts: () => [
        { v: fmt(run.rpm), sub: 'propeller turns with it', f: run.rpm / 2250 },
        { v: fmt(run.rpm / 8), sub: 'against the crank', f: run.rpm / 2250 },
        { v: fmt(600 * Math.pow(clamp(run.rpm / 2250, 0, 1), 2.2)), sub: 'approximate' }],
      active: () => run.rpm > 1,
    };
  },
};
