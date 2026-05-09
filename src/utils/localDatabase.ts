/**
 * Local Database Utility - Complete Smart Sync
 * Uses encrypted storage for sensitive data, regular AsyncStorage for non-sensitive data
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver, SyncOperation } from '../types';
import { isPreStoredDriverId } from '../config/credentials';

// Storage Keys
const PACKAGES_KEY = '@delivry:packages';
const DRIVERS_KEY = '@delivry:drivers';
const SYNC_QUEUE_KEY = '@delivry:syncQueue';
const LAST_SYNC_KEY = '@delivry:lastSync';



// Basic package retrieval (overridden below with driver filtering)

export const getDriversLocally = async (): Promise<Driver[]> => {
  try {
    const data = await AsyncStorage.getItem(DRIVERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const storeDriverLocally = async (driver: Driver): Promise<void> => {
  try {
    const drivers = await getDriversLocally();
    
    // Check if driver already exists
    const existingIndex = drivers.findIndex(d => d.id === driver.id);
    
    if (existingIndex >= 0) {
      // Update existing driver
      drivers[existingIndex] = {
        ...drivers[existingIndex],
        ...driver,
        _lastModified: new Date().toISOString()
      };
    } else {
      // Add new driver
      drivers.push({
        ...driver,
        _lastModified: new Date().toISOString(),
        _version: '1.0'
      });
    }
    
    await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(drivers));
    console.log(`💾 Driver ${driver.id} stored locally`);
  } catch (error) {
    console.error('Error storing driver locally:', error);
    throw error;
  }
};

export const removeDriverLocally = async (driverId: string): Promise<void> => {
  try {
    const drivers = await getDriversLocally();
    const filteredDrivers = drivers.filter(d => d.id !== driverId);
    await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(filteredDrivers));
    console.log(`🗑️ Driver ${driverId} removed from local storage`);
  } catch (error) {
    console.error('Error removing driver locally:', error);
    throw error;
  }
};

export const syncPackagesFromFirestore = async (driverId?: string, isAdmin = false): Promise<void> => {
  try {
    console.log(`🔄 Starting Firebase sync: driverId=${driverId}, isAdmin=${isAdmin}`);
    
    // Check if we have Firebase Authentication
    // Note: Pre-stored drivers (DRV-001 to DRV-020) work without Firebase Auth
    // Skip Firebase sync for pre-stored drivers to avoid permission errors
    const isPreStored = driverId ? isPreStoredDriverId(driverId) : false;
    
    if (isPreStored) {
      console.log('🔒 Skipping Firebase sync for pre-stored driver ID:', driverId);
      return;
    }
    
    // For ADMIN or non-pre-stored drivers, try Firebase sync
    // Admins can sync without Firebase Auth if Firestore rules allow
    try {
      const { getApp } = require('@react-native-firebase/app');
      const { getAuth } = require('@react-native-firebase/auth');
      const { getFirestore: getFirebaseFirestore, collection, getDocs, query: firestoreQuery, where } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirebaseFirestore(app);
      
      // For admin, try to sync without auth check (if Firestore rules allow)
      if (isAdmin) {
        console.log('👑 Admin sync - attempting direct Firestore access');

        try {
          const snapshot = await getDocs(collection(db, 'packages'));
          const firestorePackages: Package[] = [];

          snapshot.forEach((doc: any) => {
            const data = doc.data() as any;
            firestorePackages.push({ id: doc.id, ...data });
          });

          // Merge local archived overrides back onto Firestore-synced packages
          // so that "archive" does not get reverted by stale Firestore reads.
          const localRaw = await AsyncStorage.getItem(PACKAGES_KEY);
          const localAllPackages: Package[] = localRaw ? JSON.parse(localRaw) : [];

          const localArchivedById = new Map<string, { is_archived: boolean; archived_at?: string }>();
          for (const p of localAllPackages) {
            const isArchived = !!(p.is_archived || p.archived_at);
            if (isArchived) {
              localArchivedById.set(p.id, {
                is_archived: true,
                archived_at: p.archived_at,
              });
            }
          }

          const mergedPackages = firestorePackages.map(p => {
            const localOverride = localArchivedById.get(p.id);
            if (!localOverride) return p;

            return {
              ...p,
              is_archived: true,
              archived_at: localOverride.archived_at ?? p.archived_at,
            };
          });

          await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(mergedPackages));
          console.log(`📥 Admin synced ${mergedPackages.length} packages from Firestore (with local archive merge)`);
          return;
        } catch (adminSyncError) {
          console.log('⚠️ Admin direct sync failed, trying with auth:', adminSyncError);
          // Fall through to auth-based sync
        }
      }
      
      // For non-admin or if admin direct sync failed, check Firebase Auth
      const authInstance = getAuth(app);
      const currentUser = authInstance.currentUser;
      
      console.log('🔐 Firebase auth currentUser:', currentUser ? 'Yes' : 'No');
      
      if (!currentUser) {
        console.log('🔒 No Firebase user authenticated - skipping Firestore sync');
        return;
      }
      
      // Get user token to ensure fresh claims
      const tokenResult = await currentUser.getIdTokenResult(true);
      const claims = tokenResult.claims;
      
      console.log('🔐 Firebase claims:', claims);
      
      // Check if user has permission based on claims
      const isUserAdmin = claims?.admin === true;
      const userDriverId = claims?.driverId;
      
      // If driver is trying to sync but claims don't match, skip
      if (driverId && userDriverId && userDriverId !== driverId && !isUserAdmin) {
        console.log(`🔒 Driver ID mismatch: ${userDriverId} vs ${driverId} - skipping sync`);
        return;
      }
      
      // Use React Native Firebase Firestore v22 modular API
      const packagesCollection = collection(db, 'packages');
      let queryRef = packagesCollection;
      
      // Admin syncs all packages, drivers only sync their assigned + pending
      if (!isAdmin && driverId) {
        queryRef = firestoreQuery(packagesCollection, where('assigned_to', 'in', [driverId, null, '']));
      }
      
      const snapshot = await getDocs(queryRef);
      const packages: Package[] = [];
      
      snapshot.forEach((doc: any) => {
        const data = doc.data() as any;
        packages.push({ id: doc.id, ...data });
      });
      
      await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
      console.log(`📥 Synced ${packages.length} packages from Firestore`);
    } catch (firebaseError) {
      console.error('Firebase initialization error in sync:', firebaseError);
      console.log('🔒 Firebase not available - working in offline mode');
    }
  } catch (error) {
    console.error('Sync packages error:', error);
  }
};

export const syncDriversFromFirestore = async (): Promise<void> => {
  try {
    // Check if we have Firebase Authentication
    // Note: Only admins can sync drivers
    // Try direct access first (if Firestore rules allow), then fall back to auth
    try {
      const { getApp } = require('@react-native-firebase/app');
      const { getAuth } = require('@react-native-firebase/auth');
      const { getFirestore: getFirebaseFirestore, collection, getDocs } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirebaseFirestore(app);
      
      // Try direct sync first (for admin without Firebase Auth)
      console.log('👑 Attempting direct driver sync from Firestore');
      
      try {
        const snapshot = await getDocs(collection(db, 'drivers'));
        const firebaseDrivers: Driver[] = [];
        
        snapshot.forEach((doc: any) => {
          const driverData = doc.data() as any;
          // Only include active drivers from Firebase
          const isActive = driverData.is_active !== undefined ? driverData.is_active : true;
          if (isActive) {
            firebaseDrivers.push({ id: doc.id, ...driverData });
          }
        });
        
        // Get existing local drivers
        const localDrivers = await getDriversLocally();
        
        // Merge drivers: Firebase drivers take precedence, but keep local drivers that aren't in Firebase
        const mergedDrivers: Driver[] = [...firebaseDrivers];
        const firebaseIds = new Set(firebaseDrivers.map(d => d.id));
        
        localDrivers.forEach(localDriver => {
          if (!firebaseIds.has(localDriver.id)) {
            mergedDrivers.push(localDriver);
          }
        });
        
        await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(mergedDrivers));
        console.log(`📥 Synced ${firebaseDrivers.length} drivers from Firestore, total: ${mergedDrivers.length} drivers`);
        return;
      } catch (directSyncError) {
        console.log('⚠️ Direct driver sync failed, trying with auth:', directSyncError);
        // Fall through to auth-based sync
      }
      
      // If direct sync failed, try with Firebase Auth
      const authInstance = getAuth(app);
      const currentUser = authInstance.currentUser;
      
      if (!currentUser) {
        console.log('🔒 No Firebase user authenticated - skipping Firestore sync');
        return;
      }
      
      // Get user token to ensure fresh claims
      const tokenResult = await currentUser.getIdTokenResult(true);
      const claims = tokenResult.claims;
      
      // Only admins can sync drivers
      if (!claims?.admin) {
        console.log('🔒 User is not admin - skipping drivers sync');
        return;
      }
      
      // Use React Native Firebase Firestore v22 modular API
      const snapshot = await getDocs(collection(db, 'drivers'));
      const firebaseDrivers: Driver[] = [];
      
      snapshot.forEach((doc: any) => {
        const driverData = doc.data() as any;
        // Only include active drivers from Firebase
        const isActive = driverData.is_active !== undefined ? driverData.is_active : true;
        if (isActive) {
          firebaseDrivers.push({ id: doc.id, ...driverData });
        }
      });
      
      // Get existing local drivers
      const localDrivers = await getDriversLocally();
      
      // Merge drivers: Firebase drivers take precedence, but keep local drivers that aren't in Firebase
      const mergedDrivers: Driver[] = [...firebaseDrivers];
      const firebaseIds = new Set(firebaseDrivers.map(d => d.id));
      
      localDrivers.forEach(localDriver => {
        if (!firebaseIds.has(localDriver.id)) {
          mergedDrivers.push(localDriver);
        }
      });
      
      await AsyncStorage.setItem(DRIVERS_KEY, JSON.stringify(mergedDrivers));
      console.log(`📥 Synced ${firebaseDrivers.length} drivers from Firestore, total: ${mergedDrivers.length} drivers`);
    } catch (firebaseError) {
      console.error('Firebase initialization error in drivers sync:', firebaseError);
      console.log('🔒 Firebase not available - working in offline mode');
    }
  } catch (error) {
    console.error('Sync drivers error:', error);
  }
};

// updatePackage implementation moved below with enhanced functionality

export const upsertPackageLocally = async (pkg: Package): Promise<void> => {
  const packages = await getPackagesLocally(undefined, true);
  const index = packages.findIndex(p => p.id === pkg.id);
  if (index > -1) {
    packages[index] = pkg;
  } else {
    packages.push(pkg);
  }
  await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
};

export const getLastSyncTime = async (): Promise<string> => {
  try {
    const time = await AsyncStorage.getItem(LAST_SYNC_KEY);
    return time || '';
  } catch {
    return '';
  }
};

// Enhanced package filtering for drivers
export const getPackagesLocally = async (driverId?: string, includeArchived: boolean = false): Promise<Package[]> => {
  try {
    const data = await AsyncStorage.getItem(PACKAGES_KEY);
    const allPackages: Package[] = data ? JSON.parse(data) : [];
    
  // If driverId provided, filter packages assigned to this driver
    if (driverId) {
      return allPackages.filter(pkg =>
        pkg.assigned_to === driverId && (includeArchived || !pkg.is_archived || pkg.status === 'Archived')
      );
    }

    // Admin/normal retrieval: hide archived by default unless requested
    return allPackages.filter(pkg => includeArchived || !pkg.is_archived);
  } catch {
    return [];
  }
};

// Local-first package creation with immediate sync of new package only
export const createPackage = async (packageData: Omit<Package, 'id'>): Promise<void> => {
  try {
    const packages = await getPackagesLocally(undefined, true);
    const newPackage: Package = {
      ...packageData,
      id: `pkg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
      _lastModified: new Date().toISOString(),
      _version: '1.0'
    };
    
    // Save locally first (guaranteed to work)
    packages.push(newPackage);
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
    console.log(`💾 Package ${newPackage.id} saved locally`);
    
    // Try immediate sync of this specific package only
    try {
      // Use React Native Firebase v22 modular API
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirestore(app);
      
      const { doc, setDoc } = require('@react-native-firebase/firestore');
      await setDoc(doc(db, 'packages', newPackage.id), newPackage);
      console.log(`✅ Package ${newPackage.id} synced immediately`);
      
      // Mark as synced in queue
      await addToSyncQueue({
        id: `sync_${Date.now()}`,
        type: 'create',
        collection: 'packages',
        data: newPackage,
        timestamp: new Date().toISOString(),
        synced: true // Mark as already synced
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log(`⏳ Package ${newPackage.id} created locally, will sync when online:`, errorMessage);
      // Add to sync queue for later
      await addToSyncQueue({
        id: `sync_${Date.now()}`,
        type: 'create',
        collection: 'packages',
        data: newPackage,
        timestamp: new Date().toISOString(),
        synced: false
      });
    }
  } catch (error) {
    console.error('Error creating package:', error);
    throw error;
  }
};

// Sync queue management
export const getSyncQueue = async (): Promise<SyncOperation[]> => {
  try {
    const data = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const addToSyncQueue = async (operation: SyncOperation): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    queue.push(operation);
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error('Error adding to sync queue:', error);
  }
};

export const markSyncItemAsSynced = async (operationId: string): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const updatedQueue = queue.map(op => 
      op.id === operationId ? { ...op, synced: true } : op
    );
    // Remove synced items older than 1 hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const filteredQueue = updatedQueue.filter(op => 
      !op.synced || op.timestamp > oneHourAgo
    );
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filteredQueue));
  } catch (error) {
    console.error('Error marking sync item:', error);
  }
};

export const processSyncQueue = async (): Promise<void> => {
  try {
    const queue = await getSyncQueue();
    const unsynced = queue.filter(op => !op.synced);

    for (const operation of unsynced) {
      try {
        const { getApp } = require('@react-native-firebase/app');
        const firestoreMod = require('@react-native-firebase/firestore');
        const { getFirestore } = firestoreMod;

        const app = getApp();
        const db = getFirestore(app);

        // Prefer modular exports if available; otherwise fall back to namespaced API.
        const {
          doc,
          setDoc,
          updateDoc,
          deleteDoc,
        } = firestoreMod;

        if (doc && setDoc && updateDoc && deleteDoc) {
          if (operation.type === 'create' && operation.collection === 'packages') {
            await setDoc(doc(db, 'packages', operation.data.id), operation.data);
          } else if (operation.type === 'update' && operation.collection === 'packages') {
            const finalUpdates = {
              ...operation.data.updates,
              _lastModified: new Date().toISOString()
            };
            await updateDoc(doc(db, 'packages', operation.data.id), finalUpdates);
          } else if (operation.type === 'delete' && operation.collection === 'packages') {
            await deleteDoc(doc(db, 'packages', operation.data.id));
          }
        } else {
          // Fallback to avoid crashing when modular exports are not available in runtime
          if (operation.type === 'create' && operation.collection === 'packages') {
            await db.collection('packages').doc(operation.data.id).set(operation.data);
          } else if (operation.type === 'update' && operation.collection === 'packages') {
            const finalUpdates = {
              ...operation.data.updates,
              _lastModified: new Date().toISOString()
            };
            await db.collection('packages').doc(operation.data.id).update(finalUpdates);
          } else if (operation.type === 'delete' && operation.collection === 'packages') {
            await db.collection('packages').doc(operation.data.id).delete();
          }
        }

        await markSyncItemAsSynced(operation.id);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);
      }
    }
  } catch (error) {
    console.error('Error processing sync queue:', error);
  }
};

// Real-time package filtering for admin dashboard
// Local-first package update (used by hook for immediate updates)
export const updatePackage = async (packageId: string, updates: Partial<Package>): Promise<void> => {
  try {
    // Update locally first
    const packages = await getPackagesLocally(undefined, true);
    const pkgIndex = packages.findIndex(p => p.id === packageId);
    
    if (pkgIndex >= 0) {
      const updatedPackage = {
        ...packages[pkgIndex],
        ...updates,
        _lastModified: new Date().toISOString(),
        _version: String(parseFloat(packages[pkgIndex]._version || '1.0') + 0.1)
      };
      
      packages[pkgIndex] = updatedPackage;
      await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
      console.log(`💾 Package ${packageId} updated locally`);
    }
  } catch (error) {
    console.error('Error updating package locally:', error);
    throw error;
  }
};

// Real-time package filtering for admin dashboard
export const getPackageStats = async (driverId?: string): Promise<{
  total: number;
  pending: number;
  assigned: number;
  inTransit: number;
  delivered: number;
  returned: number;
}> => {
  try {
    const packages = await getPackagesLocally(driverId);
    
    return {
      total: packages.length,
      pending: packages.filter(p => p.status === 'Pending').length,
      assigned: packages.filter(p => p.status === 'Assigned').length,
      inTransit: packages.filter(p => p.status === 'In Transit').length,
      delivered: packages.filter(p => p.status === 'Delivered').length,
      returned: packages.filter(p => p.status === 'Returned').length,
    };
  } catch (error) {
    console.error('Error getting package stats:', error);
    return {
      total: 0, pending: 0, assigned: 0, 
      inTransit: 0, delivered: 0, returned: 0
    };
  }
};
