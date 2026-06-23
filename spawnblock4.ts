// =============================================================
//  Yuu Online — MOTION UNIT TEST  (for Laex) 🧪
// =============================================================
//  WHY THIS FILE EXISTS:
//    Laex asked:
//      "I just looked over the overTime utility, and everything in
//       there looks correct -- not enough time to test, but if you
//       have time can you build a quick unit test to see if various
//       types of motion work simultaneously...?"
//
//  This is that test. It does NOT touch the grabbable cube. It just
//  spawns a few cubes and drives them with different KINDS of motion
//  so we can SEE, in-headset, whether they all run at the same time
//  without freezing each other.
//
//  THE HISTORICAL BUG WE'RE CHECKING FOR:
//    Earlier, setting BOTH `entity.pos` AND `entity.rot` on the same
//    frame made the object stop moving entirely. Laex believes the
//    overtime utility is now correct. This test proves it one way or
//    the other.
//
//  HOW TO READ THE RESULT (TL;DR):
//    • If EVERY cube both MOVES and SPINS at the same time  -> PASS ✅
//    • If any cube spins but stops moving (or vice-versa)   -> FAIL ❌
//      (note which cube — the label is logged + colour-coded)
//
//  HOW TO RUN:
//    Temporarily point your project's entry at THIS file instead of
//    index.ts (or copy the body of `start()` below into your test
//    project's start()). See MOTION_UNIT_TEST_README.md for details.
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Entity } from "./Yuu API/Entity";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";
import { Async } from "./Yuu API/Async";
import { Events } from "./Yuu API/Events";
import { inWorldConsole } from "./Yuu API/Console";


// ---- 2. TEST SETTINGS YOU CAN TWEAK ----------------------------
// How long (seconds) the "over time" motions take to travel one leg
// of their journey before reversing.
const LEG_SECONDS = 3;

// How far (meters) the moving cubes travel along their axis.
const TRAVEL_DISTANCE = 1.5;

// Where the row of test cubes is centred (world space), roughly at
// chest height and a comfortable viewing distance in front of you.
const TEST_ORIGIN = new Vector3(0, 1.3, -2.5);

// Horizontal gap (meters) between each test cube so they don't overlap.
const CUBE_GAP = 0.9;

// Size of each test cube (25 cm).
const CUBE_SIZE = new Vector3(0.25, 0.25, 0.25);


// ---- 3. SMALL HELPERS ------------------------------------------
// A full spin (2*pi) expressed as a Y-axis quaternion at a given
// fraction `t` (0..1) of one rotation.
function spinY(t: number): Quaternion {
  return Quaternion.fromEuler(new Vector3(0, t * Math.PI * 2, 0));
}

// Spin on all three axes at fraction `t` — used by the "combined"
// stress-test cube to make any freeze obvious.
function spinXYZ(t: number): Quaternion {
  return Quaternion.fromEuler(
    new Vector3(t * Math.PI * 2, t * Math.PI * 2, t * Math.PI * 2)
  );
}

// Ping-pong a 0..1 ramp so motion travels out then back forever,
// giving a smooth triangle wave from a continuously increasing time.
function pingPong(t: number): number {
  const x = t % 2;           // 0..2
  return x <= 1 ? x : 2 - x; // 0..1..0
}


// ---- 4. ENTRY POINT --------------------------------------------
registerStart(start);

