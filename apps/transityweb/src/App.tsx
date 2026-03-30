import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { store, authApi, type AppUser } from '@/lib/api';
import HomePage from '@/pages/HomePage';
import SearchResultsPage from '@/pages/SearchResultsPage';
import SelectStopsPage from '@/pages/SelectStopsPage';
import SelectSeatsPage from '@/pages/SelectSeatsPage';
import BookingConfirmPage from '@/pages/BookingConfirmPage';
import BookingDetailPage from '@/pages/BookingDetailPage';
import MyTripsPage from '@/pages/MyTripsPage';
import AuthPage from '@/pages/AuthPage';
import { Home, Ticket, UserCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Page =
  | { name: 'home' }
  | { name: 'search-results'; originCity: string; destinationCity: string; date: string; passengers: number }
  | { name: 'select-stops'; tripId: string; passengers: number; tripLabel: string; fare: number; stops: import('@/lib/api').TripStopInfo[]; originCity: string; destCity: string; originSeq: number; destSeq: number }
  | { name: 'select-seats'; tripId: string; originStopId: string; destStopId: string; originSeq: number; destSeq: number; passengers: number; tripLabel: string; fare: number }
  | { name: 'booking-confirm'; tripId: string; originStopId: string; destStopId: string; originSeq: number; destSeq: number; seats: string[]; tripLabel: string; fare: number }
  | { name: 'booking-detail'; bookingId: string }
  | { name: 'my-trips' }
  | { name: 'auth'; returnTo?: Page };

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
  goBack: () => void;
}

const NavContext = createContext<NavCtx>({
  page: { name: 'home' }, navigate: () => {}, goBack: () => {},
});

export const useNav = () => useContext(NavContext);

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(store.getUser());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (store.isLoggedIn()) {
      authApi.getMe()
        .then((u) => { setUser(u); store.setAuth(u, store.getToken()!); })
        .catch(() => { store.logout(); setUser(null); })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback((u: AppUser, token: string) => {
    store.setAuth(u, token); setUser(u);
  }, []);

  const logout = useCallback(() => {
    store.logout(); setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function NavProvider({ children }: { children: React.ReactNode }) {
  const [history, setHistory] = useState<Page[]>([{ name: 'home' }]);
  const page = history[history.length - 1];
  const navigate = useCallback((p: Page) => {
    setHistory((h) => [...h, p]); window.scrollTo({ top: 0 });
  }, []);
  const goBack = useCallback(() => {
    setHistory((h) => (h.length > 1 ? h.slice(0, -1) : h)); window.scrollTo({ top: 0 });
  }, []);
  return (
    <NavContext.Provider value={{ page, navigate, goBack }}>{children}</NavContext.Provider>
  );
}

function PageRouter() {
  const { page } = useNav();
  switch (page.name) {
    case 'home': return <HomePage />;
    case 'search-results': return <SearchResultsPage {...page} />;
    case 'select-stops': return <SelectStopsPage {...page} />;
    case 'select-seats': return <SelectSeatsPage {...page} />;
    case 'booking-confirm': return <BookingConfirmPage {...page} />;
    case 'booking-detail': return <BookingDetailPage {...page} />;
    case 'my-trips': return <MyTripsPage />;
    case 'auth': return <AuthPage returnTo={page.returnTo} />;
    default: return <HomePage />;
  }
}

function BottomNav() {
  const { page, navigate } = useNav();
  const { isLoggedIn } = useAuth();

  const hide = ['search-results', 'select-stops', 'select-seats', 'booking-confirm', 'booking-detail'].includes(page.name);
  if (hide) return null;

  const tabs = [
    { key: 'home' as const, label: 'Beranda', icon: Home },
    { key: 'my-trips' as const, label: 'Pesanan', icon: Ticket },
    { key: 'auth' as const, label: isLoggedIn ? 'Akun' : 'Masuk', icon: UserCircle2 },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-xl border-t border-teal-900/5 safe-bottom">
      <div className="flex">
        {tabs.map((tab) => {
          const active =
            (tab.key === 'home' && page.name === 'home') ||
            (tab.key === 'my-trips' && page.name === 'my-trips') ||
            (tab.key === 'auth' && page.name === 'auth');
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === 'my-trips' && !isLoggedIn) {
                  navigate({ name: 'auth', returnTo: { name: 'my-trips' } });
                } else {
                  navigate({ name: tab.key });
                }
              }}
              className="flex-1 flex flex-col items-center gap-[2px] pt-2 pb-1"
              data-testid={`nav-${tab.key}`}
            >
              <div className={cn(
                'w-9 h-9 flex items-center justify-center rounded-2xl transition-all duration-300',
                active ? 'bg-teal-900 shadow-glow' : '',
              )}>
                <Icon className={cn(
                  'w-[20px] h-[20px] transition-colors duration-300',
                  active ? 'text-white' : 'text-slate-400',
                )} strokeWidth={active ? 2.2 : 1.8} />
              </div>
              <span className={cn(
                'text-[10px] font-semibold transition-colors duration-300',
                active ? 'text-teal-900' : 'text-slate-400',
              )}>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

function AppShell() {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-900 flex items-center justify-center shadow-glow">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>
        </div>
        <div className="flex gap-1">
          <span className="w-2 h-2 rounded-full bg-teal-700 animate-pulse" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-background relative">
      <PageRouter />
      <BottomNav />
    </div>
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
