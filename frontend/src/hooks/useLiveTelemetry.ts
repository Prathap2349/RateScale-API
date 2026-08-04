import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveTelemetryData } from '../types';

export type TelemetryConnectionStatus = 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING';

interface UseLiveTelemetryReturn {
  telemetry: LiveTelemetryData | null;
  status: TelemetryConnectionStatus;
  reconnect: () => void;
  disconnect: () => void;
}

export const useLiveTelemetry = (
  wsUrl: string = 'ws://localhost:8080/api/telemetry/ws'
): UseLiveTelemetryReturn => {
  const [telemetry, setTelemetry] = useState<LiveTelemetryData | null>(null);
  const [status, setStatus] = useState<TelemetryConnectionStatus>('DISCONNECTED');
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const attemptRef = useRef<number>(0);

  const connect = useCallback(() => {
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    setStatus(attemptRef.current > 0 ? 'RECONNECTING' : 'CONNECTING');

    try {
      const socket = new WebSocket(wsUrl);
      socketRef.current = socket;

      socket.onopen = () => {
        setStatus('CONNECTED');
        attemptRef.current = 0;
      };

      socket.onmessage = (event) => {
        try {
          const data: LiveTelemetryData = JSON.parse(event.data);
          setTelemetry(data);
        } catch {
          // Parse error handling
        }
      };

      socket.onerror = () => {
        // Handle error without injecting dummy data
      };

      socket.onclose = () => {
        setStatus('DISCONNECTED');
        socketRef.current = null;

        // Auto reconnect attempt after delay up to max attempts
        if (attemptRef.current < 5) {
          attemptRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, attemptRef.current), 10000);
          reconnectTimeoutRef.current = window.setTimeout(() => {
            connect();
          }, delay);
        }
      };
    } catch {
      setStatus('DISCONNECTED');
    }
  }, [wsUrl]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    attemptRef.current = 5; // prevent auto reconnect
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    setStatus('DISCONNECTED');
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    attemptRef.current = 0;
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { telemetry, status, reconnect, disconnect };
};
