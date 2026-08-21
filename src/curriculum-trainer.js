import { AutomaticSpacedTrainerApp } from './automatic-spaced-trainer.js?v=history-attempt-parity-v3';
import { lineLearningStatus } from './progress.js';
import { normalizeTeachingProse } from './teaching-copy.js';

function responseLearned(progress, responseId) {
  return (progress?.learnedResponses ?? []).includes(responseId);
}

function displayText(value) {
  return normalizeTeachingProse(value);
}

export class CurriculumTrainerApp extends AutomaticSpacedTrainerApp {
  renderShell() {
    super.renderShell();
    const map = this.root.querySelector('.course-map');
    const heading = map?.querySelector('.section-heading');
    const presentation = this.course.curriculum?.presentation ?? {};
    const eyebrow = heading?.querySelector('.eyebrow');
    const title = heading?.querySelector('h2');
    if (eyebrow) eyebrow.textContent = displayText(presentation.eyebrow ?? 'Curriculum map');
    if (title) title.textContent = displayText(presentation.title ?? 'Course curriculum');

    if (presentation.summary) {
      const summary = document.createElement('p');
      summary.className = 'curriculum-map-summary';
      summary.textContent = displayText(presentation.summary);
      heading?.querySelector('div')?.append(summary);
    }
  }

  curriculumResponseRoute(responseId) {
    const response = this.repertoire.responseById?.get(responseId);
    if (!response?.teachingOwnerLineId) return null;
    const ownerLine = this.course.lines.find(line => line.id === response.teachingOwnerLineId);
    if (!ownerLine) return null;
    return this.repertoire.newResponsesForLine(ownerLine).find(route => route.responseId === responseId) ?? null;
  }

  startCurriculumResponse(responseId) {
    const response = this.repertoire.responseById?.get(responseId);
    if (!response?.teachingOwnerLineId) return;
    const ownerIndex = this.course.lines.findIndex(line => line.id === response.teachingOwnerLineId);
    if (ownerIndex < 0) return;

    this.mode = 'learn';
    this.startLine(ownerIndex);
    const route = this.curriculumResponseRoute(responseId);
    if (route) this.startResponseLesson(route.id);
  }

  familyProgress(family) {
    let learned = 0;
    let total = 0;

    for (const lineId of family.lineIds ?? []) {
      total += 1;
      if (this.progress.discovered.includes(lineId)) learned += 1;
    }
    for (const responseId of family.responseIds ?? []) {
      total += 1;
      if (responseLearned(this.progress, responseId)) learned += 1;
    }

    return { learned, total };
  }

  renderCurriculumLine(container, lineId) {
    const index = this.course.lines.findIndex(line => line.id === lineId);
    const line = this.course.lines[index];
    if (!line) return;

    const discovered = this.progress.discovered.includes(line.id);
    const status = lineLearningStatus(this.progress.lines[line.id], discovered);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `line-item curriculum-line-item ${index === this.lineIndex ? 'current' : ''}`;
    button.dataset.lineIndex = String(index);

    const number = document.createElement('span');
    number.className = 'line-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = displayText(line.title);
    const variation = document.createElement('small');
    variation.textContent = displayText(line.variation);
    copy.append(title, variation);

    const pill = document.createElement('span');
    pill.className = `status-pill ${status.toLowerCase()}`;
    pill.textContent = status;

    button.append(number, copy, pill);
    button.addEventListener('click', () => this.startLine(index));
    container.append(button);
  }

  renderCurriculumResponse(container, responseId) {
    const response = this.repertoire.responseById?.get(responseId);
    const route = this.curriculumResponseRoute(responseId);
    if (!response || !route) return;

    const learned = responseLearned(this.progress, responseId);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'line-item curriculum-response-item';
    button.dataset.curriculumResponse = responseId;

    const marker = document.createElement('span');
    marker.className = 'line-number curriculum-response-marker';
    marker.textContent = '↳';

    const copy = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = displayText(response.label);
    const detail = document.createElement('small');
    detail.textContent = displayText(`${route.opponentLabel} → ${route.responseLabel}`);
    copy.append(title, detail);

    const pill = document.createElement('span');
    pill.className = `status-pill ${learned ? 'mastered' : 'new'}`;
    pill.textContent = learned ? 'Learned' : 'Response';

    button.append(marker, copy, pill);
    button.addEventListener('click', () => this.startCurriculumResponse(responseId));
    container.append(button);
  }

