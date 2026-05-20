# MinaCubo Redux

[![CI](https://github.com/amt911/minacubo-redux/actions/workflows/ci.yml/badge.svg)](https://github.com/amt911/minacubo-redux/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/amt911/minacubo-redux?label=coverage)](https://codecov.io/gh/amt911/minacubo-redux)

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

```bash
npm install            # one-time, populates node_modules/
npm run dev            # local: serve -l 3000 . → http://localhost:3000
# or
make up                # Docker dev → http://localhost:8080
# or
make prod              # Docker prod (nginx multi-stage) → http://localhost:8080
```

No bundler — browser resolves deps via `<script type="importmap">` in `index.html` pointing at `/node_modules/...`.

### Make targets

| `make ...` | Acción |
| --- | --- |
| `up` / `up-d` | dev container (foreground / detached) |
| `down` | parar dev |
| `restart` | down + reset node_modules volume + up (cuando cambien deps) |
| `logs` | tail logs |
| `shell` | shell dentro del container |
| `prod` / `prod-down` | container prod nginx |
| `clean` | down + remove volumes + remove images |

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
index.html              Entry point (importmap + script tags + DOM)
src/                    Application code (+ co-located *.test.js)
  MyScene.js              Main scene, game loop, chunk system
  Cubo.js                 Block type definitions (geometry + textures)
  Esteban.js              Player character
  Zombie.js               Zombie NPC
  Cerdo.js                Pig NPC
  estructuras.js          Composite structures (oak tree)
  colisiones.js           Collision detection (uses aabb.js)
  aabb.js                 Pure AABB intersection
  chunkMath.js            Pure chunk math (identify, shift)
  ParametrosMundo.js      World constants
texturas/               Block and GUI textures
Dockerfile.dev/.prod    Docker images (dev node + prod nginx multi-stage)
docker-compose*.yml     Compose definitions for dev y prod
makefile                Shortcuts (make up / down / prod / clean)
scripts/                Helpers (reset-node-modules.sh)
```

Runtime deps (`three`, `lil-gui`, `@tweenjs/tween.js`, `noisejs`) live in `node_modules/` via npm.

## License

Original academic project. Continued as open learning work.
