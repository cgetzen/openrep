export function normalizeTeachingProse(value) {
  return String(value ?? '')
    .replace(/\b\d+\.\.\.(?=[A-Za-z0-9])/g, '')
    .replace(/\.\.\.(?=[A-Za-z0-9])/g, '');
}

export function hasBlackMoveEllipsis(value) {
  return /(?:\b\d+)?\.\.\.(?=[A-Za-z0-9])/.test(String(value ?? ''));
}
