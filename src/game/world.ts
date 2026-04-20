import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const RAPIER = require('@dimforge/rapier3d-compat');

await RAPIER.init();

const world = new RAPIER.World({ x: 0.0, y: -9.81, z: 1.5 });

export { world, RAPIER };