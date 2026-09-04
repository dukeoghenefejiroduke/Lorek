import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { processSyncQueue } from '../services/syncService';

export const useNetworkSync = () => {
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            if (state.isConnected) {
                processSyncQueue().catch(err => console.error('Sync failed', err));
            }
        });
        return unsubscribe;
    }, []);
};
