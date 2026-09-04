import db from './db';
import axios from 'axios';
import * as Crypto from 'expo-crypto';

export const addToSyncQueue = async (method, url, payload) => {
    const eventId = Crypto.randomUUID();
    const clientVersion = '1.0.4'; // Or fetch dynamically
    
    const idempotentPayload = { ...payload, clientEventId: eventId };

    await db.runAsync(
        'INSERT INTO sync_queue (client_event_id, method, url, payload, client_version, occurred_at) VALUES (?, ?, ?, ?, ?, ?)',
        [eventId, method, url, JSON.stringify(idempotentPayload), clientVersion, new Date().toISOString()]
    );
};

export const processSyncQueue = async () => {
    // Only fetch items not yet synced
    const queue = await db.getAllAsync('SELECT * FROM sync_queue WHERE synced = 0 ORDER BY timestamp ASC');
    
    for (const item of queue) {
        try {
            await axios({
                method: item.method,
                url: item.url,
                data: JSON.parse(item.payload),
            });
            
            // Mark as synced
            await db.runAsync('UPDATE sync_queue SET synced = 1 WHERE id = ?', [item.id]);
            
            // Optional: Periodically clean up fully synced items
            await db.runAsync('DELETE FROM sync_queue WHERE synced = 1');
            
        } catch (error) {
            console.error('Failed to sync item', item, error);
            
            // Increment retry count
            await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [item.id]);
            
            // Break to avoid hammering the server if it's down
            break; 
        }
    }
};
