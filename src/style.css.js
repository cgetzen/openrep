for (const file of ['./style.css', './coach-overrides.css']) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL(file, import.meta.url).href;
  document.head.appendChild(link);
}
