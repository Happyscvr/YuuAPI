// =============================================================
//  Yuu Online — Grabbable Block (grab • carry • rotate • drop) 🧊
//  FINAL WORKING VERSION
// =============================================================
//  WHAT THIS DOES:
//    • Spawns a red cube in front of you.
//    • Squeeze GRIP near it (either hand) to grab.
//    • While you hold GRIP the cube travels WITH your hand AND turns
//      with your wrist. Move around the world and it comes along.
//    • Release GRIP to drop it where it is.
//
//  =====  THE JOURNEY (what was actually wrong, in order)  =====
//    1. A self-cancelling "offset" calc (cube = hand + (cube-hand) =
//       cube) re-pinned the cube to its spawn point. -> removed.
//    2. We couldn't SEE any console.log output because the in-world
//       console must be switched ON first with inWorldConsole.visible().
//       -> now enabled in start().
//    3. The read-back test proved `block.pos = handPos` DOES move the
//       cube (the earlier "stuck" feeling came from bug #1, not the
//       setter). So position assignment is the correct approach.
//
//  This file keeps the in-world console ON (handy while learning) and
//  applies BOTH position and rotation each frame so the cube is fully
//  held in your hand. To remove the console later, delete the marked
//  line in start().
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
// How close (meters) your hand must be to the cube to grab it.
const GRAB_RANGE = 0.30;

// Where the cube first appears (world space) when the world loads.
const SPAWN_POSITION = new Vector3(0, 1.2, -0.8);

// Cube size (30 cm).
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);

// Where the in-world console panel floats. Delete the line that uses
// this in start() if you don't want the console showing.
const CONSOLE_POSITION = new Vector3(-1.2, 1.5, -1.0);


// ---- 3. SHARED MEMORY ------------------------------------------
let block: Entity | undefined;
let heldByHand: "left" | "right" | undefined;


// ---- 4. START --------------------------------------------------
registerStart(start);

function start() {
  // Turn the in-world console ON so console.log is visible.
  // (Remove this one line to hide the console.)
  inWorldConsole.visible(true, CONSOLE_POSITION, Quaternion.one);

  // Spawn the cube. "Animated" = an object we move from code.
  block = spawnPrimitive.cube(
    SPAWN_POSITION,   // POSITION
    CUBE_SIZE,        // SIZE
    Quaternion.one,   // ROTATION: none to start
    Color.red,        // COLOR
    1,                // ALPHA: solid
    true,             // HAS COLLIDER
    "Animated",       // TYPE
    undefined         // PARENT
  );

  console.log("Block spawned. Squeeze GRIP near it to grab.");

  // "Update"   = runs every frame WHILE the button is held.
  // "Released" = runs once, the moment you let go.
  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}


// ---- 5. GRABBING + CARRYING + ROTATING -------------------------
function onGripHeld(hand: "left" | "right") {
  if (!block) return;

  // Live hand transform (already world-space on this build).
  const handPos = hand === "left"
    ? Player.leftHand.position.get()
    : Player.rightHand.position.get();
  const handRot = hand === "left"
    ? Player.leftHand.rotation.get()
    : Player.rightHand.rotation.get();
  if (!handPos) return; // controller not tracked this frame

  // STEP A — grab if the cube is free and your hand is close enough.
  if (heldByHand === undefined) {
    if (block.pos.distanceTo(handPos) < GRAB_RANGE) {
      heldByHand = hand;
      block.collidable.set(false); // don't fight your body while carried
      console.log("Grabbed with the " + hand + " hand!");
    }
  }

  // STEP B — carry: move AND rotate the cube to match the hand.
  if (heldByHand === hand) {
    block.pos = handPos;            // follow the hand position
    if (handRot) {
      block.rot = handRot;          // turn with your wrist
    }
  }
}


// ---- 6. DROPPING -----------------------------------------------
function onGripReleased(hand: "left" | "right") {
  if (!block) return;
  if (heldByHand === hand) {
    heldByHand = undefined;
    block.collidable.set(true);    // solid again where you dropped it
    console.log("Dropped the block.");
  }
}
