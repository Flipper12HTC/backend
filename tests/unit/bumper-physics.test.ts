import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { RapierPhysicsWorld } from '../../src/infrastructure/physics/rapier-world.js';
import { PLAYFIELD } from '../../src/domain/playfield.js';

const DT = 1 / 60;
const physics = new RapierPhysicsWorld();

// The two jellyfish bumpers activated in rapier-world init() (BUMPER_IDS).
// Both must behave identically: register a hit AND bounce the ball back up-field.
const ACTIVE_BUMPERS = ['b2', 'b3'] as const;

describe('bumper physics', () => {
  before(async () => {
    await physics.init({ wallHeight: 10 });
  });

  beforeEach(() => {
    // Park the ball at the drain end, away from the bumpers, and clear stray hits.
    physics.setBallPosition({ x: 0, y: 8, z: 6 });
    for (let i = 0; i < 20; i++) physics.step(DT);
    physics.consumeBumperHits();
  });

  function bumperById(id: string) {
    const b = PLAYFIELD.bumpers.find((x) => x.id === id);
    assert.ok(b, `bumper ${id} must exist in PLAYFIELD.bumpers`);
    return b!;
  }

  // Drop the ball just up-field of the bumper and let the inclined floor (+ a nudge)
  // roll it down into the bumper — the same path a real ball takes.
  function rollIntoBumper(id: string): { hitIds: string[]; endZ: number; centreZ: number } {
    const b = bumperById(id);
    physics.setBallPosition({ x: b.x, y: 8, z: b.z - 2.0 });
    for (let i = 0; i < 8; i++) physics.step(DT); // settle onto the floor
    physics.consumeBumperHits(); // ignore any settling contacts
    physics.applyBallImpulse({ x: 0, y: 0, z: 3 }); // send it down-field into the bumper

    const hitIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      physics.step(DT);
      for (const h of physics.consumeBumperHits()) hitIds.push(h.id);
    }
    return { hitIds, endZ: physics.getBallPosition().z, centreZ: b.z };
  }

  for (const id of ACTIVE_BUMPERS) {
    it(`bumper ${id} registers a hit and bounces the ball back (acts as a bumper)`, () => {
      const { hitIds, endZ, centreZ } = rollIntoBumper(id);
      assert.ok(hitIds.includes(id), `contact with ${id} should register a bumper hit`);
      // The ball rolled down-field (+Z) into the bumper; a restitution>1 bumper repels it
      // back up-field, so it ends up on the -Z side of the centre instead of passing through.
      assert.ok(endZ < centreZ, `${id} should bounce the ball back up-field (repel)`);
    });
  }
});
