import { useState, useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): boolean {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? true);
    });
    NetInfo.fetch().then(state => setIsOnline(state.isConnected ?? true));
    return () => unsub();
  }, []);
  return isOnline;
}

export async function checkOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected ?? true;
}
