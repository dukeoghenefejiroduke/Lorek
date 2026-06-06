import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';

export const impactLight = () => {
  if (!isWeb) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
};

export const impactMedium = () => {
  if (!isWeb) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }
};

export const impactHeavy = () => {
  if (!isWeb) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }
};

export const notificationSuccess = () => {
  if (!isWeb) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }
};

export const notificationWarning = () => {
  if (!isWeb) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
};

export const notificationError = () => {
  if (!isWeb) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }
};

export const selection = () => {
  if (!isWeb) {
    Haptics.selectionAsync();
  }
};

export default {
  impactLight,
  impactMedium,
  impactHeavy,
  notificationSuccess,
  notificationWarning,
  notificationError,
  selection,
};
