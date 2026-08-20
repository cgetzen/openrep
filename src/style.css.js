const assetVersion = 'branch-feedback-v2';
for (const file of ['./style.css', './coach-overrides.css', './evaluation-bar.css']) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  const url = new URL(file, import.meta.url);
  url.searchParams.set('v', assetVersion);
  link.href = url.href;
  document.head.appendChild(link);
}
