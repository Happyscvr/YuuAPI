// =============================================================
//  Yuu Online — MOTION UNIT TEST  v2  (for Laex) 🧪
// =============================================================
//  WHY THIS FILE EXISTS:
//    Laex asked:
//      "I just looked over the overTime utility, and everything in
//       there looks correct -- not enough time to test, but if you
//       have time can you build a quick unit test to see if various
//       types of motion work simultaneously...?"
//
//  WHAT v1 REVEALED (in-headset, real result):
//    • GREEN (move-only) looked sporadic and got WORSE over time.
//        -> That was a TEST bug: recomputing a target with `base.add()`
//           every frame appears to MUTATE the base in the Yuu engine,
//           so the cube drifted further each frame. v2 fixes this by
//           computing every position with plain number math that
//           CANNOT drift (no reuse of shared vectors).
//    • YELLOW (move AND rotate on the same frame) only ROTATED — it
//        never moved. That is the real headline: setting `pos` and
//        `rot` on the SAME FRAME still drops the position update.
//        The overtime fix did NOT resolve the freeze.  v2 makes this
//        undeniable by READING BACK the cube's position each second
//        and logging it, and by adding an ORDER test (rot-then-pos).
//
//  =====  WHAT EACH CUBE TESTS (v2)  =========================
//    🟢 GREEN  : move only            (baseline: movement works)
//    🔵 BLUE   : rotate only          (baseline: rotation works)
//    🟡 YELLOW : pos THEN rot same frame   (the freeze test)
//    🟠 ORANGE : rot THEN pos same frame   (does ORDER change it?)
//
//  HOW TO READ THE RESULT:
//    • GREEN should glide smoothly left<->right forever (no drift).
//    • BLUE should spin in place.
//    • If YELLOW and ORANGE both only spin and never travel  -> the
//      freeze bug is confirmed, regardless of assignment order. The
//      logged "yPos" for them will stay essentially constant.
//    • If either YELLOW or ORANGE travels up/down while spinning ->
//      that ordering is a viable workaround.  The log will show its
//      yPos changing.
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Entity } from "./Yuu API/Entity";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";
import { Events } from "./Yuu API/Events";
import { inWorldConsole } from "./Yuu API/Console";


// ---- 2. TEST SETTINGS YOU CAN TWEAK ----------------------------
// Seconds for one full out-and-back leg of the over-time motion.
// Bigger = slower & easier to watch.
const LEG_SECONDS = 5;

// How far (meters) the moving cubes travel. Made large so motion is
// impossible to miss.
const TRAVEL_DISTANCE = 2.0;

// Where the row of test cubes is centred (world space): chest height,
// a comfortable viewing distance in front.
const TEST_ORIGIN = new Vector3(0, 1.3, -3.0);

// Horizontal gap (meters) between each cube so they never overlap.
const CUBE_GAP = 1.1;

// Cube edge length (30 cm).
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);

// How often (seconds) to print the read-back diagnostic log.
const LOG_EVERY = 1.0;


// ---- 3. PURE MATH HELPERS (no mutation, cannot drift) ----------
// Manual lerp that BUILDS A BRAND-NEW Vector3 from plain numbers, so
// it can never accidentally mutate a stored vector (the v1 bug).
function lerpVec(ax: number, ay: number, az: number,
                 bx: number, by: number, bz: number,
                 t: number): Vector3 {
  return new Vector3(
    ax + (bx - ax) * t,
    ay + (by - ay) * t,
    az + (bz - az) * t
  );
}

// Continuous Y-axis spin at fraction `t` (0..1) of a full turn.
function spinY(t: number): Quaternion {
  return Quaternion.fromEuler(new Vector3(0, t * Math.PI * 2, 0));
}

// Tumble on all three axes — makes any freeze obvious.
function spinXYZ(t: number): Quaternion {
  const a = t * Math.PI * 2;
  return Quaternion.fromEuler(new Vector3(a, a, a));
}

// Triangle wave 0->1->0 forever, from a continuously rising input.
function pingPong(t: number): number {
  const x = t % 2;           // 0..2
  return x <= 1 ? x : 2 - x; // 0..1..0
}


