# Realmio Integration Guide untuk TransityCore

## Arsitektur

```
┌─────────────────────────────────────────────────────────────────────┐
│                           Browser                                    │
│  ┌───────────────────────┐    ┌───────────────────────┐             │
│  │   TransityCore        │    │   Realmio             │             │
│  │   (Frontend)          │    │   (Auth Service)      │             │
│  │                       │    │                       │             │
│  │  - Login Form         │───▶│  - /api/auth/sign-in  │             │
│  │  - Register Form      │    │  - /api/auth/sign-up  │             │
│  │  - Session Management │◀───│  - Session Cookie     │             │
│  └───────────────────────┘    └───────────────────────┘             │
│                │                          │                          │
│                │                          │                          │
│                ▼                          ▼                          │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                     PostgreSQL                                │   │
│  │  ┌──────────────────┐    ┌──────────────────────┐            │   │
│  │  │ tenant_transity_ │    │ authcore_system      │            │   │
│  │  │ core (schema)    │    │ (admin users)        │            │   │
│  │  │ - users          │    │ - users              │            │   │
│  │  │ - sessions       │    │ - sessions           │            │   │
│  │  │ - accounts       │    │                      │            │   │
│  │  │ - organizations  │    │                      │            │   │
│  │  └──────────────────┘    └──────────────────────┘            │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

## Cara Kerja

### 1. Login Flow

```
User ──▶ TransityCore Login Form ──▶ Realmio API ──▶ Session Cookie
                                      │
                                      ▼
                              tenant_transity_core.users
```

### 2. API Request

```
TransityCore ──▶ API Request + Cookie ──▶ Realmio Verify ──▶ TransityCore Backend
                   │
                   └── Cookie: better-auth.session_token=xxx
```

## Setup

### 1. Environment Variables

Tambahkan di `.env` TransityCore:

```env
# Realmio Auth Service
VITE_REALMIO_AUTH_URL=https://realmio-rndynt.zocomputer.io
VITE_REALMIO_TENANT_ID=transity-core
```

### 2. Copy Auth Library

```bash
cp client/src/lib/realmio-auth.example.ts client/src/lib/realmio-auth.ts
```

### 3. Setup Provider di App.tsx

```tsx
import { AuthProvider } from '@/lib/realmio-auth';
import { QueryClientProvider } from '@tanstack/react-query';

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClient}>
        {/* routes */}
      </QueryClientProvider>
    </AuthProvider>
  );
}
```

### 4. Protected Routes

```tsx
import { ProtectedRoute } from '@/lib/realmio-auth';

<Route path="/dashboard" element={
  <ProtectedRoute>
    <DashboardPage />
  </ProtectedRoute>
} />
```

## API Endpoints

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/auth/sign-up/email` | POST | Register user baru |
| `/api/auth/sign-in/email` | POST | Login |
| `/api/auth/sign-out` | POST | Logout |
| `/api/auth/get-session` | GET | Get current session |
| `/me` | GET | Get user + tenant info |

## Testing

```bash
# Register user baru
curl -X POST https://realmio-rndynt.zocomputer.io/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: transity-core" \
  -d '{"email":"user@transity.id","password":"Password123!","name":"Test User"}'

# Login
curl -X POST https://realmio-rndynt.zocomputer.io/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Id: transity-core" \
  -d '{"email":"user@transity.id","password":"Password123!"}'
```

## Admin Dashboard

- URL: https://realmio-rndynt.zocomputer.io/
- Login: `admin@realmio.id` / `AdminPass123!`
