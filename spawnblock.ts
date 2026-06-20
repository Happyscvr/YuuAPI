// =============================================================
//  Yuu Online — Grabbable Block (DIAGNOSTIC VERSION)
// =============================================================
//  This version tests whether hand positions are already in
//  world-space or local-space by logging the values.
// =============================================================

import { registerStart } from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Entity } from "./Yuu API/Entity";
import { Controller } from "./Yuu API/Controller";
import { Player } from "./Yuu API/Player";
import { Vector3 } from "./Yuu API/Basic Types/Vector3";
import { Quaternion } from "./Yuu API/Basic Types/Quaternion";
import { Color } from "./Yuu API/Basic Types/Color";

const GRAB_RANGE = 0.30;
const SPAWN_POSITION = new Vector3(0, 1.2, -0.8);
const CUBE_SIZE = new Vector3(0.3, 0.3, 0.3);

let block: Entity | undefined;
let heldByHand: "left" | "right" | undefined;
let frameCount = 0;

registerStart(start);

function start() {
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

  console.log("🧊 DIAGNOSTIC MODE: Block spawned at", SPAWN_POSITION);
  console.log("📍 Try grabbing and moving around - watch the console!");

  Controller.subscribe("leftGrip",  "Update",   () => onGripHeld("left"));
  Controller.subscribe("leftGrip",  "Released", () => onGripReleased("left"));
  Controller.subscribe("rightGrip", "Update",   () => onGripHeld("right"));
  Controller.subscribe("rightGrip", "Released", () => onGripReleased("right"));
}

function onGripHeld(hand: "left" | "right") {
  if (!block) return;

  const handPos = hand === "left" 
    ? Player.leftHand.position.get()
    : Player.rightHand.position.get();
  
  const handRot = hand === "left"
    ? Player.leftHand.rotation.get()
    : Player.rightHand.rotation.get();

  if (!handPos || !handRot) return;

  // Try to grab
  if (heldByHand === undefined) {
    const distance = block.pos.distanceTo(handPos);
    if (distance < GRAB_RANGE) {
      heldByHand = hand;
      block.collidable.set(false);
      
      const playerPos = Player.position.get();
      console.log("✅ GRABBED!");
      console.log("  Hand pos:", handPos.x.toFixed(2), handPos.y.toFixed(2), handPos.z.toFixed(2));
      console.log("  Player pos:", playerPos?.x.toFixed(2), playerPos?.y.toFixed(2), playerPos?.z.toFixed(2));
      console.log("  Cube pos:", block.pos.x.toFixed(2), block.pos.y.toFixed(2), block.pos.z.toFixed(2));
    }
  }

  // Carry - SIMPLE version (assume hand positions are already world-space)
  if (heldByHand === hand) {
    // Log every 30 frames (~once per second at 30fps)
    frameCount++;
    if (frameCount % 30 === 0) {
      const playerPos = Player.position.get();
      console.log("📦 CARRYING (frame " + frameCount + "):");
      console.log("  Hand:", handPos.x.toFixed(2), handPos.y.toFixed(2), handPos.z.toFixed(2));
      console.log("  Player:", playerPos?.x.toFixed(2), playerPos?.y.toFixed(2), playerPos?.z.toFixed(2));
      console.log("  Cube:", block.pos.x.toFixed(2), block.pos.y.toFixed(2), block.pos.z.toFixed(2));
    }

    // Simple approach: just set cube to hand position
    block.pos = handPos;
    block.rot = handRot;
  }
}

function onGripReleased(hand: "left" | "right") {
  if (!block) return;

  if (heldByHand === hand) {
    heldByHand = undefined;
    block.collidable.set(true);
    console.log("⬇️ DROPPED at", block.pos.x.toFixed(2), block.pos.y.toFixed(2), block.pos.z.toFixed(2));
  }
}
