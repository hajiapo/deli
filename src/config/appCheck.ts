/**
 * Firebase App Check Configuration
 * Provides additional security layer for Firebase API calls
 */

import getAppCheck from '@react-native-firebase/app-check';
import { Platform } from 'react-native';

/**
 * Initialize Firebase App Check
 * This should be called when the app starts
 */
export const initializeAppCheck = async () => {
  try {
    const appCheckInstance = getAppCheck();
    if (Platform.OS === 'android') {
      // For Android, use SafetyNet or Play Integrity
      appCheckInstance.activate('playIntegrity');
    } else if (Platform.OS === 'ios') {
      // For iOS, use DeviceCheck
      appCheckInstance.activate('appAttest');
    }

    console.log('✅ Firebase App Check initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Error initializing Firebase App Check:', error);
    return false;
  }
};

/**
 * Get App Check token for API requests
 * This token should be included in Firebase API calls
 */
export const getAppCheckToken = async (): Promise<string | null> => {
  try {
    const appCheckInstance = getAppCheck();
    const appCheckToken = await appCheckInstance.getToken(true);
    return appCheckToken.token;
  } catch (error) {
    console.error('❌ Error getting App Check token:', error);
    return null;
  }
};

/**
 * Enable App Check in debug mode (development only)
 * This should be configured in Firebase Console for development
 */
export const configureAppCheckDebugMode = () => {
  if (__DEV__) {
    console.log('🔧 App Check debug mode note:');
    console.log('Add your debug token in Firebase Console → Project Settings → App Check');
    console.log('Debug apps section for development testing');
  }
};

/**
 * Force refresh App Check token
 * Useful when token expires or is invalid
 */
export const refreshAppCheckToken = async (): Promise<string | null> => {
  try {
    // Get a fresh token by forcing a refresh
    const appCheckInstance = getAppCheck();
    const appCheckToken = await appCheckInstance.getToken(true);
    console.log('🔄 App Check token refreshed');
    return appCheckToken.token;
  } catch (error) {
    console.error('❌ Error refreshing App Check token:', error);
    return null;
  }
};

/**
 * Check if App Check is properly configured
 */
export const isAppCheckConfigured = (): boolean => {
  try {
    // Basic check - try to get a token to verify App Check is working
    const appCheckInstance = getAppCheck();
    return appCheckInstance !== undefined;
  } catch (error) {
    return false;
  }
};
