import React, { createContext, useContext, useState, useCallback } from 'react';

const SocketContext = createContext(null);
export const DataContext = createContext(null);

export function SocketProvider({ children }) {
  // Populated by real AI scans — there is no seed data.
  const [alerts, setAlerts] = useState([]);

  const acknowledgeAlert = useCallback((alertId) => {
    setAlerts(prev => prev.map(a => a.alertId === alertId ? { ...a, acknowledged: true } : a));
  }, []);

  const dataValue = {
    kpis:             {},
    alerts,
    advisories:       [],
    lastUpdate:       new Date(),
    connected:        false,
    requestData:      () => {},
    acknowledgeAlert,
  };

  return (
    <SocketContext.Provider value={null}>
      <DataContext.Provider value={dataValue}>
        {children}
      </DataContext.Provider>
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
export const useData   = () => useContext(DataContext);
