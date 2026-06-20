// =============================================================
//  Yuu Online — First Interactive (Grabbable) Block!
// =============================================================
//  WHAT THIS DOES:
//    • Spawns one colorful cube floating in front of you.
//    • Lets you GRAB it with either hand using the GRIP button.
//    • While you keep squeezing GRIP, the cube follows your hand.
//    • When you let go, the cube stays where you dropped it.
//
//  HOW IT WORKS (the big picture):
//    1. When the world loads, Yuu Online runs our start() function.
//    2. start() spawns the cube and "listens" to the grip buttons.
//    3. Every frame that you hold GRIP, we check: is your hand
//       touching the cube? If yes, the cube sticks to your hand.
//    4. Releasing GRIP simply lets the cube go.
//
//  Read the comments below — each section explains one idea.
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
// Imports pull in ready-made tools from the Yuu API so we don't
// have to write them ourselves. Think of them like getting tools
// out of a toolbox before starting a project.
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Entity } from "./Yuu API/Entity";
import { Controller } from "./Yuu API/Controller";
import { Player } from "./Yuu API/Player";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";


// ---- 2. SETTINGS YOU CAN TWEAK ---------------------------------
// GRAB_RANGE is how close (in meters) your hand must be to the cube
// before you can grab it. 0.25 = 25 centimeters. Try changing it!
const GRAB_RANGE = 0.25;


// ---- 3. MEMORY (variables that the whole file shares) ----------
// We keep a reference to our cube here so every function can use it.
// It starts as "undefined" because the cube doesn't exist until the
// world loads and start() creates it.
let block: Entity | undefined;

// Remembers which hand is currently holding the block.
// It is "left", "right", or undefined (meaning: nobody is holding it).
let heldByHand: "left" | "right" | undefined;


// ---- 4. registerStart: the on-switch for our code --------------
// This line tells Yuu Online: "When the world loads, run start()."
// Without it, none of our code would ever run.
registerStart(start);

function start() {
  // --- Spawn the cube ---
  // spawnPrimitive.cube(...) creates a cube and hands us back an
  // Entity we can move around later. Here is what each value means:
  block = spawnPrimitive.cube(
    new Vector3(0, 1.2, -1.5),    // POSITION: x=0 (centered), y=1.2 (chest height), z=-1.5 (1.5m in front of you)
    new Vector3(0.3, 0.3, 0.3),   // SIZE: a small 30cm cube that is easy to grab
    Quaternion.one,               // ROTATION: Quaternion.one means "no rotation"
    Color.red,                    // COLOR: bright red so it's easy to see
    1,                            // ALPHA: 1 = fully solid (0 would be invisible)
    true,                         // HAS COLLIDER: true makes it a real, solid object
    "Animated",                   // TYPE: "Animated" = an object we move with our own code
    undefined                     // PARENT: undefined = it stands on its own
  );

  // console.log messages show up in the in-world Console panel,
  // exactly like the "Hello World!" you saw in Step 1.
  console.log("Block spawned! Move your hand to it and squeeze GRIP to grab.");

  // --- Listen to the GRIP buttons on BOTH controllers ---
  // Controller.subscribe(button, when, whatToDo)
  //   • "Update"   = runs every frame WHILE the button is held down.
  //   • "Released" = runs once, the moment you let the button go.
  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}


// ---- 5. GRABBING + CARRYING ------------------------------------
// This runs every frame that a GRIP button is held down.
function onGripHeld(hand: "left" | "right") {
  // Safety check: if the cube doesn't exist, do nothing.
  if (!block) return;

  // Find out where the squeezing hand is in the world right now.
  const handPos =
    hand === "left"
      ? Player.leftHand.position.get()
      : Player.rightHand.position.get();

  // The hand position can be undefined if the controller isn't tracked.
  if (!handPos) return;

  // STEP A — Try to grab:
  // If nobody is holding the cube yet, check whether THIS hand is
  // close enough (within GRAB_RANGE) to pick it up.
  if (heldByHand === undefined) {
    const distance = block.pos.distanceTo(handPos);
    if (distance < GRAB_RANGE) {
      heldByHand = hand; // remember who grabbed it
      console.log("Grabbed with the " + hand + " hand!");
    }
  }

  // STEP B — Carry:
  // If THIS hand is the one holding the cube, move the cube to the
  // hand's position so it appears to be held. We also copy the hand's
  // rotation so the cube turns naturally as you twist your wrist.
  if (heldByHand === hand) {
    block.pos = handPos;

    const handRot =
      hand === "left"
        ? Player.leftHand.rotation.get()
        : Player.rightHand.rotation.get();
    if (handRot) {
      block.rot = handRot;
    }
  }
}


// ---- 6. DROPPING -----------------------------------------------
// This runs once, the moment you release a GRIP button.
function onGripReleased(hand: "left" | "right") {
  // Only let go if it was THIS hand that was holding the cube.
  if (heldByHand === hand) {
    heldByHand = undefined; // free the cube — it stays where you left it
    console.log("Dropped the block.");
  }
}
