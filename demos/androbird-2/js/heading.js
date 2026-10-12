// Compass heading from DeviceOrientation events.
//
// Phone flat:    heading of the top edge of the phone (like a hand compass).
// Phone upright: heading of the back camera, i.e. where you are pointing the phone at the bird.
//                The Android app (and a naive web port) used the flat formula in both cases,
//                which becomes unstable or wrong as soon as the phone is raised.
//
// W3C device orientation: earth frame X = east, Y = north, Z = up; R = Rz(alpha)·Rx(beta)·Ry(gamma).

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const norm = (h) => ((h % 360) + 360) % 360;

/** Earth-frame horizontal headings of the device's top edge and back camera. */
export function vectors(alpha, beta, gamma) {
  const ca = Math.cos(rad(alpha)), sa = Math.sin(rad(alpha));
  const cb = Math.cos(rad(beta)), sb = Math.sin(rad(beta));
  const cg = Math.cos(rad(gamma)), sg = Math.sin(rad(gamma));
  // R · (0, 1, 0): top edge
  const top = { x: -sa * cb, y: ca * cb };
  // R · (0, 0, -1): back camera
  const cam = { x: -ca * sg - sa * sb * cg, y: -sa * sg + ca * sb * cg };
  return {
    top: { h: norm(deg(Math.atan2(top.x, top.y))), w: Math.hypot(top.x, top.y) },
    cam: { h: norm(deg(Math.atan2(cam.x, cam.y))), w: Math.hypot(cam.x, cam.y) },
  };
}

/**
 * Heading tracker. feed(event) returns { heading, mode } in magnetic degrees, or null if the event
 * carries no absolute heading (yet).
 */
export function createHeadingTracker({ screenAngle = () => 0 } = {}) {
  let iosOffset = null; // iOS: alpha is relative; webkitCompassHeading gives the absolute reference

  return function feed(e) {
    const { alpha, beta, gamma } = e;
    if (alpha == null || beta == null || gamma == null) {
      if (typeof e.webkitCompassHeading === "number") return { heading: norm(e.webkitCompassHeading + screenAngle()), mode: "flat" };
      return null;
    }
    let absAlpha = null;
    if (typeof e.webkitCompassHeading === "number" && !Number.isNaN(e.webkitCompassHeading)) {
      // Calibrate the relative alpha against Apple's heading while the phone is roughly flat,
      // where webkitCompassHeading is reliable.
      if (Math.abs(beta) < 40 && Math.abs(gamma) < 40) {
        const v = vectors(alpha, beta, gamma);
        iosOffset = norm(e.webkitCompassHeading - v.top.h);
      }
      if (iosOffset == null) return { heading: norm(e.webkitCompassHeading + screenAngle()), mode: "flat" };
      absAlpha = norm(alpha - iosOffset);
    } else if (e.type === "deviceorientationabsolute" || e.absolute) {
      absAlpha = alpha;
    } else {
      return null; // relative orientation only – no compass
    }
    const v = vectors(absAlpha, beta, gamma);
    // Raised more than ~45°: use the camera direction; otherwise the top edge (adjusted for landscape).
    if (v.cam.w > 0.7) return { heading: v.cam.h, mode: "camera" };
    return { heading: norm(v.top.h + screenAngle()), mode: "flat" };
  };
}
