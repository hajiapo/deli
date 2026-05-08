// Firebase configuration using React Native Firebase
// React Native Firebase automatically initializes with native configuration
// via google-services.json (Android) and GoogleService-Info.plist (iOS)

import { getApp } from '@react-native-firebase/app';
import { getFirestore } from '@react-native-firebase/firestore';
import { getAuth as getFirebaseAuth } from '@react-native-firebase/auth';
import type { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';

// Lazy-initialized firestore instance to avoid module-level errors
let _db: FirebaseFirestoreTypes.Module | null = null;
let _auth: FirebaseAuthTypes.Module | null = null;
let _app: any = null;

/**
 * Get the Firebase app instance
 */
const getAppInstance = () => {
  if (!_app) {
    _app = getApp();
  }
  return _app;
};

/**
 * Get the Firestore database instance using React Native Firebase v22 modular API
 * Initializes on first call rather than at module load time
 */
export const getDb = () => {
  if (!_db) {
    try {
      const app = getAppInstance();
      _db = getFirestore(app);
      console.log('✅ Firestore initialized with React Native Firebase v22');
    } catch (error) {
      console.error('Failed to initialize Firestore:', error);
      throw error;
    }
  }
  return _db;
};

/**
 * Get the Auth instance using React Native Firebase v22 modular API
 */
export const getAuth = () => {
  if (!_auth) {
    try {
      const app = getAppInstance();
      _auth = getFirebaseAuth(app);
      console.log('✅ Auth initialized with React Native Firebase v22');
    } catch (error) {
      console.error('Failed to initialize Auth:', error);
      throw error;
    }
  }
  return _auth;
};

// Note: React Native Firebase handles offline persistence automatically
