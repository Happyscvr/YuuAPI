// =============================================================
//  Yuu Online — MOTION UNIT TEST  v3  (for Laex) 🧪
//  ROOT-CAUSE TEST: is the "Animated" node type's OVER-TIME
//  utility what's breaking same-frame pos+rot AND causing the
//  erratic single-axis motion?
// =============================================================
//  WHAT v2's LOG PROVED (real in-headset numbers):
//    • YELLOW (pos THEN rot): y stuck at 1.30 forever -> position
//      write DROPPED. Only rotation applied.
//    • ORANGE (rot THEN pos): y changed every frame -> position
//      applied, but rotation dropped.
//        => On one frame, the LAST transform write wins; the FIRST
//           is silently clobbered. No ordering gives BOTH.
//    • GREEN (pos only): read-back x hit 1.26 / 1.42 — IMPOSSIBLE
//      from our math (range is only -1.65..0.35), and it stepped /
//      held instead of gliding. => `entity.pos =` is NOT snapping;
//      it is being routed through an over-time interpolator that
//      overshoots and steps.
//
//  HYPOTHESIS:
//    The "Animated" node type sends every `entity.pos`/`entity.rot`
//    assignment through the over-time utility. That utility (a)
//    overshoots/steps a single property, and (b) drops one of two
//    same-frame writes. A node type WITHOUT animation ("Empty")
//    should snap immediately and let pos+rot both apply.
//
//  THE EXPERIMENT (controlled A/B):
//    🔵 BLUE   = "Animated", pos ONLY          (reproduce the step/overshoot)
//    🟢 GREEN  = "Empty",    pos ONLY          (is it smooth now?)
//    🔴 RED    = "Animated", pos + rot same frame (control: should freeze)
//    🟡 YELLOW = "Empty",    pos + rot same frame (does Empty fix the freeze?)
//
//  HOW TO READ THE LOG (printed every second):
//    BLUE.x / GREEN.x  -> horizontal travel; compare smoothness.
//    RED.y  / YELLOW.y -> vertical travel while spinning.
//      • If GREEN.x glides smoothly in range while BLUE.x steps /
//        overshoots  -> node type (over-time utility) is the cause.
//      • If YELLOW.y changes (and yellow visibly moves AND spins)
//        while RED.y stays frozen -> "Empty" is the workaround. ✅
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";
import { Events } from "./Yuu API/Events";
import { inWorldConsole } from "./Yuu API/Console";


// ---- 2. SETTINGS -----------------------------------------------
const LEG_SECONDS = 5;          // seconds per out-and-back leg
const TRAVEL_DISTANCE = 2.0;    // meters travelled
const TEST_ORIGIN = new Vector3(0, 1.3, -3.0);
const CUBE_GAP = 1.1;           // spacing between cubes
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);
const LOG_EVERY = 1.0;          // seconds between diagnostic logs


// ---- 3. PURE MATH HELPERS (build fresh vectors; cannot drift) --
function lerpVec(ax: number, ay: number, az: number,
                 bx: number, by: number, bz: number,
                 t: number): Vector3 {
  return new Vector3(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t);
}
function spinXYZ(t: number): Quaternion {
  const a = t * Math.PI * 2;
  return Quaternion.fromEuler(new Vector3(a, a, a));
}
function pingPong(t: number): number {
  const x = t % 2;             // 0..2
  return x <= 1 ? x : 2 - x;   // 0..1..0
}


// ---- 4. ENTRY POINT --------------------------------------------
registerStart(start);

function start() {
  inWorldConsole.visible(true, new Vector3(0, 2.3, -3), Quaternion.one);

  console.log(">>> MOTION UNIT TEST v3 (node-type A/B) <<<");
  console.log("BLUE=Animated posOnly | GREEN=Empty posOnly");
  console.log("RED=Animated pos+rot  | YELLOW=Empty pos+rot");

  // Column X positions (left -> right).
  const ox = TEST_ORIGIN.x, oy = TEST_ORIGIN.y, oz = TEST_ORIGIN.z;
  const blueX   = ox - CUBE_GAP * 1.5;
  const greenX  = ox - CUBE_GAP * 0.5;
  const redX    = ox + CUBE_GAP * 0.5;
  const yellowX = ox + CUBE_GAP * 1.5;

  // -- spawn four cubes, varying ONLY the node type --------------
  // BLUE: Animated, will move on X only.
  const blueCube = spawnPrimitive.cube(
    new Vector3(blueX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.blue, 1, false, "Animated", undefined
  );
  // GREEN: Empty, will move on X only.
  const greenCube = spawnPrimitive.cube(
    new Vector3(greenX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.green, 1, false, "Empty", undefined
  );
  // RED: Animated, will move on Y AND rotate (control - expect freeze).
  const redCube = spawnPrimitive.cube(
    new Vector3(redX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.red, 1, false, "Animated", undefined
  );
  // YELLOW: Empty, will move on Y AND rotate (does Empty fix it?).
  const yellowCube = spawnPrimitive.cube(
    new Vector3(yellowX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.yellow, 1, false, "Empty", undefined
  );

  console.log("Spawned 4 cubes. Compare BLUE(anim) vs GREEN(empty).");

  // -- per-frame driver -----------------------------------------
  let elapsed = 0;
  let sinceLog = 0;

  Events.onUpdate((deltaTime: number) => {
    elapsed += deltaTime;
    sinceLog += deltaTime;

    const progress = pingPong(elapsed / LEG_SECONDS); // 0..1..0
    const spinT = (elapsed / LEG_SECONDS) % 1;        // 0..1

    // BLUE — Animated, pos only (X).
    blueCube.pos = lerpVec(blueX, oy, oz, blueX + TRAVEL_DISTANCE, oy, oz, progress);

    // GREEN — Empty, pos only (X).
    greenCube.pos = lerpVec(greenX, oy, oz, greenX + TRAVEL_DISTANCE, oy, oz, progress);

    // RED — Animated, pos + rot same frame (Y travel + tumble).
    redCube.pos = lerpVec(redX, oy, oz, redX, oy + TRAVEL_DISTANCE, oz, progress);
    redCube.rot = spinXYZ(spinT);

    // YELLOW — Empty, pos + rot same frame (Y travel + tumble).
    yellowCube.pos = lerpVec(yellowX, oy, oz, yellowX, oy + TRAVEL_DISTANCE, oz, progress);
    yellowCube.rot = spinXYZ(spinT);

    // -- read-back diagnostic -----------------------------------
    if (sinceLog >= LOG_EVERY) {
      sinceLog = 0;
      console.log(
        "t=" + elapsed.toFixed(1) +
        " BLUE.x=" + blueCube.pos.x.toFixed(2) +
        " GREEN.x=" + greenCube.pos.x.toFixed(2) +
        " RED.y=" + redCube.pos.y.toFixed(2) +
        " YEL.y=" + yellowCube.pos.y.toFixed(2)
      );
    }
  });

  console.log(">>> Setup complete. Read the log. <<<");
}
