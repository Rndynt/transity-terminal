import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { log } from '@server/vite';
import { createSocketIoAdapter } from './redis';
import { verifyToken, type AppUserPayload } from '@server/modules/app/app.auth';
import { createComponentLogger } from '@server/lib/logger';
import { evaluateServiceKey } from '@server/lib/serviceKey';

const wsLog = createComponentLogger('ws');

// S2-07: kategori klien yang sudah authenticate di handshake.
// - 'service' = backend trusted (Console BE, engine, internal scheduler) yang
//   memegang TERMINAL_SERVICE_KEY. Boleh subscribe room operator/CSO.
// - 'app-user' = end user mobile/web yang punya JWT valid. Boleh subscribe
//   room publik (trip seatmap) saja, tidak boleh ke base/cso.
// - 'anonymous' = belum login. Boleh subscribe trip room (seatmap shopping)
//   saja. Tidak akses base/cso.
type SocketAuthKind = 'service' | 'app-user' | 'anonymous';

interface SocketAuthData {
  kind: SocketAuthKind;
  user?: AppUserPayload;
}

declare module 'socket.io' {
  interface Socket {
    // S2-07: state auth yang di-attach oleh middleware handshake.
    data: SocketAuthData;
  }
}

// WebSocket event types
export interface WSEvents {
  TRIP_STATUS_CHANGED: { tripId: string; status: string };
  TRIP_CANCELED: { tripId: string };
  HOLDS_RELEASED: { tripId: string; seatNos?: string[] };
  TRIP_MATERIALIZED: { baseId: string; serviceDate: string; tripId: string };
  INVENTORY_UPDATED: { tripId: string; seatNo: string; legIndexes?: number[] };
  STOP_EXCEPTION_CHANGED: { baseId: string; serviceDate: string; stopId: string };
  // Fired whenever any price_rules / price_rule_exceptions row changes
  // (Master Data "Aturan Harga" save, activate/deactivate, delete, sync
  // missing pairs, or a per-trip exception). patternId/tripId are best-
  // effort hints for future targeted invalidation — clients currently just
  // treat any occurrence as "re-fetch the priced matrix I have open".
  PRICE_RULES_CHANGED: { patternId?: string; tripId?: string };
}

export type WSEventName = keyof WSEvents;
export type WSEventData<T extends WSEventName> = WSEvents[T];

class WebSocketService {
  private io: SocketIOServer | null = null;

