'use client';

import { useLayoutEffect, useState } from 'react';

const KEY = 'theme';

function isDark() {
  return document.documentElement.dataset.theme === 'dark';
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useLayoutEffect(() => {
    const stored = localStorage.getItem(KEY);
    const next = stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    setDark(next);
  }, []);

  function toggle() {
    const next = !isDark();
    document.documentElement.dataset.theme = next ? 'dark' : 'light';
    localStorage.setItem(KEY, next ? 'dark' : 'light');
    setDark(next);
  }

  return (
    <button
      type="button"
      className="themeSwitch"
      role="switch"
      aria-checked={dark}
      aria-label={dark ? 'Ativar modo claro' : 'Ativar modo escuro'}
      onClick={toggle}
    >
      <svg className="themeSwitchIcon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="12" y1="2" x2="12" y2="4" />
          <line x1="12" y1="20" x2="12" y2="22" />
          <line x1="2" y1="12" x2="4" y2="12" />
          <line x1="20" y1="12" x2="22" y2="12" />
          <line x1="4.9" y1="4.9" x2="6.3" y2="6.3" />
          <line x1="17.7" y1="17.7" x2="19.1" y2="19.1" />
          <line x1="4.9" y1="19.1" x2="6.3" y2="17.7" />
          <line x1="17.7" y1="6.3" x2="19.1" y2="4.9" />
        </g>
      </svg>
      <span className="themeSwitchTrack" aria-hidden="true">
        <span className="themeSwitchThumb" />
      </span>
      <svg className="themeSwitchIcon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M15.4 3.1a9 9 0 1 0 5.5 15.7A9 9 0 0 1 12.2 3.2a9 9 0 0 0 3.2-.1z"
        />
      </svg>
    </button>
  );
}
