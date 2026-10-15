'use client';

import { useEffect } from 'react';
import { DEFAULT_EVENT, type EventSettings } from '../eventSettings';
import { ThemeToggle } from './ThemeToggle';

export function SettingsModal({
  event,
  onEventChange,
  onClose,
  onLogout,
}: {
  event: EventSettings;
  onEventChange: (event: EventSettings) => void;
  onClose: () => void;
  onLogout: () => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="dialogBackdrop" role="dialog" aria-modal="true" aria-labelledby="settings-title" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="dialogClose" aria-label="Fechar" onClick={onClose}>
          ×
        </button>
        <h2 id="settings-title">Configurações</h2>
        <label className="settingsField">
          Nome do seminário
          <input
            value={event.title}
            onChange={(e) => onEventChange({ ...event, title: e.target.value })}
            onBlur={() => onEventChange({ ...event, title: event.title.trim() || DEFAULT_EVENT.title })}
          />
        </label>
        <label className="settingsField">
          Data
          <input
            value={event.date}
            onChange={(e) => onEventChange({ ...event, date: e.target.value })}
            onBlur={() => onEventChange({ ...event, date: event.date.trim() || DEFAULT_EVENT.date })}
          />
        </label>
        <label className="settingsField">
          Meta de inscritos
          <input
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={event.goal}
            onChange={(e) => {
              const n = Number(e.target.value);
              onEventChange({ ...event, goal: Number.isFinite(n) ? n : 0 });
            }}
            onBlur={() => onEventChange({ ...event, goal: event.goal >= 1 ? Math.round(event.goal) : DEFAULT_EVENT.goal })}
          />
        </label>
        <div className="settingsTheme">
          <span>Aparência</span>
          <ThemeToggle />
        </div>
        <button type="button" className="ghost settingsLogout" onClick={onLogout}>
          Fazer logout
        </button>
      </div>
    </div>
  );
}