  async initialize(httpServer: HttpServer) {
    if (this.io) {
      return;
    }

    // B12: di production, JANGAN pernah pakai wildcard `*` atau `true` (reflect any).
    // Jika CORS_ORIGINS tidak diset di production, tutup CORS penuh (false) +
    // log warning agar deploy yang kelupaan setting tidak diam-diam permissive.
    const isProd = process.env.NODE_ENV === 'production';
    const rawOrigins = process.env.CORS_ORIGINS?.trim();
    let allowedOrigins: string[] | boolean;
    if (rawOrigins && rawOrigins !== '*') {
      allowedOrigins = rawOrigins.split(',').map(s => s.trim()).filter(Boolean);
    } else if (isProd) {
      // Production tanpa CORS_ORIGINS yang valid → CLOSE (no cross-origin allowed).
      // Set CORS_ORIGINS=https://yourdomain,https://other untuk membuka.
      wsLog.warn('CORS_ORIGINS not set (or set to "*") in production. Cross-origin WS connections will be REJECTED. Set CORS_ORIGINS=https://yourdomain to enable.');
      allowedOrigins = false;
    } else {
      // Development → permisif.
      allowedOrigins = true;
    }

    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"]
      },
      transports: ['websocket', 'polling']
    });

    // S1: Redis adapter untuk multi-instance broadcast sync.
    // Kalau REDIS_URL tidak diset, tetap pakai in-memory adapter (single-instance OK).
    try {
      const bundle = await createSocketIoAdapter();
      if (bundle) {
        this.io.adapter(bundle.adapter as never);
        log('Socket.io Redis adapter attached (multi-instance broadcast enabled)', 'websocket');
      } else {
        log('Redis not configured — using in-memory adapter (single-instance only)', 'websocket');
      }
    } catch (err) {
      wsLog.error({ err }, 'failed to attach redis adapter, falling back to in-memory');
    }

    // S2-07: handshake middleware — authenticate sekali pas connect, simpan
    // hasil di socket.data. Kalau token JWT atau serviceKey invalid eksplisit
    // (kasih tapi salah), tolak koneksi. Kalau tidak kasih sama sekali, treat
    // anonymous (untuk seatmap shopping publik).
    const expectedServiceKey = process.env.TERMINAL_SERVICE_KEY?.trim();
    // S2-07: default STRICT mode di production (NODE_ENV=production); dev
    // tetap permisif supaya operator UI lama yang anon subscribe ke base/cso
    // tidak break. Operator boleh paksa via STRICT_WS_AUTH=1 atau matikan
    // via STRICT_WS_AUTH=0 (override eksplisit). `isProd` sudah dideklarasikan
    // di atas (CORS branch).
    const explicitStrict = process.env.STRICT_WS_AUTH;
    const strictWsAuth = explicitStrict === '1' || (isProd && explicitStrict !== '0');
    if (!strictWsAuth) {
      log('STRICT_WS_AUTH off — base/cso room subscriptions allow anonymous (legacy compat). Set STRICT_WS_AUTH=1 to enforce service-key.', 'websocket');
    } else {
      log('STRICT_WS_AUTH on — base/cso room subscriptions require service-key.', 'websocket');
    }
    this.io.use((socket, next) => {
      const auth = (socket.handshake.auth || {}) as { token?: string; serviceKey?: string };

      // Service-key path (Console BE, engine internal).
      if (auth.serviceKey) {
        const result = evaluateServiceKey(auth.serviceKey, expectedServiceKey ?? '');
        if (result.kind === 'not-configured') {
          // CR-S2-07-HIGH: klien KIRIM serviceKey tapi server tidak punya
          // expectedServiceKey untuk verify → ini misconfiguration ops yang
          // berbahaya (key bisa accidentally bocor + di-trust). Reject
          // eksplisit; jangan downgrade jadi anonymous.
          wsLog.error('handshake rejected: client supplied serviceKey but TERMINAL_SERVICE_KEY env not configured on server');
          return next(new Error('service key auth not configured on server'));
        }
        if (result.kind === 'invalid') {
          return next(new Error('invalid service key'));
        }
        socket.data = { kind: 'service' };
        return next();
      }

      // JWT path (app user).
      if (auth.token) {
        try {
          const payload = verifyToken(auth.token);
          socket.data = { kind: 'app-user', user: payload };
          return next();
        } catch {
          return next(new Error('invalid token'));
        }
      }

      // Tidak kirim auth → anonymous (cuma boleh trip room).
      socket.data = { kind: 'anonymous' };
      next();
    });

    this.io.on('connection', (socket: Socket) => {
      log(`WebSocket client connected: ${socket.id} kind=${socket.data.kind}`, 'websocket');

      // S3-05 (post-review fix): track connected clients gauge supaya
      // Grafana panel #6 ada data. Decrement on disconnect.
      void import('../observability/metrics').then(m => m.incWsClient()).catch(() => {});
      socket.on('disconnect', () => {
        void import('../observability/metrics').then(m => m.decWsClient()).catch(() => {});
      });

      // S2-07 helper: kirim error ke klien tanpa disconnect.
      const denySubscribe = (roomName: string, reason: string) => {
        log(`Client ${socket.id} (${socket.data.kind}) DENIED subscribe to ${roomName}: ${reason}`, 'websocket');
        socket.emit('subscribe-error', { room: roomName, reason });
      };

      // Handle room subscriptions
      socket.on('subscribe-trip', (tripId: string) => {
        const roomName = `trip:${tripId}`;
        // Trip room (seatmap) bersifat publik untuk shopping — semua kind boleh.
        // Tetap validate input: tripId harus non-empty string.
        if (typeof tripId !== 'string' || !tripId) {
          return denySubscribe(roomName, 'invalid tripId');
        }
        socket.join(roomName);
        log(`Client ${socket.id} subscribed to ${roomName}`, 'websocket');
      });

      socket.on('unsubscribe-trip', (tripId: string) => {
        const roomName = `trip:${tripId}`;
        socket.leave(roomName);
        log(`Client ${socket.id} unsubscribed from ${roomName}`, 'websocket');
      });

      socket.on('subscribe-base', (baseId: string) => {
        const roomName = `base:${baseId}`;
        if (typeof baseId !== 'string' || !baseId) {
          return denySubscribe(roomName, 'invalid baseId');
        }
        // Base (operator) room — service-only. App-user / anonymous tidak boleh.
        // S2-07: di STRICT mode (production hardening) tolak. Di legacy mode
        // (default) hanya log warning supaya operator UI lama tidak break.
        if (socket.data.kind !== 'service') {
          if (strictWsAuth) {
            return denySubscribe(roomName, 'service auth required');
          }
          log(`[STRICT_WS_AUTH=warn] Client ${socket.id} (${socket.data.kind}) subscribed to ${roomName} without service auth`, 'websocket');
        }
        socket.join(roomName);
        log(`Client ${socket.id} subscribed to ${roomName}`, 'websocket');
      });

      socket.on('unsubscribe-base', (baseId: string) => {
        const roomName = `base:${baseId}`;
        socket.leave(roomName);
        log(`Client ${socket.id} unsubscribed from ${roomName}`, 'websocket');
      });

      socket.on('subscribe-cso', (outletId: string, serviceDate: string) => {
        const roomName = `cso:${outletId}:${serviceDate}`;
        if (typeof outletId !== 'string' || !outletId || typeof serviceDate !== 'string' || !serviceDate) {
          return denySubscribe(roomName, 'invalid outletId/serviceDate');
        }
        // CSO room (outlet ops dashboard) — service-only.
        if (socket.data.kind !== 'service') {
          if (strictWsAuth) {
            return denySubscribe(roomName, 'service auth required');
          }
          log(`[STRICT_WS_AUTH=warn] Client ${socket.id} (${socket.data.kind}) subscribed to ${roomName} without service auth`, 'websocket');
        }
        socket.join(roomName);
        log(`Client ${socket.id} subscribed to ${roomName}`, 'websocket');
      });

      socket.on('unsubscribe-cso', (outletId: string, serviceDate: string) => {
        const roomName = `cso:${outletId}:${serviceDate}`;
        socket.leave(roomName);
        log(`Client ${socket.id} unsubscribed from ${roomName}`, 'websocket');
      });

      socket.on('disconnect', (reason) => {
        log(`WebSocket client disconnected: ${socket.id}, reason: ${reason}`, 'websocket');
      });
    });

    log('WebSocket server initialized', 'websocket');
  }

  // Event emission helpers
  emitToTrip<T extends WSEventName>(tripId: string, event: T, data: WSEventData<T>) {
    if (!this.io) {
      log('WebSocket not initialized, cannot emit event', 'websocket');
      return;
    }
    
    const roomName = `trip:${tripId}`;
    this.io.to(roomName).emit(event, data);
    log(`Emitted ${event} to ${roomName}`, 'websocket');
  }

  emitToBase<T extends WSEventName>(baseId: string, event: T, data: WSEventData<T>) {
    if (!this.io) {
      log('WebSocket not initialized, cannot emit event', 'websocket');
      return;
    }
    
    const roomName = `base:${baseId}`;
    this.io.to(roomName).emit(event, data);
    log(`Emitted ${event} to ${roomName}`, 'websocket');
  }

  emitToCso<T extends WSEventName>(outletId: string, serviceDate: string, event: T, data: WSEventData<T>) {
    if (!this.io) {
      log('WebSocket not initialized, cannot emit event', 'websocket');
      return;
    }
    
    const roomName = `cso:${outletId}:${serviceDate}`;
    this.io.to(roomName).emit(event, data);
    log(`Emitted ${event} to ${roomName}`, 'websocket');
  }

  // Broadcast to all clients (use sparingly)
  broadcast<T extends WSEventName>(event: T, data: WSEventData<T>) {
    if (!this.io) {
      log('WebSocket not initialized, cannot broadcast event', 'websocket');
      return;
    }
    
    this.io.emit(event, data);
    log(`Broadcasted ${event} to all clients`, 'websocket');
  }

  // Helper to emit TRIP_STATUS_CHANGED and TRIP_CANCELED together
  emitTripStatusChanged(tripId: string, status: string, additionalRooms?: { baseId?: string; outletId?: string; serviceDate?: string }) {
    const data: WSEventData<'TRIP_STATUS_CHANGED'> = { tripId, status };
    
    // Always emit to trip room
    this.emitToTrip(tripId, 'TRIP_STATUS_CHANGED', data);
    
    // If status is canceled, also emit TRIP_CANCELED
    if (status === 'cancelled') {
      this.emitToTrip(tripId, 'TRIP_CANCELED', { tripId });
    }
    
    // Emit to additional rooms if provided
    if (additionalRooms?.baseId) {
      this.emitToBase(additionalRooms.baseId, 'TRIP_STATUS_CHANGED', data);
      if (status === 'cancelled') {
        this.emitToBase(additionalRooms.baseId, 'TRIP_CANCELED', { tripId });
      }
    }
    
    if (additionalRooms?.outletId && additionalRooms?.serviceDate) {
      this.emitToCso(additionalRooms.outletId, additionalRooms.serviceDate, 'TRIP_STATUS_CHANGED', data);
      if (status === 'cancelled') {
        this.emitToCso(additionalRooms.outletId, additionalRooms.serviceDate, 'TRIP_CANCELED', { tripId });
      }
    }
  }

  // Helper to emit HOLDS_RELEASED
  emitHoldsReleased(tripId: string, seatNos?: string[], additionalRooms?: { outletId?: string; serviceDate?: string }) {
    const data: WSEventData<'HOLDS_RELEASED'> = { tripId, seatNos };
    
    // Always emit to trip room
    this.emitToTrip(tripId, 'HOLDS_RELEASED', data);
    
    // Emit to additional rooms if provided
    if (additionalRooms?.outletId && additionalRooms?.serviceDate) {
      this.emitToCso(additionalRooms.outletId, additionalRooms.serviceDate, 'HOLDS_RELEASED', data);
    }
  }

  // Helper to emit TRIP_MATERIALIZED
  emitTripMaterialized(baseId: string, serviceDate: string, tripId: string, additionalRooms?: { outletId?: string }) {
    const data: WSEventData<'TRIP_MATERIALIZED'> = { baseId, serviceDate, tripId };
    
    // Always emit to base room
    this.emitToBase(baseId, 'TRIP_MATERIALIZED', data);
    
    // Emit to CSO rooms if provided
    if (additionalRooms?.outletId) {
      this.emitToCso(additionalRooms.outletId, serviceDate, 'TRIP_MATERIALIZED', data);
    }
  }

  // Helper to emit INVENTORY_UPDATED
  emitInventoryUpdated(tripId: string, seatNo: string, legIndexes?: number[], additionalRooms?: { outletId?: string; serviceDate?: string }) {
    const data: WSEventData<'INVENTORY_UPDATED'> = { tripId, seatNo, legIndexes };
    
    // Always emit to trip room
    this.emitToTrip(tripId, 'INVENTORY_UPDATED', data);
    
    // Emit to additional rooms if provided
    if (additionalRooms?.outletId && additionalRooms?.serviceDate) {
      this.emitToCso(additionalRooms.outletId, additionalRooms.serviceDate, 'INVENTORY_UPDATED', data);
    }
  }

  // Helper to emit PRICE_RULES_CHANGED. Price rules aren't naturally scoped
  // to a single trip/base/cso room (a pattern-level or global-fallback edit
  // can affect many trips across many outlets at once), and this only fires
  // on an explicit admin save/delete/sync — infrequent enough that a full
  // broadcast is the right tool rather than trying to fan out to every
  // affected room.
  emitPriceRulesChanged(data: WSEventData<'PRICE_RULES_CHANGED'> = {}) {
    this.broadcast('PRICE_RULES_CHANGED', data);
  }

  getConnectedClientsCount(): number {
    return this.io?.engine.clientsCount || 0;
  }

  getRoomClientsCount(roomName: string): number {
    return this.io?.sockets.adapter.rooms.get(roomName)?.size || 0;
  }
}

// Export singleton instance
export const webSocketService = new WebSocketService();

// Export helper functions for use in services
export const {
  emitToTrip,
  emitToBase,
  emitToCso,
  broadcast,
  emitTripStatusChanged,
  emitHoldsReleased,
  emitTripMaterialized,
  emitInventoryUpdated,
  emitPriceRulesChanged
} = webSocketService;