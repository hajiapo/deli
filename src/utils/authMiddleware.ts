/**
 * Authentication middleware for Firestore operations
 * Provides user context and permission checking for database operations
 */

import { getUserClaims, isCurrentUserAdmin, isCurrentUserDriver, getCurrentDriverId } from './firebaseAuth';

export interface AuthContext {
  uid: string;
  isAdmin: boolean;
  isDriver: boolean;
  driverId?: string;
}

/**
 * Get current authentication context
 */
export const getAuthContext = async (): Promise<AuthContext | null> => {
  try {
    const claims = await getUserClaims();
    if (!claims) {
      return null;
    }

    return {
      uid: claims.driverId || 'unknown', // This should come from Firebase Auth user.uid
      isAdmin: claims.admin || false,
      isDriver: claims.driver || false,
      driverId: claims.driverId || undefined,
    };
  } catch (error) {
    console.error('Error getting auth context:', error);
    return null;
  }
};

/**
 * Check if user can read a specific package
 */
export const canReadPackage = async (packageData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can read all packages
    }

    const driverId = await getCurrentDriverId();
    if (driverId && packageData.assigned_to === driverId) {
      return true; // Drivers can read their own assigned packages
    }

    return false;
  } catch (error) {
    console.error('Error checking package read permission:', error);
    return false;
  }
};

/**
 * Check if user can update a package
 */
export const canUpdatePackage = async (packageData: any, updateData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can update any package
    }

    const driverId = await getCurrentDriverId();
    if (driverId && packageData.assigned_to === driverId) {
      // Check if driver is only updating allowed fields
      const allowedFields = ['status', 'delivered_at', 'accepted_at', 'return_reason', '_lastModified', '_version'];
      const updateKeys = Object.keys(updateData);
      
      const isAllowedUpdate = updateKeys.every(key => allowedFields.includes(key));
      if (isAllowedUpdate) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking package update permission:', error);
    return false;
  }
};

/**
 * Check if user can create a package
 */
export const canCreatePackage = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking package create permission:', error);
    return false;
  }
};

/**
 * Check if user can delete a package
 */
export const canDeletePackage = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking package delete permission:', error);
    return false;
  }
};

/**
 * Check if user can read driver information
 */
export const canReadDriver = async (driverData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can read all drivers
    }

    const driverId = await getCurrentDriverId();
    if (driverId === driverData.id) {
      return true; // Drivers can read their own profile
    }

    // Drivers can read other active drivers for visibility
    if (driverData.is_active === true) {
      return true;
    }

    return false;
  } catch (error) {
    console.error('Error checking driver read permission:', error);
    return false;
  }
};

/**
 * Check if user can update driver information
 */
export const canUpdateDriver = async (driverData: any, updateData: any): Promise<boolean> => {
  try {
    const isAdminUser = await isCurrentUserAdmin();
    if (isAdminUser) {
      return true; // Admins can update any driver
    }

    const driverId = await getCurrentDriverId();
    if (driverId === driverData.id) {
      // Check if driver is only updating allowed fields
      const allowedFields = ['phone', 'vehicle_type', 'is_active'];
      const updateKeys = Object.keys(updateData);
      
      const isAllowedUpdate = updateKeys.every(key => allowedFields.includes(key));
      return isAllowedUpdate;
    }

    return false;
  } catch (error) {
    console.error('Error checking driver update permission:', error);
    return false;
  }
};

/**
 * Check if user can create driver
 */
export const canCreateDriver = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking driver create permission:', error);
    return false;
  }
};

/**
 * Check if user can delete driver
 */
export const canDeleteDriver = async (): Promise<boolean> => {
  try {
    return await isCurrentUserAdmin();
  } catch (error) {
    console.error('Error checking driver delete permission:', error);
    return false;
  }
};

/**
 * Wrapper for Firestore operations with permission checking
 */
export class SecureFirestore {
  /**
   * Read a document with permission check
   */
  static async getDocument(collection: string, docId: string): Promise<any> {
    const { getFirestore, collection: firestoreCollection, doc, getDoc } = require('firebase/firestore');
    
    // Get the Firebase app from React Native Firebase
    const { default: app } = require('@react-native-firebase/app');
    const db = getFirestore(app);
    const docRef = doc(db, collection, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }

    const data = docSnap.data();
    
    // Check read permissions based on collection
    if (collection === 'packages') {
      const canRead = await canReadPackage(data);
      if (!canRead) {
        throw new Error('Permission denied: Cannot read this package');
      }
    } else if (collection === 'drivers') {
      const canRead = await canReadDriver(data);
      if (!canRead) {
        throw new Error('Permission denied: Cannot read this driver');
      }
    }

    return { id: docSnap.id, ...data };
  }

  /**
   * Create a document with permission check
   */
  static async createDocument(collection: string, data: any): Promise<any> {
    let canCreate = false;

    if (collection === 'packages') {
      canCreate = await canCreatePackage();
    } else if (collection === 'drivers') {
      canCreate = await canCreateDriver();
    }

    if (!canCreate) {
      throw new Error(`Permission denied: Cannot create document in ${collection}`);
    }

    const { getFirestore, collection: firestoreCollection, addDoc } = require('firebase/firestore');
    
    // Get the Firebase app from React Native Firebase
    const { default: app } = require('@react-native-firebase/app');
    const db = getFirestore(app);
    const docRef = await addDoc(firestoreCollection(db, collection), data);
    return { id: docRef.id, ...data };
  }

  /**
   * Update a document with permission check
   */
  static async updateDocument(collection: string, docId: string, updateData: any): Promise<any> {
    const { getFirestore, collection: firestoreCollection, doc, getDoc, updateDoc } = require('firebase/firestore');
    
    // Get the Firebase app from React Native Firebase
    const { default: app } = require('@react-native-firebase/app');
    const db = getFirestore(app);
    const docRef = doc(db, collection, docId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      throw new Error('Document not found');
    }

    const existingData = docSnap.data();
    
    // Check update permissions based on collection
    if (collection === 'packages') {
      const canUpdate = await canUpdatePackage(existingData, updateData);
      if (!canUpdate) {
        throw new Error('Permission denied: Cannot update this package');
      }
    } else if (collection === 'drivers') {
      const canUpdate = await canUpdateDriver(existingData, updateData);
      if (!canUpdate) {
        throw new Error('Permission denied: Cannot update this driver');
      }
    }

    await updateDoc(docRef, updateData);
    return { id: docId, ...existingData, ...updateData };
  }

  /**
   * Delete a document with permission check
   */
  static async deleteDocument(collection: string, docId: string): Promise<void> {
    let canDelete = false;

    if (collection === 'packages') {
      canDelete = await canDeletePackage();
    } else if (collection === 'drivers') {
      canDelete = await canDeleteDriver();
    }

    if (!canDelete) {
      throw new Error(`Permission denied: Cannot delete document in ${collection}`);
    }

    const { getFirestore, collection: firestoreCollection, doc, deleteDoc } = require('firebase/firestore');
    
    // Get the Firebase app from React Native Firebase
    const { default: app } = require('@react-native-firebase/app');
    const db = getFirestore(app);
    const docRef = doc(db, collection, docId);
    await deleteDoc(docRef);
  }
}
