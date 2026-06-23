// =============================================================
//  Yuu Online — Grabbable Block (grab • CARRY • drop) 🧊
// =============================================================
//  WHAT THIS DOES:
//    • Spawns a red cube floating in front of you.
//    • GRIP near it to grab with either hand.
//    • While you keep squeezing GRIP, the cube travels WITH you —
//      you can physically move your hand AND glide/teleport around
//      the world, and it stays in your hand the whole time.
//    • Let go of GRIP and the cube stays where you dropped it.
//
//  =====  WHY THE EARLIER VERSIONS DIDN'T CARRY  ==============
//
//  THE REAL BUG #1 (locomotion):
//    `Player.leftHand.position.get()` returns the hand transform in
//    PLAYER-LOCAL space (the API docs literally say "Access local
//    player transform data"). That means the number describes where
//    your hand is *relative to your own body rig*, NOT where it is in
//    the world.
//      → When you stood still and waved your hand, that local number
//        changed, so `block.pos = handPos` looked like it worked.
//      → But when you GLIDED/TELEPORTED across the world, your body
//        rig moved while the hand's LOCAL number barely changed — so
//        the cube was written to (almost) the same world coordinate
//        every frame and got left behind. That's the "I can move away
//        but the cube stays stuck and I manipulate it from a distance"
//        symptom.
//    FIX: convert the local hand transform into WORLD space using the
//         player's own world position + rotation, every frame:
//             worldHand = playerPos + (playerRot ⊗ localHand)
//
//  THE REAL BUG #2 (the previous "offset" attempt):
//    The last version did:
//         grabOffset = block.pos - handPos
//         block.pos  = handPos + grabOffset
//    Those two lines cancel out to `block.pos = block.pos`, which
//    literally re-pins the cube to its ORIGINAL spot forever. That's
//    why it stopped moving entirely while rotation still applied.
//    FIX: removed that self-cancelling math. The cube now snaps to the
//         live WORLD hand position (with a small, tweakable hold
//         offset) so it genuinely rides along with you.
// =============================================================


// ---- 1. IMPORTS -------------------------------------------------
import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
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
//   x = 0    -> centred left/right
//   y = 1.2  -> roughly chest height
//   z = -0.8 -> a comfortable arm's reach in front
const SPAWN_POSITION = new Vector3(0, 1.2, -0.8);

// Cube size (30 cm).
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);

// Where the cube sits relative to the hand WHILE HELD, expressed in
// the hand's own local frame (x=right, y=up, z=-forward).
//   • (0,0,0)        = cube centre sits exactly on the controller.
//   • (0,0,-0.12)    = cube floats ~12 cm out in front of the palm
//                      so the controller doesn't visually swallow it.
const HOLD_OFFSET = new Vector3(0, 0, -0.12);


// ---- 3. SHARED MEMORY ------------------------------------------
let block: Entity | undefined;
let heldByHand: "left" | "right" | undefined;


// ---- 4. MATH HELPERS -------------------------------------------
// Rotate a vector by a quaternion (q ⊗ v ⊗ q⁻¹), using the standard
// fast form:  v' = v + 2w(u×v) + 2u×(u×v),  where u = (q.x,q.y,q.z).
// We need this to turn LOCAL offsets/positions into WORLD space.
function rotateVectorByQuat(q: Quaternion, v: Vector3): Vector3 {
  const u = new Vector3(q.x, q.y, q.z);   // vector part of the quaternion
  const uv = u.cross(v);                   // u × v
  const uuv = u.cross(uv);                 // u × (u × v)
  // v + 2w(u×v) + 2(u×(u×v))
  return v.add(uv.multiply(2 * q.w)).add(uuv.multiply(2));
}


// ---- 5. WORLD-SPACE HAND TRANSFORM -----------------------------
// Combines the player's WORLD transform with the hand's LOCAL
// transform to get the hand's true WORLD position & rotation.
// Returns undefined if any tracking data is missing this frame.
function getWorldHand(
  hand: "left" | "right"
): { pos: Vector3; rot: Quaternion } | undefined {
  const playerPos = Player.position.get();
  const playerRot = Player.rotation.get();
  const localPos =
    hand === "left" ? Player.leftHand.position.get() : Player.rightHand.position.get();
  const localRot =
    hand === "left" ? Player.leftHand.rotation.get() : Player.rightHand.rotation.get();

  if (!playerPos || !playerRot || !localPos || !localRot) return undefined;

  // worldPos = playerPos + (playerRot rotates the local hand offset)
  const worldPos = playerPos.add(rotateVectorByQuat(playerRot, localPos));
  // worldRot = playerRot ⊗ localRot  (combine the two rotations)
  const worldRot = playerRot.multiply(localRot);

  return { pos: worldPos, rot: worldRot };
}


// ---- 6. registerStart: the on-switch ---------------------------
registerStart(start);

function start() {
  block = spawnPrimitive.cube(
    SPAWN_POSITION,   // POSITION
    CUBE_SIZE,        // SIZE
    Quaternion.one,   // ROTATION: none
    Color.red,        // COLOR
    1,                // ALPHA: solid
    true,             // HAS COLLIDER
    // TYPE: trying "Static" (Empty had no collision detection).
    // The motion test proved "Animated" breaks same-frame pos+rot.
    // Static nodes are meant to "never move," but we'll override
    // their position every frame anyway — worst case, the engine
    // might route that through over-time again. If Static also
    // freezes, we'll need dynamic type-switching (spawn Static,
    // changeType("Empty") on grab, back to Static on drop).
    "Static",         // TYPE: was "Animated", tried "Empty" (no collider)
    undefined         // PARENT
  );

  console.log("Block spawned! Reach to it and squeeze GRIP to grab.");

  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}


// ---- 7. GRABBING + CARRYING ------------------------------------
// Runs every frame a GRIP button is held.
function onGripHeld(hand: "left" | "right") {
  if (!block) return;

  // Live WORLD-space hand transform (this is the key fix).
  const worldHand = getWorldHand(hand);
  if (!worldHand) return; // controller / player not tracked this frame

  // STEP A — try to grab if the cube is free.
  if (heldByHand === undefined) {
    const distance = block.pos.distanceTo(worldHand.pos);
    if (distance < GRAB_RANGE) {
      heldByHand = hand;
      block.collidable.set(false); // stop it fighting your body while carried
      console.log("Grabbed with the " + hand + " hand!");
    }
  }

  // STEP B — carry (only the hand that grabbed it).
  if (heldByHand === hand) {
    // Place the cube at the hand, nudged out by HOLD_OFFSET expressed
    // in the hand's own orientation, so it rides naturally in the palm.
    const worldOffset = rotateVectorByQuat(worldHand.rot, HOLD_OFFSET);
    block.pos = worldHand.pos.add(worldOffset);
    block.rot = worldHand.rot; // turn the cube with your wrist
  }
}


// ---- 8. DROPPING -----------------------------------------------
// Runs once, the moment you release a GRIP button.
function onGripReleased(hand: "left" | "right") {
  if (!block) return;

  if (heldByHand === hand) {
    heldByHand = undefined;
    block.collidable.set(true); // solid again where you dropped it
    console.log("Dropped the block.");
  }
}
