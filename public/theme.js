// Runs before first paint so a forced theme never flashes. 'system' stores nothing.
try {
  const t = localStorage.getItem('fringeless-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch { /* storage unavailable: follow the system */ }
