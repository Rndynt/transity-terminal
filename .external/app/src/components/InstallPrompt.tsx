import { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

const INSTALL_DISMISSED_KEY = 't_install_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (window.navigator as any).standalone ||
    window.matchMedia('(display-mode: standalone)').matches;
}

export default function InstallPrompt({ show }: { show: boolean }) {
  const [visible, setVisible] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isApple, setIsApple] = useState(false);
  const [animateOut, setAnimateOut] = useState(false);

  useEffect(() => {
    if (!show) return;
    if (isStandalone()) return;
    if (localStorage.getItem(INSTALL_DISMISSED_KEY) === '1') return;

    setIsApple(isIOS());

    const timer = setTimeout(() => setVisible(true), 600);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [show]);

  const dismiss = () => {
    setAnimateOut(true);
    setTimeout(() => {
      setVisible(false);
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
    }, 250);
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setVisible(false);
      }
      setDeferredPrompt(null);
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={dismiss} />
      <div
        className={`relative w-full max-w-md mx-4 mb-6 bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 ${animateOut ? 'translate-y-full opacity-0' : 'animate-slide-up'}`}
      >
        <div className="relative px-5 pt-5 pb-4">
          <button
            onClick={dismiss}
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-teal-700 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/>
                <path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/>
                <circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/>
              </svg>
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-slate-900 font-display">Install Transity</h3>
              <p className="text-[13px] text-slate-500">Akses lebih cepat dari layar utama</p>
            </div>
          </div>

          {isApple && !deferredPrompt ? (
            <div className="bg-slate-50 rounded-2xl p-4 mb-4">
              <p className="text-[13px] text-slate-600 leading-relaxed">
                <span className="font-semibold text-slate-800">Cara install di iPhone:</span>
              </p>
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Share className="w-4 h-4 text-blue-600" />
                  </div>
                  <p className="text-[13px] text-slate-600">
                    Ketuk tombol <span className="font-semibold">Share</span> di bawah Safari
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                    <Download className="w-4 h-4 text-teal-600" />
                  </div>
                  <p className="text-[13px] text-slate-600">
                    Pilih <span className="font-semibold">"Add to Home Screen"</span>
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-[14px] text-slate-500 leading-relaxed mb-4">
              Tambahkan ke layar utama untuk pengalaman seperti aplikasi — buka lebih cepat, tanpa address bar.
            </p>
          )}

          <div className="flex gap-3">
            <button
              onClick={dismiss}
              className="flex-1 h-12 rounded-2xl text-[14px] font-semibold text-slate-500 bg-slate-100 hover:bg-slate-200 transition-colors active:scale-[0.97]"
            >
              Nanti Saja
            </button>
            {isApple && !deferredPrompt ? (
              <button
                onClick={dismiss}
                className="flex-1 h-12 rounded-2xl text-[14px] font-bold text-white btn-gradient shadow-lg shadow-teal-600/20 active:scale-[0.97] transition-transform"
              >
                Mengerti
              </button>
            ) : (
              <button
                onClick={handleInstall}
                className="flex-1 h-12 rounded-2xl text-[14px] font-bold text-white btn-gradient shadow-lg shadow-teal-600/20 active:scale-[0.97] transition-transform flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Install
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
