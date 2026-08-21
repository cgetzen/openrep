const assetVersion = 'coverage-curriculum-v1';
for (const file of ['./style.css', './practice-modes.css', './coach-overrides.css', './evaluation-bar.css', './curriculum.css']) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const url = new URL(file, import.meta.url);
  url.searchParams.set('v', assetVersion);
  link.href = url.href;
  document.head.appendChild(link);
}
