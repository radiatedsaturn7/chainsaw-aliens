import {isDeepStrictEqual} from 'node:util';

// Authoring only: the canonical 660-position queue may replace an unresolved
// historical lead, but never silently admit a misspelled or unreserved identity.
export function supplementalCanonicalCandidates(records, backlog, queue) {
  const missing = records.filter(r => !backlog.some(c => c.id === r.candidateId));
  if (!missing.length) return [];
  if (queue?.targetCount !== 660 || queue.targets?.length !== 660 ||
      new Set(queue.targets.map(t => t.targetId)).size !== 660) {
    throw Error('Supplemental intake requires an intact canonical 660-position queue');
  }
  const reservations = queue.idReservations || [];
  return missing.map(r => {
    if (r.canonicalReservationRequired !== true) throw Error('Supplemental identity must explicitly require a canonical reservation');
    if (!Number.isInteger(r.identity?.year) ||
        ['make','model','trim','market'].some(k => typeof r.identity?.[k] !== 'string' || !r.identity[k].trim()) ||
        typeof r.bodyClass !== 'string' || !r.bodyClass.trim()) {
      throw Error('Supplemental identity requires exact year, make, model, trim, market and body class');
    }
    const matches = reservations.filter(x => x.candidateId === r.candidateId);
    if (matches.length !== 1) throw Error('Supplemental identity requires exactly one canonical reservation');
    const x = matches[0], target = queue.targets.find(t => t.targetId === x.targetId);
    if (x.status !== 'intake-preflight-passed-ready-for-generation' ||
        target?.status !== 'open-research-position' || target.stableCarId != null ||
        reservations.filter(y => y.targetId === x.targetId).length !== 1 ||
        x.alias !== r.name || x.documentId !== r.id || x.stableCarId !== 'saved-car:' + r.name ||
        !isDeepStrictEqual(x.identity, r.identity) || x.bodyClass !== r.bodyClass) {
      throw Error('Supplemental identity does not match its exact unused canonical reservation');
    }
    return {id:r.candidateId, canonicalTargetId:x.targetId};
  });
}
