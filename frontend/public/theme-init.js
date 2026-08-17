try {
  document.documentElement.setAttribute('data-theme', localStorage.getItem('studyroom_theme') || 'dark');
} catch (e) {}
