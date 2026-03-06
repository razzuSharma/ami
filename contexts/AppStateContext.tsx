import React, { createContext, useContext, useRef, useState } from "react";

type BusyMap = Record<string, boolean>;

type AppStateContextType = {
  busyActions: BusyMap;
  notificationsInitialized: boolean;
  setNotificationsInitialized: (value: boolean) => void;
  acquireActionLock: (actionKey: string) => boolean;
  releaseActionLock: (actionKey: string) => void;
};

const AppStateContext = createContext<AppStateContextType | undefined>(undefined);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const locksRef = useRef(new Set<string>());
  const [busyActions, setBusyActions] = useState<BusyMap>({});
  const [notificationsInitialized, setNotificationsInitialized] = useState(false);

  const acquireActionLock = (actionKey: string) => {
    if (locksRef.current.has(actionKey)) return false;
    locksRef.current.add(actionKey);
    setBusyActions((prev) => ({ ...prev, [actionKey]: true }));
    return true;
  };

  const releaseActionLock = (actionKey: string) => {
    if (!locksRef.current.has(actionKey)) return;
    locksRef.current.delete(actionKey);
    setBusyActions((prev) => ({ ...prev, [actionKey]: false }));
  };

  const value = {
    busyActions,
    notificationsInitialized,
    setNotificationsInitialized,
    acquireActionLock,
    releaseActionLock,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
