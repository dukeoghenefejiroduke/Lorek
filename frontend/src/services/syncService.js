import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';

const SYNC_QUEUE_KEY = '@lorek_offline_sync_queue';

export const syncService = {
  async queueAction(actionType, endpoint, payload) {
    try {
      const existingQueueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      const queue = existingQueueJson ? JSON.parse(existingQueueJson) : [];
      
      const item = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
        actionType,
        endpoint,
        payload,
        timestamp: Date.now()
      };

      queue.push(item);
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
      
      // Try syncing immediately if online
      const netInfo = await NetInfo.fetch();
      if (netInfo.isConnected) {
        await this.processQueue();
      }
    } catch (err) {
      console.error('Error queuing offline action:', err);
    }
  },

  async processQueue() {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) return;

      const existingQueueJson = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (!existingQueueJson) return;

      const queue = JSON.parse(existingQueueJson);
      if (queue.length === 0) return;

      const remainingQueue = [];

      for (const item of queue) {
        try {
          // Last-write-wins strategy: execute pending API call
          await axios.post(item.endpoint, item.payload);
        } catch (err) {
          console.error(`Failed to sync action ${item.actionType}:`, err);
          remainingQueue.push(item); // Keep in queue for retry
        }
      }

      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(remainingQueue));
    } catch (err) {
      console.error('Error processing sync queue:', err);
    }
  }
};

export const addToSyncQueue = async (actionType, endpoint, payload) => {
  return syncService.queueAction(actionType, endpoint, payload);
};

export const processSyncQueue = async () => {
  return syncService.processQueue();
};

export default syncService;
