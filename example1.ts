import { registerStart }  from "./Yuu API/RegisterStart";
import { spawnPrimitive } from "./Yuu API/SpawnPrimitive";
import { Vector3 }        from "./Yuu API/Basic Types/Vector3";
import { Quaternion }     from "./Yuu API/Basic Types/Quaternion";
import { Color }          from "./Yuu API/Basic Types/Color";

registerStart(start);

function start() {
    const cube = spawnPrimitive.cube(
        new Vector3(0, 1.2, -1.5),   // pos (1.5 m in front, chest height)
        new Vector3(0.3, 0.3, 0.3),  // scale (30 cm cube)
        Quaternion.one,               // rot (no rotation)
        Color.red,                    // color
        1,                            // alphaTransparency (fully solid)
        true,                         // hasCollider
        'Static',                     // type (doesn't move)
        undefined                     // parent
    );

    console.log("Cube spawned!");
}
