const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = new URL('./style.css', import.meta.url).href;
document.head.appendChild(link);
