import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
// Save data

save: async (key, value) => {

try {

const jsonValue = JSON.stringify(value);

await AsyncStorage.setItem(key, jsonValue);

return true;

} catch (error) {

console.error('Storage save error:', error);

return false;

}

},

// Get data

get: async (key) => {

try {

const jsonValue = await AsyncStorage.getItem(key);

return jsonValue != null ? JSON.parse(jsonValue) : null;

} catch (error) {

console.error('Storage get error:', error);

return null;

}

},

// Remove data

remove: async (key) => {

try {

await AsyncStorage.removeItem(key);

return true;

} catch (error) {

console.error('Storage remove error:', error);

return false;

}

},

// Clear all data

clear: async () => {

try {

await AsyncStorage.clear();

return true;

} catch (error) {

console.error('Storage clear error:', error);

return false;

}

},

};

