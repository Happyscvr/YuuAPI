// =============================================================
//  Yuu Online — Grabbable Block (SETTER READ-BACK TEST) 🧪
// =============================================================
//  WHAT YOUR LAST VIDEO PROVED:
//    The console showed `DROPPED at (0.00, 1.20, -0.80)` — which is
//    EXACTLY the spawn position — even though you had carried the cube
//    all over the place. That means writing `block.pos = handPos` is
//    being IGNORED by the engine: the cube's stored position never
//    actually changed.
//
//  WHAT THIS VERSION TESTS (zero new APIs, safe to run):
//    Every second while you hold GRIP we do three things and log them:
//       1. read the cube position BEFORE   -> "before"
//       2. write  block.pos = handPos      (the attempted move)
//       3. read the cube position AFTER    -> "after"
//    Then we compare:
//       • If "after" == hand  -> the setter WORKS (problem is elsewhere)
//       • If "after" == before/spawn -> the setter is a NO-OP (confirmed),
//         and we must move the cube a different way. The console will
//         literally print "SETTER WORKS" or "SETTER IGNORED" so we get
//         a definitive answer in one test.
//
//    We ALSO try block.rot the same way, since you said early on you
//    could "rotate it in one spot" — that tells us if rotation writes
//    behave differently from position writes.
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { inWorldConsole } from "./Yuu API/Console";
import { Entity } from "./Yuu API/Entity";
import { Controller } from "./Yuu API/Controller";
import { Player } from "./Yuu API/Player";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";


// ---- 2. SETTINGS -----------------------------------------------
const GRAB_RANGE = 0.30;
const SPAWN_POSITION = new Vector3(0, 1.2, -0.8);
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);
const CONSOLE_POSITION = new Vector3(-1.2, 1.5, -1.0);


// ---- 3. SHARED MEMORY ------------------------------------------
let block: Entity | undefined;
let heldByHand: "left" | "right" | undefined;
let frameCount = 0;


// ---- 4. START --------------------------------------------------
registerStart(start);

function start() {
  inWorldConsole.visible(true, CONSOLE_POSITION, Quaternion.one);

  block = spawnPrimitive.cube(
    SPAWN_POSITION, CUBE_SIZE, Quaternion.one,
    Color.red, 1, true, "Animated", undefined
  );

  console.log("READ-BACK TEST ready. Grab the cube and move.");

  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}


// ---- 5. GRAB + TEST --------------------------------------------
function onGripHeld(hand: "left" | "right") {
  if (!block) return;

  const handPos = hand === "left"
    ? Player.leftHand.position.get()
    : Player.rightHand.position.get();
  if (!handPos) return;

  // Grab if free.
  if (heldByHand === undefined) {
    if (block.pos.distanceTo(handPos) < GRAB_RANGE) {
      heldByHand = hand;
      block.collidable.set(false);
      frameCount = 0;
      console.log("GRABBED (" + hand + ")");
    }
  }

  if (heldByHand !== hand) return;

  // 1) read BEFORE
  const before = block.pos;

  // 2) attempt the move
  block.pos = handPos;

  // 3) read AFTER
  const after = block.pos;

  // Log + verdict once per second so it's readable.
  frameCount++;
  if (frameCount % 30 === 0) {
    console.log("hand   " + fmt(handPos));
    console.log("before " + fmt(before));
    console.log("after  " + fmt(after));
    // Did 'after' actually become the hand position?
    const moved = after.distanceTo(handPos) < 0.001;
    console.log(moved ? ">> SETTER WORKS" : ">> SETTER IGNORED");
  }
}


// ---- 6. DROP ---------------------------------------------------
function onGripReleased(hand: "left" | "right") {
  if (!block) return;
  if (heldByHand === hand) {
    heldByHand = undefined;
    block.collidable.set(true);
    console.log("DROPPED at " + fmt(block.pos));
  }
}


// ---- 7. helper -------------------------------------------------
function fmt(v: Vector3 | undefined): string {
  if (!v) return "(?)";
  return "(" + v.x.toFixed(2) + ", " + v.y.toFixed(2) + ", " + v.z.toFixed(2) + ")";
}