  renderLineList() {
    const el = this.root.querySelector('#line-list');
    const curriculum = this.course.curriculum;
    if (!curriculum?.tiers?.length || !curriculum?.families?.length) {
      super.renderLineList();
      return;
    }

    el.replaceChildren();
    el.classList.add('curriculum-list');

    for (const tier of curriculum.tiers) {
      const families = curriculum.families.filter(family => family.tier === tier.id);
      if (!families.length) continue;

      const tierSection = document.createElement('section');
      tierSection.className = `curriculum-tier curriculum-tier-${tier.id}`;
      tierSection.dataset.curriculumTier = tier.id;

      const tierHeader = document.createElement('div');
      tierHeader.className = 'curriculum-tier-header';
      const tierCopy = document.createElement('div');
      const tierTitle = document.createElement('h3');
      tierTitle.textContent = displayText(tier.label);
      const tierDescription = document.createElement('p');
      tierDescription.textContent = displayText(tier.description);
      tierCopy.append(tierTitle, tierDescription);
      tierHeader.append(tierCopy);

      if (tier.coverageGoal) {
        const target = document.createElement('span');
        target.className = 'curriculum-target';
        target.textContent = `${tier.coverageGoal}% target`;
        tierHeader.append(target);
      }
      tierSection.append(tierHeader);

      const familyList = document.createElement('div');
      familyList.className = 'curriculum-family-list';
      for (const family of families) {
        const familyCard = document.createElement('article');
        familyCard.className = 'curriculum-family';
        familyCard.dataset.curriculumFamily = family.id;

        const familyHeader = document.createElement('div');
        familyHeader.className = 'curriculum-family-header';
        const familyCopy = document.createElement('div');
        const familyTitle = document.createElement('h4');
        familyTitle.textContent = displayText(family.title);
        const role = document.createElement('span');
        role.className = 'curriculum-role';
        role.textContent = displayText(family.role);
        familyCopy.append(familyTitle, role);

        const evidence = document.createElement('span');
        evidence.className = 'curriculum-evidence';
        evidence.textContent = displayText(family.evidence?.label ?? '');
        if (family.evidence?.detail) evidence.title = displayText(family.evidence.detail);
        familyHeader.append(familyCopy, evidence);
        familyCard.append(familyHeader);

        const teaching = document.createElement('div');
        teaching.className = 'curriculum-teaching';
        const recognition = document.createElement('p');
        const recognitionLabel = document.createElement('strong');
        recognitionLabel.textContent = 'Recognize: ';
        recognition.append(recognitionLabel, document.createTextNode(displayText(family.recognition)));
        const plan = document.createElement('p');
        const planLabel = document.createElement('strong');
        planLabel.textContent = 'Plan: ';
        plan.append(planLabel, document.createTextNode(displayText(family.plan)));
        teaching.append(recognition, plan);
        familyCard.append(teaching);

        const progress = this.familyProgress(family);
        if (progress.total > 1) {
          const progressText = document.createElement('div');
          progressText.className = 'curriculum-family-progress';
          progressText.textContent = `${progress.learned}/${progress.total} discovered`;
          familyCard.append(progressText);
        }

        const members = document.createElement('div');
        members.className = 'curriculum-members';
        for (const lineId of family.lineIds ?? []) this.renderCurriculumLine(members, lineId);
        for (const responseId of family.responseIds ?? []) this.renderCurriculumResponse(members, responseId);
        familyCard.append(members);
        familyList.append(familyCard);
      }
      tierSection.append(familyList);
      el.append(tierSection);
    }
  }
}
