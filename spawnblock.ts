// =============================================================
//  Yuu Online — Grabbable Block (grab • carry • drop) 🧊
//  + IN-WORLD CONSOLE turned ON so you can see the logs.
// =============================================================
//  IMPORTANT THING WE JUST LEARNED:
//    `console.log(...)` only shows up if the in-world console is
//    VISIBLE. You turn it on once with:
//        inWorldConsole.visible(true, position, rotation);
//    That's why the diagnostic logs never appeared before — the
//    console panel simply wasn't switched on. It's now enabled in
//    start() below, floating to your left, and shows the last ~20
//    messages with timestamps.
//
//  WHAT THIS DOES:
//    • Spawns a red cube in front of you.
//    • GRIP near it to grab with either hand.
//    • While you hold GRIP the cube follows your hand; let go to drop.
//    • Logs hand / player / cube positions ~once per second WHILE you
//      carry, so we can finally SEE whether it keeps up when you
//      glide/teleport around (locomotion) versus just hand movement.
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


// ---- 2. SETTINGS YOU CAN TWEAK ---------------------------------
const GRAB_RANGE = 0.30;                              // how close to grab (m)
const SPAWN_POSITION = new Vector3(0, 1.2, -0.8);    // where the cube appears
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);        // 30 cm cube

// Where the in-world console panel floats (to your left, chest height).
const CONSOLE_POSITION = new Vector3(-1.2, 1.5, -1.0);


// ---- 3. SHARED MEMORY ------------------------------------------
let block: Entity | undefined;
let heldByHand: "left" | "right" | undefined;
let frameCount = 0;


// ---- 4. registerStart: the on-switch ---------------------------
registerStart(start);

function start() {
  // --- Turn the in-world console ON so console.log is visible. ---
  inWorldConsole.visible(true, CONSOLE_POSITION, Quaternion.one);

  // --- Spawn the cube. ---
  block = spawnPrimitive.cube(
    SPAWN_POSITION,
    CUBE_SIZE,
    Quaternion.one,
    Color.red,
    1,
    true,
    "Animated",
    undefined
  );

  console.log("Console is ON. Block spawned.");
  console.log("Squeeze GRIP near the cube to grab it.");

  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}


// ---- 5. GRABBING + CARRYING ------------------------------------
function onGripHeld(hand: "left" | "right") {
  if (!block) return;

  const handPos = hand === "left"
    ? Player.leftHand.position.get()
    : Player.rightHand.position.get();
  const handRot = hand === "left"
    ? Player.leftHand.rotation.get()
    : Player.rightHand.rotation.get();
  if (!handPos || !handRot) return;

  // STEP A — try to grab if the cube is free.
  if (heldByHand === undefined) {
    const distance = block.pos.distanceTo(handPos);
    if (distance < GRAB_RANGE) {
      heldByHand = hand;
      block.collidable.set(false);
      frameCount = 0;
      const p = Player.position.get();
      console.log("GRABBED (" + hand + ")");
      console.log("hand " + fmt(handPos) + " player " + fmt(p) + " cube " + fmt(block.pos));
    }
  }

  // STEP B — carry: cube follows the live hand position.
  if (heldByHand === hand) {
    block.pos = handPos;
    block.rot = handRot;

    // Log ~once per second so we can read it while carrying.
    frameCount++;
    if (frameCount % 30 === 0) {
      const p = Player.position.get();
      console.log("CARRY hand " + fmt(handPos) + " player " + fmt(p));
    }
  }
}


// ---- 6. DROPPING -----------------------------------------------
function onGripReleased(hand: "left" | "right") {
  if (!block) return;
  if (heldByHand === hand) {
    heldByHand = undefined;
    block.collidable.set(true);
    console.log("DROPPED at " + fmt(block.pos));
  }
}


// ---- 7. small helper to print a Vector3 compactly --------------
function fmt(v: Vector3 | undefined): string {
  if (!v) return "(?)";
  return "(" + v.x.toFixed(2) + ", " + v.y.toFixed(2) + ", " + v.z.toFixed(2) + ")";
}
