/**
 * Transport Context
 *
 * Provides transport instance to React components via context.
 * This allows components to access the WebSocket transport easily.
 */

import React, { createContext, useContext, useMemo } from "react";
import type { Transport } from "./types";
import { getTransport } from "./index";

const TransportContext = createContext<Transport | null>(null);

interface TransportProviderProps {
  children: React.ReactNode;
  transport?: Transport;
}

/**
 * Provider component that makes transport available to all children
 */
export function TransportProvider({
  children,
  transport,
}: TransportProviderProps) {
  const value = useMemo(() => transport ?? getTransport(), [transport]);

  return (
    <TransportContext.Provider value={value}>
      {children}
    </TransportContext.Provider>
  );
}

/**
 * Hook to access transport from components
 */
export function useTransport(): Transport | null {
  return useContext(TransportContext);
}

/**
 * Hook to access transport with error if not available
 */
export function useRequiredTransport(): Transport {
  const transport = useContext(TransportContext);
  if (!transport) {
    throw new Error("useRequiredTransport must be used within TransportProvider");
  }
  return transport;
}