// ---- 4. ENTRY POINT --------------------------------------------
registerStart(start);

function start() {
  // Floating console so logs are visible without removing the headset.
  inWorldConsole.visible(true, new Vector3(0, 2.3, -3), Quaternion.one);

  console.log("=== MOTION UNIT TEST v2 starting ===");
  console.log("GREEN move | BLUE rotate | YELLOW pos>rot | ORANGE rot>pos");

  // Fixed anchor numbers for each cube. We store ONLY plain numbers so
  // nothing can be mutated by engine math.
  const ox = TEST_ORIGIN.x, oy = TEST_ORIGIN.y, oz = TEST_ORIGIN.z;

  // Column X positions for the four cubes (left -> right).
  const greenX  = ox - CUBE_GAP * 1.5;
  const blueX   = ox - CUBE_GAP * 0.5;
  const yellowX = ox + CUBE_GAP * 0.5;
  const orangeX = ox + CUBE_GAP * 1.5;

  // -- spawn the four cubes -----------------------------------------
  const greenCube = spawnPrimitive.cube(
    new Vector3(greenX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.green, 1, false, "Animated", undefined
  );
  const blueCube = spawnPrimitive.cube(
    new Vector3(blueX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.blue, 1, false, "Animated", undefined
  );
  const yellowCube = spawnPrimitive.cube(
    new Vector3(yellowX, oy, oz),
    CUBE_SIZE, Quaternion.one, Color.yellow, 1, false, "Animated", undefined
  );
  // Orange isn't a Color constant; build it from RGB (1, 0.5, 0).
  const orangeCube = spawnPrimitive.cube(
    new Vector3(orangeX, oy, oz),
    CUBE_SIZE, Quaternion.one, new Color(1, 0.5, 0), 1, false, "Animated", undefined
  );

  console.log("Spawned 4 cubes. Watch GREEN glide, BLUE spin.");
  console.log("KEY: do YELLOW / ORANGE TRAVEL while spinning, or just spin?");

  // -- per-frame driver ---------------------------------------------
  let elapsed = 0;
  let sinceLog = 0;

  Events.onUpdate((deltaTime: number) => {
    elapsed += deltaTime;
    sinceLog += deltaTime;

    const progress = pingPong(elapsed / LEG_SECONDS); // 0..1..0 travel
    const spinT = (elapsed / LEG_SECONDS) % 1;        // 0..1 continuous

    // GREEN — move only, side to side. Endpoints are fresh numbers
    // every frame, so NO drift is possible.
    greenCube.pos = lerpVec(
      greenX, oy, oz,
      greenX + TRAVEL_DISTANCE, oy, oz,
      progress
    );

    // BLUE — rotate only, in place.
    blueCube.rot = spinY(spinT);

    // YELLOW — set POSITION first, then ROTATION, same frame.
    yellowCube.pos = lerpVec(
      yellowX, oy, oz,
      yellowX, oy + TRAVEL_DISTANCE, oz, // travels UP/down
      progress
    );
    yellowCube.rot = spinXYZ(spinT);

    // ORANGE — set ROTATION first, then POSITION, same frame.
    // (Tests whether assignment ORDER dodges the freeze.)
    orangeCube.rot = spinXYZ(spinT);
    orangeCube.pos = lerpVec(
      orangeX, oy, oz,
      orangeX, oy + TRAVEL_DISTANCE, oz, // travels UP/down
      progress
    );

    // -- READ-BACK diagnostic: prove whether pos actually applied ----
    if (sinceLog >= LOG_EVERY) {
      sinceLog = 0;
      // We read the cube's ACTUAL pos back from the engine. If YELLOW /
      // ORANGE y-values stay ~constant while GREEN's x changes, the
      // freeze is confirmed.
      const gy = greenCube.pos.x.toFixed(2);
      const yy = yellowCube.pos.y.toFixed(2);
      const oy2 = orangeCube.pos.y.toFixed(2);
      console.log(
        "t=" + elapsed.toFixed(1) +
        "  GREEN.x=" + gy +
        "  YELLOW.y=" + yy +
        "  ORANGE.y=" + oy2
      );
    }
  });

  console.log("=== Setup complete. Observe + read the log. ===");
}
