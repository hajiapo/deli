/**
 * Firebase Authentication utilities for admin and driver authentication
 * Handles Firebase Auth custom claims and user management
 */

import { getAuth, getDb } from '../firebase/config';
import { doc, getDoc, getFirestore as getFirebaseFirestore, serverTimestamp } from '@react-native-firebase/firestore';

export interface UserClaims {
  admin?: boolean;
  driver?: boolean;
  driverId?: string;
}

/**
 * Initialize Firebase Authentication and set up auth state listener
 */
export const initializeAuth = () => {
  const auth = getAuth();
  return auth.onAuthStateChanged(async (user) => {
    if (user) {
      console.log('User authenticated:', user.uid);
      // Refresh custom claims when user signs in
      await user.getIdTokenResult(true);
    } else {
      console.log('User signed out');
    }
  });
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (email: string, password: string) => {
  try {
    const auth = getAuth();
    const userCredential = await auth.signInWithEmailAndPassword(email, password);
    return userCredential.user;
  } catch (error) {
    console.error('Sign in error:', error);
    throw error;
  }
};

/**
 * Sign out current user
 * Gracefully handles case where no user is signed in
 * Uses React Native Firebase
 */
export const signOut = async () => {
  try {
    const auth = getAuth();
    
    // Check if there's a current user before trying to sign out
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('ℹ️ No Firebase user to sign out - skipping');
      return;
    }
    
    // Try to sign out
    await auth.signOut();
    console.log('✅ Firebase sign out successful');
  } catch (error: any) {
    // Don't throw error for "no current user" - it's not an error condition
    if (error?.code === 'auth/no-current-user') {
      console.log('ℹ️ No Firebase user to sign out');
      return;
    }
    
    console.error('Sign out error:', error);
    // Don't throw the error - logout should still work even if Firebase sign out fails
    console.log('⚠️ Firebase sign out failed, but logout continues');
  }
};

/**
 * Get current authenticated user
 */
export const getCurrentUser = () => {
  try {
    const auth = getAuth();
    return auth.currentUser;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

/**
 * Get user's custom claims (roles)
 */
export const getUserClaims = async (): Promise<UserClaims | null> => {
  try {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      return null;
    }

    const idTokenResult = await user.getIdTokenResult(true);
    return {
      admin: idTokenResult.claims.admin as boolean,
      driver: idTokenResult.claims.driver as boolean,
      driverId: idTokenResult.claims.driverId as string,
    };
  } catch (error) {
    console.error('Error getting user claims:', error);
    return null;
  }
};

/**
 * Check if current user is admin
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  const claims = await getUserClaims();
  return claims?.admin || false;
};

/**
 * Check if current user is driver
 */
export const isCurrentUserDriver = async (): Promise<boolean> => {
  const claims = await getUserClaims();
  return claims?.driver || false;
};

/**
 * Get current user's driver ID (if they are a driver)
 */
export const getCurrentDriverId = async (): Promise<string | null> => {
  const claims = await getUserClaims();
  return claims?.driverId || null;
};

/**
 * Create admin user in Firebase Auth (for initial setup)
 * This should only be called once during initial setup
 */
export const createAdminUser = async (email: string, password: string) => {
  try {
    // Create user in Firebase Auth
    const auth = getAuth();
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Set custom claims for admin
    await setAdminClaims(user.uid);

    // Store admin info in Firestore
    const db = getDb();
    await db.collection('admin_users').doc(user.uid).set({
      email: email,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    console.log('Admin user created successfully:', user.uid);
    return user;
  } catch (error) {
    console.error('Error creating admin user:', error);
    throw error;
  }
};

/**
 * Create driver user in Firebase Auth
 */
export const createDriverUser = async (email: string, password: string, driverId: string) => {
  try {
    // Create user in Firebase Auth
    const auth = getAuth();
    const userCredential = await auth.createUserWithEmailAndPassword(email, password);
    const user = userCredential.user;

    // Set custom claims for driver
    await setDriverClaims(user.uid, driverId);

    // Store driver auth info in Firestore
    const db = getDb();
    await db.collection('driver_auth').doc(user.uid).set({
      driverId: driverId,
      email: email,
      createdAt: serverTimestamp(),
      isActive: true,
    });

    console.log('Driver user created successfully:', user.uid);
    return user;
  } catch (error) {
    console.error('Error creating driver user:', error);
    throw error;
  }
};

/**
 * Set admin custom claims for a user
 */
export const setAdminClaims = async (uid: string) => {
  try {
    // This would typically be done via a Cloud Function
    // For now, we'll store the claim in Firestore and check it manually
    const db = getDb();
    await db.collection('user_claims').doc(uid).set({
      admin: true,
      driver: false,
      driverId: null,
      updatedAt: serverTimestamp(),
    });

    console.log('Admin claims set for user:', uid);
  } catch (error) {
    console.error('Error setting admin claims:', error);
    throw error;
  }
};

/**
 * Set driver custom claims for a user
 */
export const setDriverClaims = async (uid: string, driverId: string) => {
  try {
    // This would typically be done via a Cloud Function
    // For now, we'll store the claim in Firestore and check it manually
    const db = getDb();
    await db.collection('user_claims').doc(uid).set({
      admin: false,
      driver: true,
      driverId: driverId,
      updatedAt: serverTimestamp(),
    });

    console.log('Driver claims set for user:', uid);
  } catch (error) {
    console.error('Error setting driver claims:', error);
    throw error;
  }
};

/**
 * Get user claims from Firestore (fallback for custom claims)
 */
export const getUserClaimsFromFirestore = async (uid: string): Promise<UserClaims | null> => {
  try {
    const { default: app } = require('@react-native-firebase/app');
    const db = getFirebaseFirestore(app);
    const docRef = doc(db, 'user_claims', uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return docSnap.data() as UserClaims;
    }
    return null;
  } catch (error) {
    console.error('Error getting user claims from Firestore:', error);
    return null;
  }
};

/**
 * Update user claims in Firestore
 */
export const updateUserClaims = async (uid: string, claims: Partial<UserClaims>) => {
  try {
    const db = getDb();
    await db.collection('user_claims').doc(uid).update({
      ...claims,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error updating user claims:', error);
    throw error;
  }
};

/**
 * Delete user claims when user is deleted
 */
export const deleteUserClaims = async (uid: string) => {
  try {
    const db = getDb();
    await db.collection('user_claims').doc(uid).delete();
    console.log('User claims deleted for:', uid);
  } catch (error) {
    console.error('Error deleting user claims:', error);
    throw error;
  }
};
