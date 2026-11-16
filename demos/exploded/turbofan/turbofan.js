/* Machine definition: two-spool high-bypass turbofan. Used with exploded.js. */
import { THREE, TAU, PI, DEG, lerp, clamp, smooth, table, polar, revolve, rect, ringTube, blade, merge, cylX, cylY, boxAt, pipe, mx, my, mz, mv } from '../exploded.js';

const INFO = [
 { id:'inlet', name:'Inlet cowl', group:'Nacelle', spool:'static', ext:true, label:{at:[-.62,25,1.0],len:[.34,.34]},
   text:['Shapes the incoming air into a smooth, even stream before it meets the fan, also in crosswinds and at steep climb angles.','The polished lip is heated from inside so ice cannot build up and break off into the fan. The inner barrel is lined with perforated acoustic panels that absorb fan noise.'],
   specs:[['Lip','Aluminium, anti-iced'],['Inner barrel','Acoustic honeycomb liner'],['Throat diameter','≈ 1.50 m']] },
 { id:'fancowl', name:'Fan cowl doors', group:'Nacelle', spool:'static', ext:true, label:{at:[.5,55,1.04],len:[.3,.3]},
   text:['Two hinged doors that wrap the fan case and give the nacelle its smooth outer skin. They carry no engine loads.','Mechanics unlatch them along the bottom and prop them open to reach the accessory gearbox and the units mounted around the fan case.'],
   specs:[['Construction','Composite sandwich skins'],['Hinged at','Pylon, top of nacelle'],['Latches','Bottom centreline']] },
 { id:'reverser', name:'Thrust reverser sleeve', group:'Nacelle', spool:'static', ext:true, label:{at:[1.9,55,.97],len:[.3,.3]},
   text:['Forms the outer wall of the bypass duct and the fan nozzle. On landing the sleeve slides aft, blocker doors close the duct and the fan air escapes forward through cascade vanes.','Only the cold bypass stream is reversed. That is enough, because it carries most of the thrust.'],
   specs:[['Type','Translating sleeve with cascades'],['Reverses','Bypass air only'],['Nozzle exit','Ø ≈ 1.6 m']] },
 { id:'corecowl', name:'Core cowl', group:'Nacelle', spool:'static', ext:false, label:{at:[1.3,175,.5],len:[.8,.3]},
   text:['The inner wall of the bypass duct. It keeps the fast, cold fan stream away from the core and encloses the pipes, harnesses and actuators that crowd the outside of the compressor and combustor.','Like the outer doors it opens in two halves for maintenance.'],
   specs:[['Construction','Composite with heat blankets'],['Encloses','Core compartment']] },
 { id:'spinner', name:'Spinner', group:'Fan module', spool:'n1', ext:true, label:{at:[-.25,150,.12],len:[.62,.4],dir:[-.8,-.55,.25]},
   text:['Streamlines the hub and guides air toward the blade roots. Its shape and the rotor\'s vibration help it shed ice.','The white swirl is a safety marking. It makes a turning engine obvious to anyone standing in front of it.'],
   specs:[['Turns with','N1 spool (fan)'],['Material','Aluminium or composite']] },
 { id:'fan', name:'Fan rotor', group:'Fan module', spool:'n1', ext:true, label:{at:[.1,35,.6],len:[1.5,.45],dir:[-.88,.4,.26]},
   text:['A single stage of wide-chord blades with two jobs. It supercharges the core and, far more important, pushes a large mass of air around it.','In a high-bypass engine roughly four fifths of take-off thrust comes from this bypass air. The blade tips move faster than sound at take-off.'],
   specs:[['Blades','24, wide chord'],['Diameter','1.55 m'],['Take-off speed','≈ 5,200 rpm'],['Tip speed','≈ 420 m/s']] },
 { id:'fancase', name:'Fan case', group:'Fan module', spool:'static', ext:false, label:{at:[.12,0,.874],len:[.43,.25]},
   text:['Guides the flow around the fan and serves as armour. Certification requires that a fan blade released at full speed stays inside the engine.','The ring is therefore thickened around the fan plane and often wrapped in aramid fibre, shown here as the golden band.'],
   specs:[['Task','Blade containment'],['Wrap','Aramid (Kevlar) fibre'],['Inner lining','Abradable rub strip']] },
 { id:'frame', name:'Fan frame and guide vanes', group:'Fan module', spool:'static', ext:false, label:{at:[.75,0,.83],len:[.47,.25]},
   text:['The structural backbone of the engine. The outlet guide vanes straighten the swirling air that leaves the fan, so its energy becomes thrust instead of spin.','Behind them, thick struts carry the weight and thrust of the engine to the forward mount. One strut hides the drive shaft to the gearbox. The sharp ring in the middle is the splitter, where core air and bypass air part ways.'],
   specs:[['Outlet guide vanes','46'],['Struts','10'],['Carries','Forward engine mount']] },
 { id:'booster', name:'Booster rotor', group:'Fan module', spool:'n1', ext:false, label:{at:[.5,90,.36],len:[.94,.45]},
   text:['Three small compressor stages bolted behind the fan disc and turning at fan speed. They give the core air a first squeeze before it reaches the high-pressure compressor.','Also called the low-pressure compressor.'],
   specs:[['Stages','3'],['Turns with','N1 spool (fan)'],['Material','Titanium alloy']] },
 { id:'boosterstat', name:'Booster stator case', group:'Fan module', spool:'static', ext:false, label:{at:[.5,0,.39],len:[1.11,.3]},
   text:['Rings of fixed vanes between the rotor stages. Each ring turns the air back toward the axis and converts its speed into pressure, ready for the next rotor.','Bleed valves behind the booster dump surplus air at low power so the two compressors stay matched.'],
   specs:[['Vane rings','4'],['Shown as','Upper and lower half']] },
 { id:'hpc', name:'HP compressor rotor', group:'Core', spool:'n2', ext:false, label:{at:[1.25,90,.27],len:[1.03,.45]},
   text:['Nine stages of ever shorter blades on one drum. Each stage adds a modest pressure rise. Together with the fan and booster they deliver air at around 30 times atmospheric pressure.','Compression alone heats the air to more than 500 °C before any fuel is burned. The cone at the back is the shaft that connects the drum to its turbine.'],
   specs:[['Stages','9'],['Take-off speed','≈ 14,500 rpm'],['Overall pressure ratio','≈ 30 : 1'],['Materials','Titanium front, nickel alloy rear']] },
 { id:'hpccase', name:'HP compressor case', group:'Core', spool:'static', ext:false, label:{at:[1.3,0,.29],len:[1.01,.3]},
   text:['The case splits lengthwise into two halves so the rotor can be lifted out. It holds the stator vanes between the rotor stages.','The vanes of the first rows pivot. Rings and small lever arms on the outside turn every vane of a row together, which keeps the airflow from stalling as engine speed changes.'],
   specs:[['Variable vane rows','4'],['Moved by','Fuel-powered actuators'],['Split','Horizontal, bolted']] },
 { id:'combcase', name:'Combustor case', group:'Core', spool:'static', ext:false, label:{at:[1.9,0,.335],len:[.965,.3]},
   text:['The pressure vessel of the engine. It contains the highest pressure anywhere in the machine and passes structural loads from the compressor to the turbine.','A short diffuser at the front slows the compressor air so the flame is not blown out.'],
   specs:[['Holds','≈ 30 bar at take-off'],['Ports','20 fuel nozzles, 2 igniters']] },
 { id:'fuel', name:'Fuel nozzles and manifold', group:'Core', spool:'static', ext:false, label:{at:[1.655,180,.405],len:[1.1,.4]},
   text:['Twenty nozzles spray fuel as a fine, swirling mist into the combustor. Ring manifolds feed them from the fuel control.','Two igniter plugs light the mixture during start. After that the flame sustains itself and the igniters switch off.'],
   specs:[['Fuel nozzles','20'],['Igniters','2'],['Fuel','Jet A-1 kerosene']] },
 { id:'liner', name:'Combustor liner', group:'Core', spool:'static', ext:false, label:{at:[1.9,180,.297],len:[1.0,.42]},
   text:['A ring-shaped chamber in which fuel burns continuously. The core of the flame is hotter than 2,000 °C, far beyond what the metal survives.','Only part of the air takes part in combustion. The rest enters through rows of holes to lay a cool film along the walls and to dilute the gas to a temperature the turbine can accept.'],
   specs:[['Type','Annular'],['Flame temperature','> 2,000 °C'],['Wall cooling','Film and dilution air']] },
 { id:'ngv', name:'HP turbine nozzle', group:'Turbines and exhaust', spool:'static', ext:false, label:{at:[2.08,0,.312],len:[1.19,.38]},
   text:['A ring of fixed vanes that accelerates the gas and swings it onto the turbine blades. These vanes meet the hottest gas in the engine.','They are hollow and fed with cooling air taken from the compressor. The ring behind the vanes is the shroud that seals the tips of the turbine blades.'],
   specs:[['Gas temperature','≈ 1,300–1,600 °C'],['Cooling','Internal air and surface film'],['Coating','Ceramic thermal barrier']] },
 { id:'hpt', name:'HP turbine rotor', group:'Turbines and exhaust', spool:'n2', ext:false, label:{at:[2.107,90,.29],len:[1.01,.45]},
   text:['One stage of blades that extracts the power to drive the HP compressor and the gearbox. The gas around the blades is hotter than the melting point of the alloy they are made of.','Each blade is cast as a single crystal of nickel superalloy, cooled from inside, wrapped in a film of air from tiny holes and coated with ceramic.'],
   specs:[['Stages','1'],['Blades','80'],['Blade material','Single-crystal nickel superalloy'],['Drives','HP compressor, gearbox']] },
 { id:'lpt', name:'LP turbine rotor', group:'Turbines and exhaust', spool:'n1', ext:false, label:{at:[2.5,90,.38],len:[.92,.45]},
   text:['Four stages that take most of what is left in the gas and send it forward through the long central shaft to the fan and booster.','Because they turn at slow fan speed, these stages need a large diameter and many long blades to do their work.'],
   specs:[['Stages','4'],['Drives','Fan and booster'],['Blades','Shrouded tips']] },
 { id:'lptcase', name:'LP turbine case', group:'Turbines and exhaust', spool:'static', ext:false, label:{at:[2.5,0,.395],len:[.905,.3]},
   text:['A conical case that holds the fixed vane rings between the rotor stages.','The tubes around it blow cool air onto the case in cruise. The case shrinks slightly, the gap at the blade tips closes and less gas leaks past. This is called active clearance control.'],
   specs:[['Vane rings','4'],['Tip gap control','Cooling air tubes'],['Shown as','Upper and lower half']] },
 { id:'trf', name:'Turbine rear frame', group:'Turbines and exhaust', spool:'static', ext:false, label:{at:[2.87,180,.452],len:[.6,.3]},
   text:['Carries the rear bearing of the LP shaft and the aft engine mount. Its struts also straighten the gas leaving the last turbine stage.'],
   specs:[['Struts','14'],['Carries','Aft mount, rear bearing']] },
 { id:'nozzle', name:'Core nozzle', group:'Turbines and exhaust', spool:'static', ext:true, label:{at:[3.2,25,.43],len:[.3,.3]},
   text:['Accelerates the hot core gas one last time. This stream supplies the remaining fifth or so of the thrust.'],
   specs:[['Exit gas','Several hundred °C'],['Material','Titanium or nickel alloy']] },
 { id:'plug', name:'Exhaust plug', group:'Turbines and exhaust', spool:'static', ext:true, label:{at:[3.6,200,.13],len:[.45,.4]},
   text:['The cone in the centre of the exhaust. It shapes a ring-shaped passage so the gas expands smoothly and does not separate into turbulence behind the turbine hub.'],
   specs:[['Also called','Centre body'],['Material','Titanium or nickel alloy']] },
 { id:'shaft', name:'LP shaft', group:'Shafts and drives', spool:'n1', ext:false, label:{at:[2.47,180,.045],len:[1.45,.6]},
   text:['A long, slender shaft that runs through the hollow centre of the HP spool. It connects the LP turbine at the back with the fan and booster at the front.','The two spools are linked only by the gas that flows through them. Each turns at its own speed.'],
   specs:[['Connects','LP turbine to fan'],['Runs inside','HP spool'],['Length','≈ 2.8 m']] },
 { id:'agb', name:'Accessory gearbox', group:'Shafts and drives', spool:'static', ext:false, label:{at:[.12,180,.955],len:[.35,.28]},
   text:['Driven from the HP spool through a radial shaft inside a frame strut, it turns the fuel pump, oil pumps, hydraulic pump and electrical generator.','During start the power flows the other way. An air-turbine starter on the gearbox spins the HP spool until the engine runs on its own.'],
   specs:[['Driven by','N2 spool (core)'],['Drives','Fuel, oil, hydraulics, generator'],['Start','Air-turbine starter']] },
];
const KIND = { n1: 'a', n2: 'b', static: 's' };
const VIEW = { inlet: [-.72, .28], spinner: [-.72, .28], fan: [-.72, .28], fancase: [-.72, .28], trf: [.62, .26], nozzle: [.62, .26], plug: [.62, .26] };

