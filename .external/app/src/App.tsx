import { useState, useEffect, useRef, createContext, useContext, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { store, authApi, ApiError, type AppUser } from '@/lib/api';
import HomePage from '@/pages/HomePage';
import SearchResultsPage from '@/pages/SearchResultsPage';
import TripDetailPage from '@/pages/TripDetailPage';
import SelectStopsPage from '@/pages/SelectStopsPage';
import SelectSeatsPage from '@/pages/SelectSeatsPage';
import BookingConfirmPage from '@/pages/BookingConfirmPage';
import PaymentPage from '@/pages/PaymentPage';
import PaymentInstructionPage from '@/pages/PaymentInstructionPage';
import BookingDetailPage from '@/pages/BookingDetailPage';
import MyTripsPage from '@/pages/MyTripsPage';
import AuthPage from '@/pages/AuthPage';
import ProfilePage from '@/pages/ProfilePage';
import HelpPage from '@/pages/HelpPage';
import NotificationsPage from '@/pages/NotificationsPage';
import AboutPage from '@/pages/AboutPage';
import PromoDetailPage from '@/pages/PromoDetailPage';
import PromoListPage from '@/pages/PromoListPage';
import OnboardingPage, { hasSeenOnboarding } from '@/pages/OnboardingPage';
import InstallPrompt from '@/components/InstallPrompt';
import { Home, Ticket, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Page =
  | { name: 'home' }
  | { name: 'search-results'; originCity: string; destinationCity: string; date: string; passengers: number; operatorFilter?: string | null }
  | { name: 'trip-detail'; tripId: string; serviceDate: string; passengers: number; originCity: string; destCity: string; trip: import('@/lib/api').TripSearchResult; rawStops: import('@/lib/api').TripStopInfo[] }
  | { name: 'select-stops'; tripId: string; serviceDate: string; passengers: number; tripLabel: string; fare: number; stops?: import('@/lib/api').TripStopInfo[]; originCity: string; destCity: string; originSeq: number; destSeq: number }
  | { name: 'select-seats'; tripId: string; serviceDate: string; originStopId: string; destStopId: string; originSeq: number; destSeq: number; passengers: number; tripLabel: string; fare: number; originStopName?: string; destStopName?: string; originTime?: string; destTime?: string }
  | { name: 'booking-confirm'; tripId: string; serviceDate: string; originStopId: string; destStopId: string; originSeq: number; destSeq: number; seats: string[]; tripLabel: string; fare: number; originStopName?: string; destStopName?: string; originTime?: string; destTime?: string }
  | { name: 'payment'; tripId: string; serviceDate: string; originStopId: string; destStopId: string; originSeq: number; destSeq: number; seats: string[]; tripLabel: string; fare: number; originStopName?: string; destStopName?: string; originTime?: string; destTime?: string; passengers: Array<{ fullName: string; phone?: string; seatNo: string }>; bookingId: string; holdExpiresAt: string | null }
  | { name: 'payment-instruction'; bookingId: string; paymentMethod: string; paymentMethodName: string; paymentMethodType: string; total: number; holdExpiresAt: string | null }
  | { name: 'booking-detail'; bookingId: string; source?: 'gateway' | 'terminal' }
  | { name: 'my-trips' }
  | { name: 'auth'; returnTo?: Page }
  | { name: 'profile' }
  | { name: 'help' }
  | { name: 'notifications' }
  | { name: 'about' }
  | { name: 'promo-detail'; promoId: string }
  | { name: 'promo-list' };

interface AuthCtx {
  user: AppUser | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (user: AppUser, token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null, isLoggedIn: false, isLoading: true,
  login: () => {}, logout: () => {},
});

export const useAuth = () => useContext(AuthContext);

interface NavCtx {
  page: Page;
  navigate: (p: Page) => void;
  navigateReplace: (p: Page) => void;
  goBack: () => void;
  resetTo: (p: Page) => void;
}

const NavContext = createContext<NavCtx>({
  page: { name: 'home' }, navigate: () => {}, navigateReplace: () => {}, goBack: () => {}, resetTo: () => {},
});

export const useNav = () => useContext(NavContext);

const SheetContext = createContext<{ sheetOpen: boolean; setSheetOpen: (v: boolean) => void }>({
  sheetOpen: false, setSheetOpen: () => {},
});
export const useSheet = () => useContext(SheetContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(store.getUser());
  const [isLoading, setIsLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    const minSplash = new Promise(r => setTimeout(r, 1800));
    const authCheck = new Promise<void>((resolve) => {
      if (store.isLoggedIn()) {
        authApi.getMe()
          .then((u) => {
            if (u && u.id) {
              setUser(u);
              store.setAuth(u, store.getToken()!);
            }
          })
          .catch((err) => {
            if (err instanceof ApiError && err.status === 401) {
              store.logout();
              setUser(null);
              qc.clear();
            }
          })
          .finally(resolve);
      } else {
        resolve();
      }
    });
    Promise.all([minSplash, authCheck]).then(() => setIsLoading(false));
  }, []);

  const login = useCallback((u: AppUser, token: string) => {
    store.setAuth(u, token); setUser(u);
  }, []);

  const logout = useCallback(() => {
    store.logout();
    setUser(null);
    qc.clear();
  }, [qc]);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function NavProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Page[]>([{ name: 'home' }]);
  const skipPopRef = useRef(false);
  const page = history[history.length - 1];

  const navigate = useCallback((p: Page) => {
    setHistory((h) => [...h, p]);
    window.history.pushState({ idx: Date.now() }, '');
    window.scrollTo({ top: 0 });
  }, []);

  const navigateReplace = useCallback((p: Page) => {
    setHistory((h) => {
      const next = h.length > 1 ? h.slice(0, -1) : [...h];
      next.push(p);
      return next;
    });
    window.history.replaceState({ idx: Date.now() }, '');
    window.scrollTo({ top: 0 });
  }, []);

  const goBack = useCallback(() => {
    setHistory((h) => {
      if (h.length <= 1) return h;
      skipPopRef.current = true;
      window.history.back();
      return h.slice(0, -1);
    });
    window.scrollTo({ top: 0 });
  }, []);

  const resetTo = useCallback((p: Page) => {
    const delta = history.length - 1;
    setHistory(p.name === 'home' ? [p] : [{ name: 'home' }, p]);
    if (delta > 0) {
      skipPopRef.current = true;
      window.history.go(-delta);
    }
    if (p.name !== 'home') {
      setTimeout(() => window.history.pushState({ idx: Date.now() }, ''), 50);
    }
    window.scrollTo({ top: 0 });
  }, [history.length]);

  useEffect(() => {
    const onPopState = () => {
      if (skipPopRef.current) {
        skipPopRef.current = false;
        return;
      }
      setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h));
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  return (
    <NavContext.Provider value={{ page, navigate, navigateReplace, goBack, resetTo }}>{children}</NavContext.Provider>
  );
}

function PageRouter() {
  const { page } = useNav();
  switch (page.name) {
    case 'home': return <HomePage />;
    case 'search-results': return <SearchResultsPage {...page} />;
    case 'trip-detail': return <TripDetailPage {...page} />;
    case 'select-stops': return <SelectStopsPage {...page} />;
    case 'select-seats': return <SelectSeatsPage {...page} />;
    case 'booking-confirm': return <BookingConfirmPage {...page} />;
    case 'payment': return <PaymentPage {...page} />;
    case 'payment-instruction': return <PaymentInstructionPage {...page} />;
    case 'booking-detail': return <BookingDetailPage bookingId={page.bookingId} source={page.source} />;
    case 'my-trips': return <MyTripsPage />;
    case 'auth': return <AuthPage returnTo={page.returnTo} />;
    case 'profile': return <ProfilePage />;
    case 'help': return <HelpPage />;
    case 'notifications': return <NotificationsPage />;
    case 'about': return <AboutPage />;
    case 'promo-detail': return <PromoDetailPage promoId={page.promoId} />;
    case 'promo-list': return <PromoListPage />;
    default: return <HomePage />;
  }
}

function BottomNav() {
  const { page, navigate } = useNav();
  const { isLoggedIn } = useAuth();
  const { sheetOpen } = useSheet();

  const hide = sheetOpen || ['auth', 'trip-detail', 'select-stops', 'select-seats', 'booking-confirm', 'payment', 'payment-instruction', 'promo-detail', 'promo-list'].includes(page.name);
  if (hide) return null;

  const tabs = [
    { key: 'home' as const, label: 'Beranda', icon: Home },
    { key: 'my-trips' as const, label: 'Pesanan', icon: Ticket },
    { key: 'profile' as const, label: isLoggedIn ? 'Akun' : 'Masuk', icon: UserCircle2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 safe-bottom">
      <div className="mx-4 mb-2 rounded-[20px] bg-white/95 backdrop-blur-2xl border border-slate-200/80 shadow-[0_-2px_12px_rgba(0,0,0,0.08),0_4px_24px_rgba(0,0,0,0.10)]">
        <div className="flex items-center py-1.5 px-2">
          {tabs.map((tab) => {
            const active =
              (tab.key === 'home' && page.name === 'home') ||
              (tab.key === 'my-trips' && ['my-trips', 'booking-detail'].includes(page.name)) ||
              (tab.key === 'profile' && ['profile', 'auth', 'help', 'notifications', 'about'].includes(page.name));
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  if (tab.key === 'my-trips' && !isLoggedIn) {
                    navigate({ name: 'auth', returnTo: { name: 'my-trips' } });
                  } else if (tab.key === 'profile') {
                    navigate(isLoggedIn ? { name: 'profile' } : { name: 'auth' });
                  } else {
                    navigate({ name: tab.key });
                  }
                }}
                className="flex-1 flex flex-col items-center gap-0.5 py-1 relative"
              >
                <div className={cn(
                  'w-14 h-8 flex items-center justify-center rounded-2xl transition-all duration-300',
                  active ? 'bg-gradient-to-r from-teal-600/15 to-emerald-500/15' : 'bg-transparent',
                )}>
                  <Icon className={cn(
                    'w-[22px] h-[22px] transition-all duration-300',
                    active ? 'text-teal-700' : 'text-slate-400',
                  )} strokeWidth={active ? 2.3 : 1.7} />
                </div>
                <span className={cn(
                  'text-[10.5px] font-semibold transition-all duration-300',
                  active ? 'text-teal-700' : 'text-slate-400',
                )}>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

function AppShell() {
  const { isLoading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(!hasSeenOnboarding());
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center overflow-hidden" style={{ background: 'linear-gradient(165deg, #0d4f4a 0%, #115e59 25%, #0f766e 50%, #059669 85%, #10b981 100%)' }}>
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-[30%] -left-[20%] w-[70%] h-[70%] rounded-full opacity-[0.07]" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
          <div className="absolute -bottom-[20%] -right-[15%] w-[60%] h-[60%] rounded-full opacity-[0.05]" style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
          <div className="absolute top-[15%] right-[10%] w-[25%] h-[25%] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #6ee7b7 0%, transparent 70%)' }} />
        </div>

        <div className="relative flex flex-col items-center splash-entry">
          <div className="relative mb-6">
            <div className="absolute inset-0 rounded-[28px] blur-2xl opacity-40" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', transform: 'scale(1.3) translateY(8px)' }} />
            <div className="relative w-[88px] h-[88px] rounded-[28px] flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.18)', boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)' }}>
              <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="12" width="36" height="22" rx="6" fill="white" fillOpacity="0.95"/>
                <rect x="10" y="16" width="8" height="7" rx="2.5" fill="#059669" fillOpacity="0.6"/>
                <rect x="20" y="16" width="8" height="7" rx="2.5" fill="#059669" fillOpacity="0.6"/>
                <rect x="30" y="16" width="8" height="7" rx="2.5" fill="#059669" fillOpacity="0.6"/>
                <circle cx="14" cy="34" r="3.5" fill="white" fillOpacity="0.9"/>
                <circle cx="14" cy="34" r="1.8" fill="#059669" fillOpacity="0.5"/>
                <circle cx="34" cy="34" r="3.5" fill="white" fillOpacity="0.9"/>
                <circle cx="34" cy="34" r="1.8" fill="#059669" fillOpacity="0.5"/>
                <line x1="8" y1="28" x2="40" y2="28" stroke="#059669" strokeOpacity="0.15" strokeWidth="1.5"/>
              </svg>
            </div>
          </div>

          <h1 className="text-[32px] font-extrabold text-white tracking-tight mb-1" style={{ fontFamily: 'Outfit, sans-serif', textShadow: '0 2px 12px rgba(0,0,0,0.15)' }}>
            Transity
          </h1>
          <p className="text-[13px] font-medium tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Travel made simple
          </p>
        </div>

        <div className="absolute bottom-[12%] flex flex-col items-center gap-4 splash-loader">
          <div className="relative w-10 h-10">
            <div className="absolute inset-0 rounded-full" style={{ border: '2.5px solid rgba(255,255,255,0.1)' }} />
            <div className="absolute inset-0 rounded-full animate-spin" style={{ border: '2.5px solid transparent', borderTopColor: 'rgba(255,255,255,0.7)', animationDuration: '0.8s' }} />
          </div>
        </div>

        <style>{`
          @keyframes splashEntry {
            0% { opacity: 0; transform: translateY(24px) scale(0.95); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes splashLoader {
            0% { opacity: 0; }
            100% { opacity: 1; }
          }
          .splash-entry {
            animation: splashEntry 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
          .splash-loader {
            animation: splashLoader 0.5s 0.4s ease-out both;
          }
        `}</style>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingPage onDone={() => { setShowOnboarding(false); setShowInstallPrompt(true); }} />;
  }

  return (
    <SheetContext.Provider value={{ sheetOpen, setSheetOpen }}>
      <div className="min-h-screen bg-background relative">
        <InstallPrompt show={showInstallPrompt} />
        <PageRouter />
        <BottomNav />
      </div>
    </SheetContext.Provider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NavProvider>
        <AppShell />
      </NavProvider>
    </AuthProvider>
  );
}
