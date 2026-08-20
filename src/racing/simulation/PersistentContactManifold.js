const EPSILON = 1e-9;
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const dot = (a = {}, b = {}) => finite(a.x) * finite(b.x)
  + finite(a.y) * finite(b.y) + finite(a.z) * finite(b.z);

function normalClusterKey(normal = {}) {
  // Roughly ten-degree directional buckets retain materially different wall,
  // floor, curb and corner constraints without promoting probe density.
  return `${Math.round(finite(normal.x) * 6)}:${Math.round(finite(normal.y) * 6)}:${Math.round(finite(normal.z) * 6)}`;
}

export function contactManifoldClusterKey(contact = {}) {
  const connectedTerrainFamily = contact.colliderId == null
    && contact.supportFamilyId !== null
    && contact.supportFamilyId !== undefined
    && contact.supportEdgeClassification === 'smooth-connected-surface'
      ? `terrain-support:${contact.supportFamilyId}` : null;
  return [
    contact.colliderId ?? connectedTerrainFamily ?? contact.terrainSource ?? 'terrain',
    connectedTerrainFamily
      ? (contact.contactType ?? 'connected-surface')
      : (contact.featureId ?? contact.contactType ?? contact.triangleId ?? 'feature'),
    contact.pieceId ?? contact.wheelId ?? 'body',
    normalClusterKey(contact.normal)
  ].join('|');
}

function buildTangents(normal = {}) {
  const reference = Math.abs(finite(normal.y)) < 0.85
    ? { x: 0, y: 1, z: 0 } : { x: 1, y: 0, z: 0 };
  let tx = finite(normal.y) * reference.z - finite(normal.z) * reference.y;
  let ty = finite(normal.z) * reference.x - finite(normal.x) * reference.z;
  let tz = finite(normal.x) * reference.y - finite(normal.y) * reference.x;
  const length = Math.hypot(tx, ty, tz) || 1;
  tx /= length; ty /= length; tz /= length;
  return {
    first: { x: tx, y: ty, z: tz },
    second: {
      x: finite(normal.y) * tz - finite(normal.z) * ty,
      y: finite(normal.z) * tx - finite(normal.x) * tz,
      z: finite(normal.x) * ty - finite(normal.y) * tx
    }
  };
}

function appendUnique(output, contact) {
  if (contact && !output.includes(contact)) output.push(contact);
}

export function reducePersistentContactManifold(rawContacts = [], {
  maximumContactsPerCluster = 4
} = {}) {
  const clusters = new Map();
  for (let index = 0; index < rawContacts.length; index += 1) {
    const contact = rawContacts[index];
    const key = contactManifoldClusterKey(contact);
    let cluster = clusters.get(key);
    if (!cluster) {
      cluster = { key, contacts: [] };
      clusters.set(key, cluster);
    }
    cluster.contacts.push(contact);
  }
  const reduced = [];
  for (const cluster of clusters.values()) {
    const source = cluster.contacts;
    let deepest = source[0];
    for (let index = 1; index < source.length; index += 1) {
      if (finite(source[index].penetrationM) > finite(deepest.penetrationM)) {
        deepest = source[index];
      }
    }
    const selected = [];
    appendUnique(selected, deepest);
    if (source.length > 1 && selected.length < maximumContactsPerCluster) {
      const tangents = buildTangents(deepest.normal);
      let firstMin = null;
      let firstMax = null;
      let secondExtreme = null;
      let firstMinValue = Infinity;
      let firstMaxValue = -Infinity;
      let secondMagnitude = -Infinity;
      for (let index = 0; index < source.length; index += 1) {
        const contact = source[index];
        const point = contact.pointWorld || contact.arm || {};
        const firstValue = dot(point, tangents.first);
        const secondValue = Math.abs(dot(point, tangents.second));
        if (firstValue < firstMinValue) {
          firstMinValue = firstValue;
          firstMin = contact;
        }
        if (firstValue > firstMaxValue) {
          firstMaxValue = firstValue;
          firstMax = contact;
        }
        if (secondValue > secondMagnitude) {
          secondMagnitude = secondValue;
          secondExtreme = contact;
        }
      }
      appendUnique(selected, firstMin);
      if (selected.length < maximumContactsPerCluster) appendUnique(selected, firstMax);
      if (selected.length < maximumContactsPerCluster) appendUnique(selected, secondExtreme);
    }
    for (let index = 0; index < selected.length; index += 1) {
      selected[index].manifoldClusterKey = cluster.key;
      selected[index].manifoldRepresentativeIndex = index;
      selected[index].manifoldRawContactCount = source.length;
      reduced.push(selected[index]);
    }
  }
  return { contacts: reduced, clusters };
}

export class PersistentManifoldHistory {
  constructor() {
    this.previousStep = -1;
    this.previousKeys = new Set();
    this.currentStep = -1;
    this.currentKeys = new Set();
    this.previousAges = new Map();
    this.currentAges = new Map();
  }

  begin(stepIndex) {
    const step = Math.trunc(Number(stepIndex));
    if (step === this.currentStep) return;
    this.previousStep = this.currentStep;
    this.previousKeys = this.currentKeys;
    this.previousAges = this.currentAges;
    this.currentStep = step;
    this.currentKeys = new Set();
    this.currentAges = new Map();
  }

  classifyAndRemember(clusterKey) {
    const persistent = this.previousStep === this.currentStep - 1
      && this.previousKeys.has(clusterKey);
    this.currentKeys.add(clusterKey);
    this.currentAges.set(clusterKey, persistent
      ? (this.previousAges.get(clusterKey) || 1) + 1 : 1);
    return persistent;
  }

  age(clusterKey) {
    return this.currentAges.get(clusterKey) || 0;
  }

  createSnapshot() {
    return {
      previousStep: this.previousStep,
      previousKeys: [...this.previousKeys].sort(),
      currentStep: this.currentStep,
      currentKeys: [...this.currentKeys].sort(),
      previousAges: [...this.previousAges.entries()],
      currentAges: [...this.currentAges.entries()]
    };
  }

  restoreSnapshot(snapshot = {}) {
    this.previousStep = Math.trunc(Number(snapshot.previousStep ?? -1));
    this.previousKeys = new Set(snapshot.previousKeys || []);
    this.currentStep = Math.trunc(Number(snapshot.currentStep ?? -1));
    this.currentKeys = new Set(snapshot.currentKeys || []);
    this.previousAges = new Map(snapshot.previousAges || []);
    this.currentAges = new Map(snapshot.currentAges || []);
  }
}
