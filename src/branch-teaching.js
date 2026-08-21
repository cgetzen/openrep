const REQUIRED_FIELDS = Object.freeze([
  'position',
  'plan',
  'opponentPlan',
  'memoryHook'
]);

function requireText(value, label) {
  const text = String(value ?? '').trim();
  if (!text) throw new Error(`Branch teaching requires ${label}`);
  return text;
}

export function firstRepertoireDecisionPly(courseSide) {
  if (courseSide === 'w') return 0;
  if (courseSide === 'b') return 1;
  throw new Error(`Unsupported course side: ${courseSide ?? 'missing'}`);
}

export function formatBranchBriefing(teaching) {
  if (!teaching) return null;
  return `${teaching.position} ${teaching.plan} ${teaching.opponentPlan} Key idea: ${teaching.memoryHook}`;
}

export class BranchTeachingIndex {
  constructor(course) {
    if (!course?.id) throw new Error('Branch teaching requires a course id');
    if (!Array.isArray(course.lines)) throw new Error('Branch teaching requires course lines');
    if (!Array.isArray(course.branchTeaching)) {
      throw new Error(`Course ${course.id} is missing branch teaching`);
    }

    this.courseSide = course.side;
    this.firstDecisionPly = firstRepertoireDecisionPly(course.side);
    this.byLineId = new Map();
    const lineIds = new Set(course.lines.map(line => line.id));

    for (const entry of course.branchTeaching) {
      const lineId = requireText(entry?.lineId, 'lineId');
      if (!lineIds.has(lineId)) {
        throw new Error(`Branch teaching references unknown line ${lineId}`);
      }
      if (this.byLineId.has(lineId)) {
        throw new Error(`Duplicate branch teaching for line ${lineId}`);
      }

      const teaching = { lineId, source: requireText(entry.source, `${lineId}.source`) };
      for (const field of REQUIRED_FIELDS) {
        teaching[field] = requireText(entry[field], `${lineId}.${field}`);
      }
      this.byLineId.set(lineId, Object.freeze(teaching));
    }

    for (const line of course.lines) {
      if (!this.byLineId.has(line.id)) {
        throw new Error(`Missing branch teaching for line ${line.id}`);
      }
    }
  }

  teachingForLine(lineId) {
    return this.byLineId.get(lineId) ?? null;
  }

  briefingForLine(lineId) {
    return formatBranchBriefing(this.teachingForLine(lineId));
  }

  briefingForDecision(lineId, decisionPly) {
    if (decisionPly !== this.firstDecisionPly) return null;
    return this.briefingForLine(lineId);
  }
}
