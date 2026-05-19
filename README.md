# MinaCubo Redux

A Minecraft-inspired voxel game running in the browser, built with [Three.js](https://threejs.org/).

## Origin

This project started as an assignment for the **Computer Graphics Systems** (*Sistemas Gráficos*) course at the [Universidad de Granada (UGR)](https://www.ugr.es/), within the **Computer Engineering** degree, **Software Engineering** specialization.

It was originally developed by **Andrés Merlo Trujillo** and **Sergio Hervás Cobo**.

This repository is a fork by **Andrés Merlo Trujillo**, continued as a personal learning project to explore Three.js, procedural generation, and real-time 3D in the browser.

## Features

- Procedurally generated terrain using Perlin noise
- Chunk-based world with dynamic loading as the player moves
- Multiple block types: Grass, Dirt, Stone, Rock, Oak Wood, Bedrock, Glass, Glowstone, Oak Leaves
- First-person-style block placement and removal via raycasting
- Animated NPCs: Zombie (follows the player) and Pig (waypoint patrol)
- Day/night cycle with animated fog and lighting
- InstancedMesh rendering for performance

## Running

No build step required. Serve the directory with any static file server:

```bash
npx serve .
# or
python3 -m http.server 8080
# or use Live Server in VS Code
```

Then open `index.html` in the browser.

## Controls

| Input | Action |
| --- | --- |
| W / A / S / D | Move |
| Space | Jump |
| Shift | Sprint / crouch |
| Left click | Remove block |
| Right click | Place block |
| Mouse wheel | Cycle block type |
| Middle mouse | Rotate camera |

## Structure

```
index.html          Entry point
MyScene.js          Main scene, game loop, chunk system
Cubo.js             Block type definitions (geometry + textures)
Esteban.js          Player character
Zombie.js           Zombie NPC
Cerdo.js            Pig NPC
estructuras.js      Composite structures (oak tree)
colisiones.js       Collision detection
ParametrosMundo.js  World constants
libs/               Vendored libraries (Three.js, dat.GUI, Perlin, TWEEN…)
texturas/           Block and GUI textures
```

## License

Original academic project. Continued as open learning work.
