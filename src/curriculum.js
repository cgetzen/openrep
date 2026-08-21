function uniqueIds(items, label) {
  const ids = new Set();
  for (const item of items ?? []) {
    if (!item?.id || typeof item.id !== 'string') throw new Error(`${label} must have a stable id`);
    if (ids.has(item.id)) throw new Error(`Duplicate ${label.toLowerCase()} id: ${item.id}`);
    ids.add(item.id);
  }
  return ids;
}

function validateMemberReferences(member, lineIds, responseIds, ownerLabel) {
  for (const lineId of member?.lineIds ?? []) {
    if (!lineIds.has(lineId)) throw new Error(`${ownerLabel} references unknown line ${lineId}`);
  }
  for (const responseId of member?.responseIds ?? []) {
    if (!responseIds.has(responseId)) throw new Error(`${ownerLabel} references unknown response ${responseId}`);
  }
}

export function orderedCurriculumFamilies(curriculum) {
  const tierRank = new Map((curriculum?.tiers ?? []).map((tier, index) => [tier.id, index]));
  return [...(curriculum?.families ?? [])].sort((a, b) =>
    (tierRank.get(a.tier) ?? tierRank.size) - (tierRank.get(b.tier) ?? tierRank.size)
  );
}

export function curriculumLineOrder(lines, curriculum) {
  const lineById = new Map((lines ?? []).map(line => [line.id, line]));
  const ordered = [];
  const seen = new Set();

  for (const family of orderedCurriculumFamilies(curriculum)) {
    for (const lineId of family.lineIds ?? []) {
      const line = lineById.get(lineId);
      if (!line || seen.has(lineId)) continue;
      seen.add(lineId);
      ordered.push(line);
    }
  }

  for (const line of lines ?? []) {
    if (seen.has(line.id)) continue;
    seen.add(line.id);
    ordered.push(line);
  }

  return ordered;
}

export function curriculumConceptsForMember(curriculum, kind, id) {
  const field = kind === 'line' ? 'lineIds' : kind === 'response' ? 'responseIds' : null;
  if (!field || !id) return [];
  return (curriculum?.concepts ?? []).filter(concept => (concept[field] ?? []).includes(id));
}

export function validateCurriculum(course, curriculum) {
  if (!course?.id) throw new Error('Curriculum requires a course with stable identity');
  if (!curriculum || typeof curriculum !== 'object') throw new Error('Course curriculum is required');
  if (curriculum.schemaVersion !== 1) throw new Error(`Unsupported curriculum schema version: ${curriculum.schemaVersion ?? 'missing'}`);
  if (curriculum.courseId && curriculum.courseId !== course.id) {
    throw new Error(`Curriculum ${curriculum.courseId} does not belong to course ${course.id}`);
  }

  const tierIds = uniqueIds(curriculum.tiers, 'Curriculum tier');
  const familyIds = uniqueIds(curriculum.families, 'Curriculum family');
  uniqueIds(curriculum.concepts, 'Curriculum concept');

  const lineIds = uniqueIds(course.lines, 'Course line');
  const responseIds = uniqueIds(course.responses, 'Course response');
  const primaryLineFamily = new Map();
  const primaryResponseFamily = new Map();

  for (const family of curriculum.families ?? []) {
    if (!family.title || !tierIds.has(family.tier)) {
      throw new Error(`Invalid curriculum family: ${family.id}`);
    }
    validateMemberReferences(family, lineIds, responseIds, `Curriculum family ${family.id}`);

    for (const lineId of family.lineIds ?? []) {
      const existing = primaryLineFamily.get(lineId);
      if (existing) throw new Error(`Curriculum line ${lineId} is assigned to both ${existing} and ${family.id}`);
      primaryLineFamily.set(lineId, family.id);
    }
    for (const responseId of family.responseIds ?? []) {
      const existing = primaryResponseFamily.get(responseId);
      if (existing) throw new Error(`Curriculum response ${responseId} is assigned to both ${existing} and ${family.id}`);
      primaryResponseFamily.set(responseId, family.id);
    }
  }

  for (const lineId of lineIds) {
    if (!primaryLineFamily.has(lineId)) throw new Error(`Curriculum does not classify line ${lineId}`);
  }

  for (const concept of curriculum.concepts ?? []) {
    if (!concept.title) throw new Error(`Curriculum concept ${concept.id} must have a title`);
    validateMemberReferences(concept, lineIds, responseIds, `Curriculum concept ${concept.id}`);
  }

  if (familyIds.size === 0) throw new Error('Curriculum must define at least one primary family');
  return true;
}

export function buildCurriculumCourse(course, curriculum) {
  validateCurriculum(course, curriculum);
  return {
    ...course,
    lines: [...(course.lines ?? [])],
    curriculum
  };
}