export default {
  docTitle: 'Turbofan Exploded View',
  eyebrow: 'Exploded · Plate 01', title: 'Turbofan', sub: 'Two-spool high-bypass jet engine, taken apart into 24 assemblies',
  facts: [
    { k: 'Stages', v: '1-3-9-1-4', tip: 'Stages: 1 fan, 3 booster, 9 high-pressure compressor, 1 high-pressure turbine, 4 low-pressure turbine' },
    { k: 'Fan', v: 'Ø 1.55 m' }, { k: 'Bypass ratio', v: '≈ 5 : 1' }],
  note: 'Illustrative model built from simple geometry. The layout, stage counts and figures are typical of the engines on single-aisle airliners (CFM56 class); it is not a drawing of a specific engine type.',
  kinds: { a: { short: 'N1', label: 'N1 spool' }, b: { short: 'N2', label: 'N2 spool' }, s: { short: 'Static', label: 'Static' } },
  groups: ['Nacelle', 'Fan module', 'Core', 'Turbines and exhaust', 'Shafts and drives'],
  parts: INFO.map(d => { const [x, th, r] = d.label.at; return { ...d, kind: KIND[d.spool], view: VIEW[d.id],
    label: { at: [x, r * Math.cos(th * DEG), r * Math.sin(th * DEG)], dir: d.label.dir || [0, Math.cos(th * DEG), Math.sin(th * DEG)], len: d.label.len } }; }),
  controls: { run: 'Engine', power: 'Thrust', flow: 'Airflow', powerDefault: .35 },
  gauges: [{ label: 'N1 % · fan', color: 'var(--n1)', arc: true }, { label: 'N2 % · core', color: 'var(--n2)', arc: true }, { label: 'EGT °C' }],
  gaugeNote: 'Rotation shown 150× slower than real',
  camera: { az: -.62, el: .3, paz: -1.16, pel: .42, focus: [-.24, .2] },
  glow: { tbc: .18, linerHot: .5, glowHole: 3.2 },
  materials(std, phy) {
    const spinTex = (() => {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#17191d'; g.fillRect(0, 0, 512, 256); g.fillStyle = '#f2f2ee'; g.beginPath();
      const L = [], R = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, v = .16 + .78 * t, u = .12 + .62 * t, w = .012 + .075 * t; L.push([(u - w / 2) * 512, (1 - v) * 256]); R.push([(u + w / 2) * 512, (1 - v) * 256]); }
      [...L, ...R.reverse()].forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
    })();
    return {
      band: phy(0x20242b, .1, .42, { clearcoat: .7, clearcoatRoughness: .2 }),
      acoustic: std(0x4b5058, .35, .78),
      cowl: std(0x737a83, 1, .46),
      fanblade: std(0xb3b8bf, 1, .3),
      kevlar: std(0xb89238, 0, .78),
      tbc: std(0xc6b99e, .08, .82, { emissive: 0xff3b12, emissiveIntensity: 0 }),
      linerHot: std(0x6f5a49, 1, .5, { emissive: 0xff4a12, emissiveIntensity: 0 }),
      glowHole: std(0x140b06, 0, .9, { emissive: 0xff7a1c, emissiveIntensity: 0 }),
      exhaust: std(0x857567, 1, .36),
      spinner: phy(0xffffff, .2, .36, { map: spinTex, clearcoat: .6, clearcoatRoughness: .25 }),
    };
  },

  build(ctx) {
    const { scene, add, reg, M, byId } = ctx;
    const QUAD = [[0, -1, 0, 0, 0, 0], [0, 0, -1, 0, 0, 0]];   // cutaway removes the upper front quarter
    const piece = (id, o = {}) => { const pc = ctx.piece(id, { ...o, clip: o.clip ? QUAD : null }); pc.burst = []; return pc; };
    const mb = (d, a, b) => mv('b', d, a, b);
    function row(pc, geom, k, count, o = {}) {
      const im = new THREE.InstancedMesh(geom, M(pc, k), count), m = new THREE.Matrix4(), angles = [];
      for (let i = 0; i < count; i++) {
        const a = o.angles ? o.angles[i] : o.a0 !== undefined ? o.a0 + (o.a1 - o.a0) * (i + .5) / count : i / count * TAU + (o.phase || 0);
        angles.push(a); im.setMatrixAt(i, m.makeRotationX(a));
      }
      im.userData.inst = true;
      if (o.burst) {
        pc.burst.push({ im, angles }); im.frustumCulled = false;
        pc.onChan = ch => { const t = new THREE.Matrix4().makeTranslation(0, ch.b || 0, 0);
          for (const { im, angles } of pc.burst) { angles.forEach((a, i) => im.setMatrixAt(i, m.makeRotationX(a).multiply(t))); im.instanceMatrix.needsUpdate = true; } };
      }
      return reg(pc, im);
    }
    const UP = { a0: -PI / 2, a1: PI / 2 }, DN = { a0: PI / 2, a1: 1.5 * PI };

    /* 01 inlet cowl */
    { const pc = piece('inlet', { clip: 1, shell: 1, moves: [mx(-2.75, .08, .85)] });
      add(pc, revolve([[-.88, .752], [-.94, .76], [-.99, .775], [-1.03, .80], [-1.05, .835], [-1.035, .872], [-.99, .905], [-.94, .93], [-.88, .947]], { closed: false, crease: 1.2 }), 'lip');
      add(pc, revolve([[-.88, .947], [-.75, .975], [-.55, 1.0], [-.32, 1.02], [-.12, 1.03]], { closed: false, crease: 1.2 }), 'paint');
      add(pc, revolve([[-.12, 1.03], [-.12, .78], [-.45, .766], [-.72, .75], [-.88, .752]], { closed: false }), 'acoustic');
      add(pc, revolve([[-.875, .9505], [-.82, .9625], [-.775, .9715]], { closed: false, crease: 1.2 }), 'band'); }

    /* 02 fan cowl doors, 03 reverser sleeve, 04 core cowl: left and right halves */
    for (const s of [1, -1]) {
      const arc = s > 0 ? { a0: .05, a1: PI - .05 } : { a0: PI + .05, a1: TAU - .05 }, ribArc = { a0: arc.a0 + .04, a1: arc.a1 - .04, seg: 72 };
      let pc = piece('fancowl', { clip: 1, shell: 1, moves: [mz(1.15 * s, 0, .2), my(1.72, .16, .46), mx(-1.15, .3, .8)] });
      add(pc, revolve([[-.12, 1.03], [.5, 1.04], [1.15, 1.03], [1.15, .995], [.5, 1.005], [-.12, .995]], arc), 'paint');
      for (const x of [.13, .7, .92, 1.1]) add(pc, rect(x - .012, x + .012, .966, .998, ribArc), 'carbon');
      { const sh = new THREE.Shape([[0, 0], [.72, 0], [.6, .13], [.2, .1]].map(p => new THREE.Vector2(p[0], p[1])));
        add(pc, new THREE.ExtrudeGeometry(sh, { depth: .014, bevelEnabled: false }).translate(.2, 1.03, -.007).applyMatrix4(new THREE.Matrix4().makeRotationX(s * 58 * DEG)), 'band'); }
      pc = piece('reverser', { clip: 1, shell: 1, moves: [mz(1.15 * s, 0, .2), my(1.72, .16, .46), mx(1.2, .3, .8)] });
      add(pc, revolve([[1.15, 1.03], [1.6, 1.012], [2.1, .935], [2.55, .81], [2.55, .797], [2.1, .80], [1.6, .815], [1.15, .80]], { ...arc, crease: .5 }), 'paint');
      pc = piece('corecowl', { clip: 1, shell: 1, moves: [mz(.55 * s, .2, .42), my(-1.45, .4, .7), mx(1.0, .45, .85), mz(.2 * s, .6, .8)] });
      const co = [[.72, .445], [1.0, .48], [1.6, .52], [2.2, .52], [2.7, .50], [2.95, .47]];
      add(pc, revolve([...co, ...co.slice().reverse().map(([x, r]) => [x, r - .018])], { ...arc, crease: .5 }), 'cowl');
    }

    /* 05 spinner, 06 fan rotor */
    { let pc = piece('spinner', { moves: [mx(-2.05, .1, .85)] });
      add(pc, revolve([[-.42, 0], [-.405, .02], [-.36, .05], [-.28, .10], [-.18, .158], [-.08, .208], [-.02, .234]], { closed: false, crease: 1.2 }), 'spinner');
      pc = piece('fan', { moves: [mx(-1.7, .15, .85)] });
      add(pc, revolve([[-.02, .235], [.24, .25], [.24, .19], [.16, .16], [.16, .09], [.20, .075], [.20, .055], [.02, .055], [.02, .09], [.06, .16], [-.02, .19]]), 'titanium');
      row(pc, blade({ r0: .238, r1: .768, c0: .2, c1: .265, stag: f => (13 + 47 * Math.pow(f, .85)) * DEG, th0: .085, th1: .028, cam0: -.09, cam1: -.012, nS: 16, nP: 11, x: .115, sweep: f => -.035 * Math.sin(PI * f) + .02 * f }), 'fanblade', 24); }

    /* 07 fan case */
    { const pc = piece('fancase', { clip: 1, shell: 1, moves: [mx(-1.15, .3, .8)] });
      add(pc, revolve([[-.12, .815], [-.07, .815], [-.07, .85], [.30, .85], [.30, .815], [.36, .815], [.36, .78], [-.12, .78]]), 'alu');
      add(pc, rect(-.06, .29, .851, .874), 'kevlar');
      add(pc, rect(-.12, -.105, .815, .846), 'alu'); add(pc, rect(.345, .36, .815, .846), 'alu'); }

    /* 08 fan frame and outlet guide vanes */
    { const pc = piece('frame', { clip: 1, shell: 1, moves: [mx(-.2, .3, .8)] });
      add(pc, revolve([[.36, .83], [1.15, .83], [1.15, .80], [.72, .782], [.36, .78]]), 'titanium');
      add(pc, rect(.36, .375, .83, .856), 'titanium');
      row(pc, blade({ r0: .435, r1: .785, c0: .12, c1: .13, s0: -22 * DEG, s1: -14 * DEG, th0: .07, cam0: .07, nS: 6, nP: 7, x: .47 }), 'alu', 46);
      row(pc, blade({ r0: .16, r1: .79, c0: .16, c1: .22, th0: .2, th1: .16, nS: 4, nP: 8, x: .83 }), 'titanium', 10);
      add(pc, revolve([[.30, .405], [.33, .426], [.42, .44], [.72, .445], [.72, .43], [.42, .425], [.33, .411]]), 'titanium');
      add(pc, revolve([[.72, .384], [.80, .362], [.92, .322], [.92, .31], [.80, .35], [.72, .372]]), 'titanium');
      add(pc, revolve([[.72, .262], [.80, .23], [.92, .17], [.92, .158], [.80, .218], [.72, .25]]), 'titanium');
      add(pc, revolve([[.74, .238], [.84, .09], [.89, .09], [.89, .072], [.83, .072], [.71, .25]]), 'tiDark'); }

    /* 09 booster rotor, 10 booster stator halves */
    { const outer = x => lerp(.385, .36, (x - .30) / .42);
      let pc = piece('booster', { moves: [mx(-.78, .3, .8)] });
      add(pc, revolve([[.245, .25], [.30, .262], [.50, .268], [.70, .262], [.70, .24], [.50, .246], [.30, .24], [.245, .228]]), 'titanium');
      [.37, .50, .63].forEach((x, i) => row(pc, blade({ r0: .262, r1: outer(x) - .004, c0: .05, s0: 28 * DEG, s1: 42 * DEG, th0: .08, cam0: -.08, nS: 4, nP: 6, x }), 'titanium', [62, 68, 72][i]));
      for (const [h, sg] of [[UP, 1], [DN, -1]]) {
        pc = piece('boosterstat', { clip: 1, shell: 1, moves: [mx(-.78, .3, .8), my(.55 * sg, .72, 1)] });
        add(pc, revolve([[.30, .397], [.72, .372], [.72, .36], [.30, .385]], h), 'alu');
        for (const x of [.315, .435, .565, .69]) row(pc, blade({ r0: .27, r1: outer(x) + .002, c0: .04, s0: -20 * DEG, th0: .08, cam0: .07, nS: 3, nP: 6, x }), 'alu', 38, h);
      } }

    /* 11 HP compressor rotor, 12 HP compressor case halves */
    { const hub = table([[.94, .165], [1.10, .185], [1.30, .20], [1.62, .215]]), tip = x => lerp(.31, .245, (x - .92) / .72), wo = x => lerp(.322, .258, (x - .92) / .72);
      let pc = piece('hpc', { moves: [mx(.1)] });
      add(pc, revolve([[.90, .085], [.94, .165], [1.10, .185], [1.30, .20], [1.62, .215], [1.66, .215], [1.76, .115], [2.06, .115], [2.06, .14], [2.075, .14], [2.075, .095], [1.74, .095], [1.64, .19], [1.30, .178], [1.10, .162], [.955, .145], [.915, .07], [.90, .07]]), 'titanium');
      const xs = [...Array(9)].map((_, i) => .965 + .075 * i);
      xs.forEach((x, i) => row(pc, blade({ r0: hub(x), r1: tip(x) - .003, c0: lerp(.05, .026, i / 8), s0: 32 * DEG, s1: 50 * DEG, th0: .07, cam0: -.07, nS: i < 3 ? 4 : 3, nP: 6, x }), i < 5 ? 'titanium' : 'nickel', [38, 48, 56, 64, 70, 76, 80, 80, 76][i]));
      for (const [h, sg] of [[UP, 1], [DN, -1]]) {
        pc = piece('hpccase', { clip: 1, shell: 1, moves: [mx(.1), my(.5 * sg, .72, 1)] });
        add(pc, revolve([[.92, .322], [1.64, .258], [1.64, .245], [.92, .31]], h), 'steel');
        add(pc, rect(.92, .935, .322, .352, h), 'steel'); add(pc, rect(1.625, 1.64, .259, .29, h), 'steel');
        const sx = [.93, ...xs.map(x => x + .0375)];
        sx.forEach((x, i) => row(pc, blade({ r0: hub(Math.max(x, .94)) + .004, r1: tip(x) + .004, c0: lerp(.03, .02, i / 9), s0: -18 * DEG, th0: .08, cam0: .06, nS: 3, nP: 5, x }), 'steel', Math.round(lerp(24, 44, i / 9)), h));
        const sh = { a0: h.a0 + .1, a1: h.a1 - .1, seg: 72 };
        sx.slice(0, 4).forEach(x => {
          const xr = x + .03, r = wo(xr) + .02;
          add(pc, rect(xr - .007, xr + .007, r, r + .012, sh), 'tiDark');
          row(pc, merge([boxAt(.036, .005, .009, x + .015, wo(x) + .024), cylY(.005, wo(x), wo(x) + .024, x, 8)]), 'alu', 22, sh);
        });
        const th = sg > 0 ? .95 : PI + .95;
        add(pc, cylX(.016, .2, 1.0, .41).applyMatrix4(new THREE.Matrix4().makeRotationX(th)), 'gold');
        add(pc, ringTube(1.36, wo(1.36) + .034, .014, { a0: h.a0 + .25, a1: h.a1 - .25 }), 'steel');
        const t2 = sg > 0 ? -.5 : PI - .5;
        add(pc, pipe([[1.36, t2, wo(1.36) + .034], [1.39, t2, .355], [1.5, t2 + .08, .375], [1.62, t2 + .12, .372]], .02), 'steel');
      } }

    /* 13 combustor case, 14 fuel nozzles, 15 liner */
    { let pc = piece('combcase', { clip: 1, shell: 1, moves: [mx(.68)] });
      add(pc, revolve([[1.64, .29], [1.67, .305], [1.72, .335], [2.17, .335], [2.17, .322], [1.72, .322], [1.675, .292], [1.64, .276]]), 'steel');
      add(pc, rect(1.64, 1.654, .29, .322), 'steel'); add(pc, rect(2.155, 2.17, .335, .366), 'steel');
      add(pc, revolve([[1.64, .245], [1.69, .262], [1.69, .272], [1.64, .276]]), 'steel');
      row(pc, cylY(.017, .333, .353, 1.70), 'tiDark', 20);
      row(pc, cylY(.02, .333, .356, 1.82), 'tiDark', 2, { angles: [60 * DEG, 120 * DEG] });

      pc = piece('fuel', { moves: [mb(.15, .18, .36), mx(.42, .4, .85)] });
      for (const x of [1.655, 1.63]) add(pc, new THREE.TorusGeometry(.405, .011, 10, 96).rotateY(PI / 2).translate(x, 0, 0), 'copper');
      row(pc, merge([cylY(.008, .2375, .385, 1.70, 8), boxAt(.032, .012, .032, 1.70, .358), cylY(.015, .385, .412, 1.70, 10), cylX(.012, .05, 1.70, .2375, 10), cylX(.005, .05, 1.652, .405, 6)]), 'steel', 20, { burst: 1 });
      row(pc, merge([cylY(.011, .30, .40, 1.82, 8), cylY(.017, .36, .385, 1.82, 6)]), 'gold', 2, { angles: [60 * DEG, 120 * DEG], burst: 1 });

      pc = piece('liner', { clip: 1, moves: [mx(1.25)] });
      add(pc, revolve([[1.70, .262], [1.735, .287], [1.80, .289], [1.80, .293], [1.87, .293], [1.87, .297], [1.94, .297], [2.02, .295], [2.02, .289], [1.94, .291], [1.875, .291], [1.875, .287], [1.805, .287], [1.805, .283], [1.737, .281], [1.706, .259]]), 'linerHot');
      add(pc, revolve([[1.70, .213], [1.735, .19], [1.93, .205], [2.02, .245], [2.02, .251], [1.93, .211], [1.737, .196], [1.706, .216]]), 'linerHot');
      add(pc, rect(1.70, 1.706, .213, .262), 'linerHot');
      row(pc, cylX(.02, .014, 1.693, .2375, 14), 'nickelDark', 20);
      row(pc, new THREE.CylinderGeometry(.009, .009, .003, 10).translate(1.775, .2893, 0), 'glowHole', 36);
      row(pc, new THREE.CylinderGeometry(.01, .01, .003, 10).translate(1.905, .2985, 0), 'glowHole', 36, { phase: TAU / 72 });
      row(pc, new THREE.CylinderGeometry(.008, .008, .003, 10).translate(1.84, .1965, 0), 'glowHole', 24);
      const fm = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, clipIntersection: true });
      pc.flame = new THREE.Mesh(revolve([[1.72, .235], [1.76, .27], [1.9, .283], [2.0, .285], [2.0, .255], [1.9, .222], [1.76, .208]], { crease: 1.4 }), fm);
      pc.inner.add(pc.flame); pc.clipMats.push(fm); }

    /* 16 HP turbine nozzle, 17 HP turbine rotor */
    { let pc = piece('ngv', { clip: 1, moves: [mx(1.52)] });
      add(pc, revolve([[2.02, .297], [2.14, .297], [2.14, .312], [2.02, .31]]), 'nickel');
      add(pc, rect(2.02, 2.075, .231, .245), 'nickel');
      add(pc, revolve([[2.03, .231], [1.78, .15], [1.78, .142], [2.04, .223]]), 'nickelDark');
      row(pc, blade({ r0: .243, r1: .298, c0: .056, s0: -38 * DEG, th0: .2, cam0: -.13, nS: 3, nP: 7, x: 2.047 }), 'tbc', 38);
      pc = piece('hpt', { moves: [mx(1.76)] });
      add(pc, revolve([[2.085, .245], [2.13, .245], [2.13, .215], [2.115, .2], [2.115, .115], [2.14, .095], [2.14, .06], [2.075, .06], [2.075, .095], [2.10, .115], [2.10, .2], [2.085, .215]]), 'nickel');
      row(pc, blade({ r0: .243, r1: .2935, c0: .036, s0: 22 * DEG, s1: 30 * DEG, th0: .2, cam0: .2, nS: 4, nP: 7, x: 2.1075 }), 'tbc', 80); }

    /* 18 LP turbine rotor, 19 LP turbine case halves */
    { const hub = x => lerp(.245, .275, (x - 2.2) / .56), tip = x => lerp(.30, .43, (x - 2.2) / .56), wi = x => lerp(.308, .438, (x - 2.19) / .57);
      let pc = piece('lpt', { moves: [mx(2.02)] });
      add(pc, revolve([[2.215, .243], [2.735, .275], [2.735, .257], [2.215, .225]]), 'nickelDark');
      add(pc, revolve([[2.47, .238], [2.51, .238], [2.76, .075], [2.84, .075], [2.84, .052], [2.73, .052], [2.73, .068]]), 'nickelDark');
      [2.30, 2.44, 2.58, 2.705].forEach((x, i) => {
        row(pc, blade({ r0: hub(x), r1: tip(x) - .004, c0: .034, s0: 20 * DEG, s1: 38 * DEG, th0: .13, cam0: .16, nS: 4, nP: 6, x }), 'nickel', [108, 116, 120, 112][i]);
        add(pc, rect(x - .017, x + .017, tip(x) - .004, tip(x) + .002), 'nickel');
      });
      for (const [h, sg] of [[UP, 1], [DN, -1]]) {
        pc = piece('lptcase', { clip: 1, shell: 1, moves: [mx(2.02), my(.6 * sg, .72, 1)] });
        add(pc, revolve([[2.19, .322], [2.76, .452], [2.76, .438], [2.19, .308]], h), 'nickelDark');
        add(pc, rect(2.19, 2.205, .323, .36, h), 'nickelDark'); add(pc, rect(2.745, 2.76, .45, .468, h), 'nickelDark');
        [2.235, 2.37, 2.51, 2.645].forEach((x, i) => row(pc, blade({ r0: hub(x) + .004, r1: wi(x), c0: .036, s0: -30 * DEG, th0: .12, cam0: -.14, nS: 3, nP: 6, x }), 'nickel', [44, 48, 50, 48][i], h));
        for (const x of [2.30, 2.42, 2.54, 2.66]) add(pc, ringTube(x, wi(x) + .014 + .022, .007, { a0: h.a0 + .12, a1: h.a1 - .12 }), 'steel');
        const t = sg > 0 ? .9 : PI + .9;
        add(pc, pipe([[2.24, t, wi(2.24) + .048], [2.5, t, wi(2.5) + .048], [2.7, t, wi(2.7) + .048]], .012), 'steel');
      } }

    /* 20 turbine rear frame, 21 core nozzle, 22 exhaust plug, 23 LP shaft */
    { let pc = piece('trf', { clip: 1, moves: [mx(2.38)] });
      add(pc, rect(2.76, 2.98, .436, .452), 'nickelDark');
      add(pc, revolve([[2.76, .275], [2.98, .262], [2.98, .246], [2.76, .258]]), 'nickelDark');
      add(pc, revolve([[2.79, .258], [2.89, .085], [2.96, .085], [2.96, .066], [2.88, .066], [2.77, .25]]), 'nickelDark');
      row(pc, blade({ r0: .26, r1: .44, c0: .15, c1: .17, s0: 8 * DEG, th0: .14, cam0: .04, nS: 3, nP: 7, x: 2.87 }), 'nickel', 14);
      pc = piece('nozzle', { clip: 1, shell: 1, moves: [mx(2.76)] });
      add(pc, revolve([[2.98, .468], [3.15, .445], [3.42, .375], [3.42, .368], [3.15, .432], [2.98, .45]], { crease: .5 }), 'exhaust');
      pc = piece('plug', { moves: [mx(3.45)] });
      add(pc, revolve([[2.98, .262], [3.10, .262], [3.30, .228], [3.55, .145], [3.76, .05], [3.84, 0]], { closed: false, crease: 1.0 }), 'exhaust');
      pc = piece('shaft', { moves: [mx(1.28)] });
      add(pc, revolve([[.04, .045], [.22, .045], [.22, .062], [.26, .062], [.26, .045], [2.86, .045], [2.86, .03], [.04, .03]]), 'steel'); }

    /* 24 accessory gearbox */
    { const pc = piece('agb', { moves: [mx(-1.15, .3, .8), my(-.95, .55, .9)] });
      add(pc, rect(.02, .22, .885, .955, { a0: PI - .55, a1: PI + .55 }), 'castAl');
      const acc = (th, rad, len, front, k) => add(pc, cylX(rad, len, front ? .02 - len : .22, .92).applyMatrix4(new THREE.Matrix4().makeRotationX(th)), k);
      acc(PI - .36, .058, .13, true, 'steel'); acc(PI + .08, .042, .12, true, 'blueAnod'); acc(PI + .42, .036, .1, true, 'gold');
      acc(PI + .3, .064, .24, false, 'castDark'); acc(PI - .12, .05, .2, false, 'gold'); acc(PI - .42, .035, .1, false, 'black');
      add(pc, cylX(.016, .53, .22, -.92), 'steel');
      add(pc, boxAt(.1, .09, .1, .80, -.92), 'castAl');
      add(pc, cylY(.013, -.875, -.2, .80), 'steel'); }

    const liner = byId.liner.pieces[0]; liner.hideInBlue.push(liner.flame);
    const spin1 = ctx.pieces.filter(pc => pc.part.spool === 'n1'), spin2 = ctx.pieces.filter(pc => pc.part.spool === 'n2');

    /* airflow particles */
    const FLOW = (() => {
      const X0 = -2.4, X1 = 5.0, n = matchMedia('(max-width:760px)').matches ? 1500 : 3200;
      const bo = table([[-2.4, 1.0], [-1.05, .80], [-.72, .745], [0, .775], [.4, .78], [1.15, .80], [2.1, .80], [2.55, .795], [3.2, .78], [5, .80]]);
      const bi = table([[-2.4, .52], [-.45, .43], [0, .43], [.3, .42], [.72, .455], [1.6, .53], [2.2, .53], [2.95, .48], [3.42, .385], [5, .40]]);
      const cOut = table([[-2.4, .50], [-.45, .41], [0, .41], [.3, .385], [.72, .36], [.92, .31], [1.62, .245], [1.70, .26], [1.75, .283], [1.95, .288], [2.02, .295], [2.2, .30], [2.76, .43], [2.98, .435], [3.42, .365], [5, .36]]);
      const cIn = table([[-2.4, .03], [-.42, .03], [-.02, .24], [.3, .265], [.72, .265], [.92, .175], [1.62, .218], [1.70, .216], [1.75, .194], [1.95, .207], [2.02, .247], [2.76, .277], [2.98, .265], [3.35, .225], [3.84, .02], [5, .01]]);
      const cv = table([[-2.4, 1], [0, 1.1], [.9, .8], [1.6, .55], [1.95, .5], [2.1, 1.1], [2.8, 1.2], [3.4, 1.9], [5, 1.7]]);
      const stops = [[-2.4, .50, .82, 1], [.3, .50, .82, 1], [.92, .62, .88, 1], [1.6, 1, .92, .62], [1.76, 1, .96, .80], [1.95, 1, .70, .28], [2.2, 1, .48, .16], [2.8, 1, .36, .12], [3.5, .88, .32, .16], [5, .5, .22, .16]];
      const cr = table(stops.map(s => [s[0], s[1]])), cg = table(stops.map(s => [s[0], s[2]])), cb = table(stops.map(s => [s[0], s[3]]));
      const x = new Float32Array(n), f = new Float32Array(n), th = new Float32Array(n), core = new Uint8Array(n), sp = new Float32Array(n);
      for (let i = 0; i < n; i++) { x[i] = lerp(X0, X1, Math.random()); f[i] = .06 + .88 * Math.random(); th[i] = Math.random() * TAU; core[i] = Math.random() < .34 ? 1 : 0; sp[i] = .8 + .4 * Math.random(); }
      const pos = new Float32Array(n * 3), col = new Float32Array(n * 4), g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      g.setAttribute('aCol', new THREE.BufferAttribute(col, 4).setUsage(THREE.DynamicDrawUsage));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 1000 }, uSize: { value: .075 } },
        vertexShader: `attribute vec4 aCol; varying vec4 vC; uniform float uScale; uniform float uSize;
          void main(){ vC = aCol; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = max(1.5, uSize * uScale / -mv.z); gl_Position = projectionMatrix * mv; }`,
        fragmentShader: `varying vec4 vC; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.05, d) * vC.a; gl_FragColor = vec4(vC.rgb * a, a); }` });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.visible = false; scene.add(pts);
      function step(dt, n1, vis) {
        pts.visible = vis > .005; if (!pts.visible) return;
        const v0 = (.12 + n1 * 1.0) * 2.6;
        for (let i = 0; i < n; i++) {
          const c = core[i]; let xi = x[i] + v0 * sp[i] * (c ? cv(x[i]) : (x[i] > 2.5 ? 1.25 : 1)) * dt;
          if (xi > X1) { xi = X0; th[i] = Math.random() * TAU; }
          x[i] = xi; th[i] += (xi > -.05 && xi < .5 ? .9 : .12) * n1 * dt;
          const r = c ? lerp(cIn(xi), cOut(xi), f[i]) : lerp(bi(xi), bo(xi), f[i]);
          pos[i * 3] = xi; pos[i * 3 + 1] = r * Math.cos(th[i]); pos[i * 3 + 2] = r * Math.sin(th[i]);
          const a = smooth((xi - X0) / .8) * smooth((X1 - xi) / 1.6) * vis * (.3 + .7 * n1) * (c ? 1 : .8);
          if (c) { col[i * 4] = cr(xi); col[i * 4 + 1] = cg(xi); col[i * 4 + 2] = cb(xi); } else { col[i * 4] = .5; col[i * 4 + 1] = .82; col[i * 4 + 2] = 1; }
          col[i * 4 + 3] = a;
        }
        g.attributes.position.needsUpdate = true; g.attributes.aCol.needsUpdate = true;
      }
      return { step, mat };
    })();

    /* engine model */
    const eng = ctx.reduced ? { n1: 0, n2: 0, egt: 15, a1: 0, a2: 0 } : { n1: .46, n2: .74, egt: 560, a1: 0, a2: 0 };
    const fmt = n => Math.round(n).toLocaleString('en-US');
    const heat = () => clamp((eng.egt - 120) / 800, 0, 1);
    return {
      step(dt, s) {
        const n2T = s.run ? .60 + .40 * s.power : 0;
        eng.n2 += (n2T - eng.n2) * (1 - Math.exp(-dt / (s.run ? 1.5 : 4.5)));
        const lit = s.run ? smooth((eng.n2 - .2) / .35) : 0, n1T = s.run ? (.21 + .79 * Math.pow(s.power, 1.15)) * lit : 0;
        eng.n1 += (n1T - eng.n1) * (1 - Math.exp(-dt / (s.run ? 2.2 : 6.5)));
        const egtT = s.run ? 15 + lit * (440 + 470 * Math.pow(s.power, 1.3)) : 15;
        eng.egt += (egtT - eng.egt) * (1 - Math.exp(-dt / 2.4));
        eng.a1 += eng.n1 * (5175 / 60 / 150) * TAU * dt; eng.a2 += eng.n2 * (14460 / 60 / 150) * TAU * dt;
        for (const pc of spin1) pc.inner.rotation.x = eng.a1; for (const pc of spin2) pc.inner.rotation.x = eng.a2;
        liner.flame.material.opacity = .85 * heat();
        FLOW.mat.uniforms.uScale.value = ctx.view.scale;
        FLOW.step(dt, eng.n1, s.flowVis);
      },
      readouts: () => [
        { v: (eng.n1 * 100).toFixed(1), sub: fmt(eng.n1 * 5175) + ' rpm', f: eng.n1 },
        { v: (eng.n2 * 100).toFixed(1), sub: fmt(eng.n2 * 14460) + ' rpm', f: eng.n2 },
        { v: fmt(eng.egt), sub: 'exhaust gas' }],
      heat,
      active: () => eng.n1 > .003 || eng.n2 > .003 || eng.egt > 17,
    };
  },
};
