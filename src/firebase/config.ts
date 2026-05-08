// Firebase configuration using React Native Firebase
// React Native Firebase automatically initializes with native configuration
// via google-services.json (Android) and GoogleService-Info.plist (iOS)

import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// Lazy-initialized firestore instance to avoid module-level errors
let _db: firestore.Firestore | null = null;
let _auth: auth.Auth | null = null;

/**
 * Get the Firestore database instance using React Native Firebase
 * Initializes on first call rather than at module load time
 */
export const getDb = () => {
  if (!_db) {
    try {
      _db = firestore();
      console.log('✅ Firestore initialized with React Native Firebase');
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
      throw error;
    }
  }
  return _db;
};

/**
 * Get the Auth instance using React Native Firebase
 */
export const getAuth = () => {
  if (!_auth) {
    try {
      _auth = auth();
      console.log('✅ Auth initialized with React Native Firebase');
    } catch (error) {
      console.error('Failed to initialize Auth:', error);
      throw error;
    }
  }
  return _auth;
};

// Note: React Native Firebase handles offline persistence automatically
