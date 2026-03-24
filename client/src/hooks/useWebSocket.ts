import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

// WebSocket event types (matching server)
export interface WSEvents {
  TRIP_STATUS_CHANGED: { tripId: string; status: string };
  TRIP_CANCELED: { tripId: string };
  HOLDS_RELEASED: { tripId: string; seatNos?: string[] };
  TRIP_MATERIALIZED: { baseId: string; serviceDate: string; tripId: string };
  INVENTORY_UPDATED: { tripId: string; seatNo: string; legIndexes?: number[] };
  STOP_EXCEPTION_CHANGED: { baseId: string; serviceDate: string; stopId: string };
}

export type WSEventName = keyof WSEvents;
export type WSEventData<T extends WSEventName> = WSEvents[T];
export type WSEventHandler<T extends WSEventName> = (data: WSEventData<T>) => void;

interface UseWebSocketOptions {
  autoConnect?: boolean;
  reconnectionDelay?: number;
  maxReconnectionAttempts?: number;
}

export const useWebSocket = (options: UseWebSocketOptions = {}) => {
  const {
    autoConnect = true,
    reconnectionDelay = 5000,
    maxReconnectionAttempts = 5
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionAttempt, setReconnectionAttempt] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  const eventHandlersRef = useRef<Map<WSEventName, Set<Function>>>(new Map());
  const subscriptionsRef = useRef<Set<string>>(new Set());

  // Initialize WebSocket connection
  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      return;
    }

    const socket = io({
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      reconnection: false // We handle reconnection manually
    });

    socket.on('connect', () => {
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectionAttempt(0);
      
      // Re-subscribe to all previous subscriptions
      for (const subscription of Array.from(subscriptionsRef.current)) {
        const [type, ...params] = subscription.split(':');
        switch (type) {
          case 'trip':
            socket.emit('subscribe-trip', params[0]);
            break;
          case 'base':
            socket.emit('subscribe-base', params[0]);
            break;
          case 'cso':
            socket.emit('subscribe-cso', params[0], params[1]);
            break;
        }
      }
    });

    socket.on('disconnect', (reason: string) => {
      setIsConnected(false);
      
      // Attempt reconnection for network/transport errors and ping timeouts
      if (reason === 'transport error' || reason === 'transport close' || reason === 'ping timeout') {
        handleReconnection();
      }
    });

    socket.on('connect_error', (error: Error) => {
      console.error('[WebSocket] Connection error:', error);
      setIsConnected(false);
      handleReconnection();
    });

    // Set up event listeners for all WebSocket events
    const eventNames: WSEventName[] = [
      'TRIP_STATUS_CHANGED',
      'TRIP_CANCELED', 
      'HOLDS_RELEASED',
      'TRIP_MATERIALIZED',
      'INVENTORY_UPDATED'
    ];

    eventNames.forEach(eventName => {
      socket.on(eventName, (data: WSEventData<typeof eventName>) => {
        const handlers = eventHandlersRef.current.get(eventName);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(data);
            } catch (error) {
              console.error(`[WebSocket] Error in ${eventName} handler:`, error);
            }
          });
        }
      });
    });

    socketRef.current = socket;
  }, []);

  // Handle reconnection attempts
  const handleReconnection = useCallback(() => {
    if (reconnectionAttempt >= maxReconnectionAttempts) {
      return;
    }

    setIsReconnecting(true);
    setReconnectionAttempt(prev => prev + 1);

    setTimeout(() => {
      connect();
    }, reconnectionDelay);
  }, [reconnectionAttempt, maxReconnectionAttempts, reconnectionDelay, connect]);

  // Disconnect from server
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectionAttempt(0);
  }, []);

  // Subscribe to trip updates
  const subscribeToTrip = useCallback((tripId: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `trip:${tripId}`;
    subscriptionsRef.current.add(subscriptionKey);
    socketRef.current.emit('subscribe-trip', tripId);
  }, []);

  // Unsubscribe from trip updates
  const unsubscribeFromTrip = useCallback((tripId: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `trip:${tripId}`;
    subscriptionsRef.current.delete(subscriptionKey);
    socketRef.current.emit('unsubscribe-trip', tripId);
  }, []);

  // Subscribe to base updates
  const subscribeToBase = useCallback((baseId: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `base:${baseId}`;
    subscriptionsRef.current.add(subscriptionKey);
    socketRef.current.emit('subscribe-base', baseId);
  }, []);

  // Unsubscribe from base updates
  const unsubscribeFromBase = useCallback((baseId: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `base:${baseId}`;
    subscriptionsRef.current.delete(subscriptionKey);
    socketRef.current.emit('unsubscribe-base', baseId);
  }, []);

  // Subscribe to CSO outlet/date updates
  const subscribeToCso = useCallback((outletId: string, serviceDate: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `cso:${outletId}:${serviceDate}`;
    subscriptionsRef.current.add(subscriptionKey);
    socketRef.current.emit('subscribe-cso', outletId, serviceDate);
  }, []);

  // Unsubscribe from CSO updates
  const unsubscribeFromCso = useCallback((outletId: string, serviceDate: string) => {
    if (!socketRef.current) return;
    
    const subscriptionKey = `cso:${outletId}:${serviceDate}`;
    subscriptionsRef.current.delete(subscriptionKey);
    socketRef.current.emit('unsubscribe-cso', outletId, serviceDate);
  }, []);

  // Add event handler
  const addEventListener = useCallback(<T extends WSEventName>(
    eventName: T,
    handler: WSEventHandler<T>
  ) => {
    if (!eventHandlersRef.current.has(eventName)) {
      eventHandlersRef.current.set(eventName, new Set());
    }
    eventHandlersRef.current.get(eventName)!.add(handler);
    
    return () => {
      const handlers = eventHandlersRef.current.get(eventName);
      if (handlers) {
        handlers.delete(handler);
      }
    };
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    isConnected,
    isReconnecting,
    reconnectionAttempt,
    connect,
    disconnect,
    subscribeToTrip,
    unsubscribeFromTrip,
    subscribeToBase,
    unsubscribeFromBase,
    subscribeToCso,
    unsubscribeFromCso,
    addEventListener
  };
};