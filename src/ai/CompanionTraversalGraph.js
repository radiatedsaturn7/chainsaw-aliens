const DEFAULT_ACTIONS = [
  { type: 'walk-left', dir: -1, maxTime: 0.9 },
  { type: 'walk-right', dir: 1, maxTime: 0.9 },
  { type: 'jump-up', dir: 0, maxTime: 1.2 },
  { type: 'jump-left', dir: -1, maxTime: 1.2 },
  { type: 'jump-right', dir: 1, maxTime: 1.2 },
  { type: 'double-jump-up', dir: 0, maxTime: 1.35 },
  { type: 'double-jump-left', dir: -1, maxTime: 1.35 },
  { type: 'double-jump-right', dir: 1, maxTime: 1.35 },
  { type: 'drop', dir: 0, maxTime: 0.9 }
];

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export default class CompanionTraversalGraph {
  constructor() {
    this.roomGraphs = new Map();
    this.lastDebug = null;
  }

  getRoomGraph(roomIndex, world) {
    if (roomIndex == null) return null;
    const room = world.getRoomBounds?.(roomIndex);
    if (!room) return null;
    const signature = this.computeRoomSignature(world, room);
    const cached = this.roomGraphs.get(roomIndex);
    if (cached && cached.signature === signature) {
      return cached.graph;
    }
    const graph = this.buildRoomGraph(roomIndex, world, room);
    this.roomGraphs.set(roomIndex, { signature, graph });
    return graph;
  }

  invalidateRoom(roomIndex = null) {
    if (roomIndex == null) {
      this.roomGraphs.clear();
      return;
    }
    this.roomGraphs.delete(roomIndex);
  }

  computeRoomSignature(world, room) {
    let sig = `${room.x},${room.y},${room.w},${room.h}|`;
    for (let ty = room.y; ty < room.y + room.h; ty += 1) {
      for (let tx = room.x; tx < room.x + room.w; tx += 1) {
        sig += world.getTile(tx, ty);
      }
      sig += '|';
    }
    return sig;
  }

  buildRoomGraph(roomIndex, world, roomBounds) {
    const tileSize = world.tileSize;
    const nodes = new Map();
    const edges = new Map();

    for (let ty = roomBounds.y; ty < roomBounds.y + roomBounds.h; ty += 1) {
      for (let tx = roomBounds.x; tx < roomBounds.x + roomBounds.w; tx += 1) {
        if (!this.isStandable(tx, ty, world)) continue;
        const node = this.makeNode(tx, ty, tileSize);
        nodes.set(node.id, node);
      }
    }

    const nodeList = [...nodes.values()];
    nodeList.forEach((node) => {
      const nodeEdges = [];
      DEFAULT_ACTIONS.forEach((action) => {
        const result = this.simulateAction(node, action, world, roomBounds);
        if (!result) return;
        const toId = this.nodeId(result.tx, result.ty);
        if (!nodes.has(toId)) return;
        nodeEdges.push({
          from: node.id,
          to: toId,
          action: action.type,
          cost: result.cost,
          maxTime: action.maxTime,
          metadata: {
            dir: action.dir,
            jump: action.type.includes('jump'),
            doubleJump: action.type.startsWith('double-jump')
          }
        });
      });
      edges.set(node.id, nodeEdges);
    });

    this.lastDebug = { roomIndex, nodes, edges, roomBounds };
    return { roomIndex, roomBounds, nodes, edges };
  }

  makeNode(tx, ty, tileSize) {
    return {
      id: this.nodeId(tx, ty),
      tx,
      ty,
      x: (tx + 0.5) * tileSize,
      y: (ty + 0.5) * tileSize,
      grounded: true,
      airJumps: 1
    };
  }

  nodeId(tx, ty) {
    return `${tx},${ty},g`;
  }

  isStandable(tx, ty, world) {
    if (world.isSolid(tx, ty, {}, { ignoreOneWay: true })) return false;
    const belowY = ty + 1;
    const belowSolid = world.isSolid(tx, belowY, {}, { ignoreOneWay: true });
    const belowOneWay = world.isOneWay?.(tx, belowY);
    return belowSolid || belowOneWay;
  }

  simulateAction(node, action, world, roomBounds) {
    const tileSize = world.tileSize;
    const width = 22;
    const height = 34;
    const speed = 140;
    const gravity = 940;
    const jumpPower = 430;
    const dt = 1 / 60;
    const timeout = action.maxTime;

    let x = node.x;
    let y = node.y;
    let vx = 0;
    let vy = 0;
    let onGround = true;
    let airJumps = 1;
    let dropTimer = action.type === 'drop' ? 0.22 : 0;
    let elapsed = 0;
    let jumped = false;
    let doubleJumped = false;

    const isSolid = (worldX, worldY, ignoreOneWay = false) => {
      const tx = Math.floor(worldX / tileSize);
      const ty = Math.floor(worldY / tileSize);
      if (dropTimer > 0) {
        return world.isSolid(tx, ty, {}, { ignoreOneWay: true });
      }
      return world.isSolid(tx, ty, {}, { ignoreOneWay });
    };

    while (elapsed < timeout) {
      elapsed += dt;
      dropTimer = Math.max(0, dropTimer - dt);

      const desiredVx = action.dir * speed;
      vx += (desiredVx - vx) * clamp(dt * 10, 0, 1);

      if (action.type.includes('jump') && !jumped) {
        vy = -jumpPower;
        onGround = false;
        jumped = true;
      }
      if (action.type.startsWith('double-jump') && jumped && !doubleJumped && elapsed >= 0.2 && airJumps > 0) {
        vy = -jumpPower;
        airJumps -= 1;
        doubleJumped = true;
      }

      vy += gravity * dt;

      // Horizontal
      const nextX = x + vx * dt;
      const halfW = width * 0.5;
      const halfH = height * 0.5;
      const signX = Math.sign(vx);
      if (signX !== 0) {
        const testX = nextX + signX * halfW;
        const topY = y - halfH + 3;
        const bottomY = y + halfH - 3;
        if (!isSolid(testX, topY, true) && !isSolid(testX, bottomY, true)) {
          x = nextX;
        } else {
          vx = 0;
        }
      }

      // Vertical
      const nextY = y + vy * dt;
      const signY = Math.sign(vy);
      onGround = false;
      if (signY !== 0) {
        const testY = nextY + signY * halfH;
        const leftX = x - halfW + 3;
        const rightX = x + halfW - 3;
        const hit = isSolid(leftX, testY, signY < 0) || isSolid(rightX, testY, signY < 0);
        if (!hit) {
          y = nextY;
        } else {
          if (signY > 0) {
            onGround = true;
            airJumps = 1;
          }
          vy = 0;
        }
      }

      const tx = Math.floor(x / tileSize);
      const ty = Math.floor(y / tileSize);
      const inRoom = tx >= roomBounds.x && tx < roomBounds.x + roomBounds.w && ty >= roomBounds.y && ty < roomBounds.y + roomBounds.h;
      if (!inRoom) {
        return null;
      }

      if (onGround && elapsed > 0.08) {
        if (tx === node.tx && ty === node.ty) continue;
        const dist = Math.hypot(tx - node.tx, ty - node.ty);
        return { tx, ty, cost: Math.max(1, dist) + elapsed * 0.6 };
      }
    }
    return null;
  }

  getClosestNode(graph, x, y) {
    if (!graph || !graph.nodes?.size) return null;
    let best = null;
    graph.nodes.forEach((node) => {
      const dist = Math.hypot(node.x - x, node.y - y);
      if (!best || dist < best.dist) {
        best = { node, dist };
      }
    });
    return best?.node || null;
  }

  getDebugData() {
    return this.lastDebug;
  }
}
