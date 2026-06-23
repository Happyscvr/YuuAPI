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
// *** SAFETY SWITCH ***
//   true  = switch the cube to "Empty" while carried so it can MOVE
//           and ROTATE together (the rotation fix we're testing).
//   false = never change type. The cube stays "Animated" the whole
//           time. This is the GUARANTEED-GRABBABLE behaviour we know
//           works — you can carry it, but rotating it may freeze
//           movement (the old known issue).
//   If grabbing ever breaks again, set this to false and reload to
//   get a working cube back instantly.
const SWITCH_TYPE_ON_GRAB = true;

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
    // TYPE: spawn as "Animated" — this is the type that is grabbable
    // and solid (it has a working collider). We DON'T leave it as
    // Animated while carrying though: the motion test proved Animated
    // drops one of two same-frame writes, freezing movement when we
    // set pos+rot together. So we switch to "Empty" on grab (where the
    // test proved pos+rot BOTH apply smoothly) and switch back to
    // "Animated" on drop so it's solid & grabbable again.
    "Animated",       // TYPE: grabbable at rest; we changeType on grab
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
      // Turn off collision first so it doesn't fight your body while
      // carried. Guarded: if the type has no collider this won't crash
      // the whole grip handler.
      try { block.collidable.set(false); } catch (e) { /* ignore */ }
      // Switch to "Empty" for the carry. The motion test proved Empty
      // applies pos AND rot on the same frame with no freeze, while
      // Animated drops one of them. This is what makes carry+rotate work.
      // Gated behind the safety switch so it's easy to turn off.
      if (SWITCH_TYPE_ON_GRAB) {
        try { block.changeType("Empty"); } catch (e) { /* ignore */ }
      }
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
    // Switch back to "Animated" so the cube is solid & grabbable again
    // where you dropped it. (Empty has no collider, so we must restore
    // a collidable type before turning collision back on.) Only needed
    // if we switched on grab.
    if (SWITCH_TYPE_ON_GRAB) {
      try { block.changeType("Animated"); } catch (e) { /* ignore */ }
    }
    try { block.collidable.set(true); } catch (e) { /* ignore */ }
    console.log("Dropped the block.");
  }
}
