jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({ isConnected: true })),
  addEventListener: jest.fn(() => jest.fn()),
}));

import { syncService, processSyncQueue, addToSyncQueue } from '../src/services/syncService';

describe('SyncService & Queue functions', () => {
  it('should export processSyncQueue and addToSyncQueue as functions', () => {
    expect(typeof processSyncQueue).toBe('function');
    expect(typeof addToSyncQueue).toBe('function');
    expect(typeof syncService.processQueue).toBe('function');
    expect(typeof syncService.queueAction).toBe('function');
  });
});
