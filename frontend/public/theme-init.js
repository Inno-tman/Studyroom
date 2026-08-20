try {
  var theme = localStorage.getItem('studyroom_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) { meta.setAttribute('content', theme === 'light' ? '#F1F5F9' : '#0F172A'); }
} catch (e) {}