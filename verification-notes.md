# Verification Notes — Real GLB Humanoid

The PC `/?demo` capture shows the player as a skinned Soldier GLB, not a plane, sprite, or billboard. The model has a visible head, torso, arms, legs, boots, side profile geometry, and shaded surfaces. The HUD displays `PLAYER RIG // GLB HUMANOID · SKELETON`, while the existing minimap, 3D field, exploration HUD, and camera composition remain present.

The mobile-width `/?demo` capture shows the same 3D world, minimap, touch joystick, right swipe hint, and Jump/Crouch/Run buttons. The player was not visible in that particular frame because the camera was aimed away from the spawn position; this is a camera framing observation, not a failed asset load. TypeScript checks passed, and the browser console showed no GLB or shader error in the latest run.

Asset source used for the model: https://threejs.org/examples/models/gltf/RobotExpressive/RobotExpressive.glb
Uploaded WebDev asset: /manus-storage/stormfall-robot_94040332.glb
GLB metadata: 74 nodes, 2 skins, 14 animation clips including `Idle`, `Jump`, `Running`, `Walking`, `WalkJump`, 14 meshes. The player now uses the real GLB skinned model and its AnimationGroups; no billboard or portrait plane is created in the player path.

## RobotExpressive verification

The current desktop capture shows the player as the actual RobotExpressive skinned GLB from the front after correcting its model-forward axis. It has volume, depth, separate limbs, torso, head, hands, and feet; the player path no longer creates a portrait plane or billboard. The mobile capture shows the same GLB geometry entering from the left edge along with the minimap, right swipe hint, and Jump/Crouch/Run controls. The HUD diagnostic remains `PLAYER RIG // GLB HUMANOID · SKELETON`.