function start() {
  // Show the in-world console so the PASS/FAIL log is visible without
  // taking the headset off.
  inWorldConsole.visible(true, new Vector3(0, 2.2, -3), Quaternion.one);

  console.log("=== MOTION UNIT TEST starting ===");
  console.log("Watch each cube. PASS = it MOVES *and* SPINS together.");

  // -----------------------------------------------------------------
  //  TEST 1 — INSTANT pos + rot on the SAME FRAME.
  //  This is the exact pattern from Laex's snippet and the one that
  //  used to freeze. We set both immediately at spawn. If the cube
  //  appears at its raised position AND visibly rotated, instant
  //  combined assignment works.
  // -----------------------------------------------------------------
  const instantCube = spawnPrimitive.cube(
    TEST_ORIGIN.add(new Vector3(-CUBE_GAP * 1.5, 0, 0)),
    CUBE_SIZE,
    Quaternion.one,
    Color.red,
    1,
    false,
    "Animated",
    undefined
  );
  // Laex's Test 1: set pos and rot on the same frame.
  instantCube.pos = TEST_ORIGIN.add(new Vector3(-CUBE_GAP * 1.5, 0.4, 0));
  instantCube.rot = Quaternion.fromEuler(
    new Vector3(0, Math.random() * Math.PI, 0)
  );
  console.log("[Test 1] RED  : instant pos+rot set on same frame.");

  // -----------------------------------------------------------------
  //  Spawn the three OVER-TIME cubes. Each is driven every frame by
  //  Events.onUpdate (see below). We keep references so the update
  //  loop can address them by role.
  // -----------------------------------------------------------------
  // GREEN: MOVE only (no rotation). Baseline for "movement works".
  const moveCube = spawnPrimitive.cube(
    TEST_ORIGIN.add(new Vector3(-CUBE_GAP * 0.5, 0, 0)),
    CUBE_SIZE, Quaternion.one, Color.green, 1, false, "Animated", undefined
  );

  // BLUE: ROTATE only (no movement). Baseline for "rotation works".
  const rotateCube = spawnPrimitive.cube(
    TEST_ORIGIN.add(new Vector3(CUBE_GAP * 0.5, 0, 0)),
    CUBE_SIZE, Quaternion.one, Color.blue, 1, false, "Animated", undefined
  );

  // YELLOW: MOVE *and* ROTATE simultaneously — THE KEY TEST. If this
  // one does both at once, "various types of motion work
  // simultaneously" is confirmed.
  const comboCube = spawnPrimitive.cube(
    TEST_ORIGIN.add(new Vector3(CUBE_GAP * 1.5, 0, 0)),
    CUBE_SIZE, Quaternion.one, Color.yellow, 1, false, "Animated", undefined
  );

  console.log("[Test 2] GREEN : move-only | BLUE: rotate-only | YELLOW: BOTH.");

  // Remember each cube's starting position so we can offset from it.
  const moveBase = moveCube.pos;
  const comboBase = comboCube.pos;

  // -----------------------------------------------------------------
  //  THE OVER-TIME DRIVER.
  //  Runs every frame. `deltaTime` is seconds since the last frame,
  //  so we accumulate elapsed time and derive a smooth 0..1 progress.
  //  This is the documented way to do "over time" motion (frame loop
  //  + lerp/slerp) and lets MOVE and ROTATE happen on the SAME frame
  //  for the combo cube — the precise scenario Laex wants verified.
  // -----------------------------------------------------------------
  let elapsed = 0;
  Events.onUpdate((deltaTime: number) => {
    elapsed += deltaTime;

    // progress goes 0->1->0 forever, taking LEG_SECONDS per leg.
    const progress = pingPong(elapsed / LEG_SECONDS);
    // spinT keeps climbing so rotation is continuous, not ping-ponged.
    const spinT = (elapsed / LEG_SECONDS) % 1;

    // GREEN — move only, along +X using lerp.
    moveCube.pos = moveBase.lerp(
      moveBase.add(new Vector3(TRAVEL_DISTANCE, 0, 0)),
      progress
    );

    // BLUE — rotate only, continuous Y spin via slerp between
    // current spin fraction and a quarter-turn ahead.
    rotateCube.rot = spinY(spinT);

    // YELLOW — BOTH on the same frame. This is the stress test.
    comboCube.pos = comboBase.lerp(
      comboBase.add(new Vector3(0, TRAVEL_DISTANCE, 0)), // travels UP/down
      progress
    );
    comboCube.rot = spinXYZ(spinT); // ...while tumbling on all axes
  });

  // -----------------------------------------------------------------
  //  TEST 2 (delayed) — exactly mirrors Laex's `Async.setTimeout`.
  //  Two seconds in, kick off a one-shot "over time" lerp+slerp on
  //  the RED instant cube to prove a motion can START LATER and still
  //  combine move+rotate. Uses setInterval as the over-time ticker
  //  and clears itself when finished.
  // -----------------------------------------------------------------
  Async.setTimeout(() => {
    console.log("[Test 2] RED  : starting delayed over-time move+rotate.");
    const from = instantCube.pos;
    const to = from.add(new Vector3(0, 0.8, 0));
    const fromRot = instantCube.rot;
    const toRot = Quaternion.fromEuler(new Vector3(0, Math.PI, 0));

    let t = 0;
    const TICK_MS = 16;                       // ~60 fps ticker
    const totalTicks = (LEG_SECONDS * 1000) / TICK_MS;
    const id = Async.setInterval(() => {
      t += 1;
      const p = Math.min(t / totalTicks, 1);  // 0..1 progress
      // move AND rotate on the same tick:
      instantCube.pos = from.lerp(to, p);
      instantCube.rot = Quaternion.slerp(fromRot, toRot, p);
      if (p >= 1) {
        Async.clearTimer(id);
        console.log("[Test 2] RED  : delayed over-time motion COMPLETE ✅");
      }
    }, TICK_MS);
  }, 2_000);

  console.log("=== Setup complete. Observe the cubes. ===");
}
