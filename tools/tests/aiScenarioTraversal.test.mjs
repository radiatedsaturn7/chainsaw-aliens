import test from 'node:test';
import assert from 'node:assert/strict';
import AITestHarness from '../../src/debug/AITestHarness.js';
import World from '../../src/world/World.js';
import FriendlyCompanion from '../../src/entities/FriendlyCompanion.js';
import Player from '../../src/entities/Player.js';

const FPS = 60;
const MAX_SECONDS = 30;

function makeIdleInput() {
  return { isDown: () => false };
}

function updateElevatorTile(world, state, dt) {
  if (!state.path.length) return;
  state.elapsed += dt * 2;
  const index = Math.floor(state.elapsed) % state.path.length;
  const tile = state.path[index];
  world.elevators = [{ x: tile.x, y: tile.y }];
  world.elevatorSet = new Set([`${tile.x},${tile.y}`]);
}

function runScenarioTraversal(scenario) {
  const world = new World();
  world.applyData(scenario.data);

  const player = new Player(
    (scenario.playerTile.x + 0.5) * world.tileSize,
    (scenario.playerTile.y + 0.5) * world.tileSize
  );
  player.onGround = true;
  player.facing = 1;

  const companion = new FriendlyCompanion(
    (scenario.companionTile.x + 0.5) * world.tileSize,
    (scenario.companionTile.y + 0.5) * world.tileSize
  );
  companion.assistEnabled = false;
  companion.onGround = true;

  const elevatorState = {
    path: [...(scenario.data.elevatorPaths || [])],
    elapsed: 0
  };

  const maxFrames = FPS * MAX_SECONDS;
  for (let i = 0; i < maxFrames; i += 1) {
    const dt = 1 / FPS;
    updateElevatorTile(world, elevatorState, dt);
    companion.update(dt, world, {}, {
      player,
      enemies: [],
      boss: null,
      playerInput: makeIdleInput()
    });
    const distance = Math.hypot(companion.x - player.x, companion.y - player.y);
    if (distance < world.tileSize * 1.5) {
      return { reachedGoal: true, seconds: i * dt };
    }
  }

  return { reachedGoal: false, seconds: MAX_SECONDS };
}

test('companion traverses each AI harness scenario from left to right', async (t) => {
  const harness = new AITestHarness();
  for (const scenario of harness.scenarios) {
    await t.test(scenario.name, () => {
      const result = runScenarioTraversal(scenario);
      assert.equal(
        result.reachedGoal,
        true,
        `Companion failed to reach goal in ${scenario.name} within ${MAX_SECONDS}s`
      );
    });
  }
});
