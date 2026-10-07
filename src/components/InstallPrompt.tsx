'use client';

import { useEffect, useState } from 'react';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isInstalled() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
}

function isPhone() {
  const ua = navigator.userAgent;
  if (/iPad|Tablet/i.test(ua)) return false;
  if (/Android/i.test(ua) && !/Mobile/i.test(ua)) return false;
  return /iPhone|iPod|Android|Windows Phone|Mobile/i.test(ua);
}

export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);
  const [help, setHelp] = useState('');
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (isInstalled() || !isPhone()) return;

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    setIos(/iPhone|iPod/i.test(navigator.userAgent));
    setVisible(true);

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  async function install() {
    if (ios) {
      setHelp('No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início.');
      return;
    }
    if (promptEvent) {
      try {
        await promptEvent.prompt();
        const choice = await promptEvent.userChoice;
        setPromptEvent(null);
        if (choice.outcome === 'accepted') setVisible(false);
        return;
      } catch {
        setPromptEvent(null);
      }
    }
    setHelp('No menu do navegador, escolha Instalar aplicativo ou Adicionar à tela inicial.');
  }

  return (
    <div className="install-banner">
      <p>Abra as inscrições direto da tela inicial, sem precisar do navegador.</p>
      <button type="button" onClick={install}>
        Instalar este site no seu dispositivo
      </button>
      {help && <small>{help}</small>}
    </div>
  );
}
