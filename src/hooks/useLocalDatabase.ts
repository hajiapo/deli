/**
 * useLocalDatabase Hook
 * 
 * React hook for managing local database with Firestore sync
 */

import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Package, Driver } from '../types';
import {
  getPackagesLocally,
  getDriversLocally,
  updatePackage,
  syncPackagesFromFirestore,
  syncDriversFromFirestore,
  processSyncQueue,
  getSyncQueue,
  getLastSyncTime,
  getPackageStats,
  upsertPackageLocally,
  deletePackageLocally,
  addToSyncQueue,
} from '../utils/localDatabase';
import { isPreStoredDriverId } from '../config/credentials';


interface UseLocalDatabaseOptions {
  driverId?: string;
  isAdmin?: boolean;
}

export const useLocalDatabase = (options: UseLocalDatabaseOptions = {}) => {
  const { driverId, isAdmin = false } = options;
  
  const [packages, setPackages] = useState<Package[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Load data from local storage and sync from Firestore on mount
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await loadLocalData();
      await checkSyncQueue();
      // Initial sync from Firestore
      await syncWithFirestore();
      setLoading(false);
    };
    init();
  }, []);

  // Real-time listener for package changes (deletions, updates)
  useEffect(() => {
    try {
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore, collection, query, where, onSnapshot } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirestore(app);
      
      let unsubscribe: (() => void) | null = null;
      let q: any;

      if (isAdmin) {
        // Admin listens to all packages
        q = collection(db, 'packages');
      } else if (driverId) {
        // Driver listens only to their assigned packages
        q = query(collection(db, 'packages'), where('assigned_to', '==', driverId));
      } else {
        return; // No valid driverId or isAdmin
      }

      unsubscribe = onSnapshot(q, async (snapshot: any) => {
        try {
          const firestorePackages: Package[] = [];
          snapshot.forEach((doc: any) => {
            const data = doc.data() as any;
            firestorePackages.push({ id: doc.id, ...data });
          });

          // Update local state with Firestore data (includes deletions automatically)
          setPackages(firestorePackages);
          
          // Sync to local storage
          await AsyncStorage.setItem('@delivry:packages', JSON.stringify(firestorePackages));
          console.log(`🔄 Real-time update: ${firestorePackages.length} packages synced (deletions included)`);
        } catch (error) {
          console.error('Error processing real-time update:', error);
        }
      }, (error: any) => {
        console.error('Real-time listener error:', error);
      });

      return () => {
        if (unsubscribe) unsubscribe();
      };
    } catch (error) {
      console.error('Error setting up real-time listener:', error);
    }
  }, [driverId, isAdmin]);

  // Event-driven sync - no more periodic refreshes
  const [packageStats, setPackageStats] = useState<any>(null);
  const [lastUpdate, setLastUpdate] = useState<string>(new Date().toISOString());

  // Update stats when packages change (event-driven)
  useEffect(() => {
    const updateStats = async () => {
      try {
        const stats = await getPackageStats(driverId);
        setPackageStats(stats);
        setLastUpdate(new Date().toISOString());
      } catch (error) {
        console.error('Error updating stats:', error);
      }
    };

    updateStats();
  }, [packages, driverId]); // Only update when packages actually change

  /**
   * Load data from local storage
   */
  const loadLocalData = async () => {
    try {
      setLoading(true);
      const [localPackages, localDrivers, syncTime] = await Promise.all([
        getPackagesLocally(driverId, isAdmin), // Admin gets all packages including archived
        getDriversLocally(),
        getLastSyncTime(),
      ]);

      setPackages(localPackages);
      setDrivers(localDrivers);
      setLastSync(syncTime);
    } catch (error) {
      console.error('Error loading local data:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Check sync queue status
   */
  const checkSyncQueue = async () => {
    try {
      const queue = await getSyncQueue();
      setPendingSyncCount(queue.length);
    } catch (error) {
      console.error('Error checking sync queue:', error);
    }
  };

  /**
   * Sync with Firestore (only if online and not pre-stored driver)
   */
  const syncWithFirestore = async () => {
    try {
      setSyncing(true);
      setConnectionError(null);
      setIsOnline(true);
      
      // Skip Firebase sync for pre-stored driver IDs (DRV-001 to DRV-020)
      const isPreStored = driverId ? isPreStoredDriverId(driverId) : false;
      
      if (!isPreStored) {
        // Only sync packages and drivers for non-pre-stored IDs
        await Promise.all([
          syncPackagesFromFirestore(driverId, isAdmin),
          isAdmin ? syncDriversFromFirestore() : Promise.resolve()
        ]);
        
        setLastSync(new Date().toISOString());
      } else {
        console.log('🔒 Skipping Firebase sync for pre-stored driver ID:', driverId);
        // Still update last sync time to prevent repeated attempts
        setLastSync(new Date().toISOString());
      }
      
      // Reload local data after sync to get updated drivers/packages
      await loadLocalData();
    } catch (error) {
      console.error('Sync error:', error);
      setConnectionError('Connexion Firebase perdue');
      setIsOnline(false);
      
      // Check if there are completed tasks that need reporting
      const completedTasks = packages.filter(p => p.status === 'Delivered' || p.status === 'Returned');
      if (completedTasks.length > 0) {
        console.log(`🚨 Connection lost, triggering auto-report for ${completedTasks.length} completed tasks`);
        // Trigger auto-report (this will be handled in the component)
        // We'll add a callback prop for this
      }
    } finally {
      setSyncing(false);
    }
  };

  /**
   * Local-first package status update with immediate sync of changes only
   */
  const updatePackageStatus = async (
    packageId: string,
    status: Package['status'],
    additionalData?: Partial<Package>
  ) => {
    try {
      const updates: Partial<Package> = {
        status,
        ...additionalData,
        _lastModified: new Date().toISOString(),
      };

      // Add timestamp for status changes
      if (status === 'In Transit' && !additionalData?.accepted_at) {
        updates.accepted_at = new Date().toISOString();
      } else if (status === 'Delivered' && !additionalData?.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      // Update locally first (always works)
      const localPkgs = await getPackagesLocally(undefined, true);
      const pkgIndex = localPkgs.findIndex(p => p.id === packageId);
      
      if (pkgIndex >= 0) {
        const updatedPkg = { 
          ...localPkgs[pkgIndex], 
          ...updates,
          _lastModified: new Date().toISOString(),
        };
        
        // Save to local storage immediately
        await upsertPackageLocally(updatedPkg);
        
        // Update local state for instant UI update
        setPackages(prev => prev.map(pkg => 
          pkg.id === packageId ? updatedPkg : pkg
        ));
      }

      // Skip Firebase sync for pre-stored driver IDs
      const isPreStored = driverId ? isPreStoredDriverId(driverId) : false;
      
      if (!isPreStored) {
        // Sync only this specific change immediately (not full refresh)
        try {
          // Use React Native Firebase v22 modular API
          const { getApp } = require('@react-native-firebase/app');
          const { getFirestore } = require('@react-native-firebase/firestore');
          
          const app = getApp();
          const db = getFirestore(app);

          const { doc, updateDoc } = require('@react-native-firebase/firestore');
          await updateDoc(doc(db, 'packages', packageId), updates);
          console.log(`✅ Package ${packageId} status synced: ${status}`);
        } catch (syncError) {
          console.log(`⏳ Package ${packageId} updated locally, will sync later`);
          // Add to sync queue for later
          await addToSyncQueue({
            id: `sync_${Date.now()}`,
            type: 'update',
            collection: 'packages',
            data: { id: packageId, updates },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      } else {
        console.log(`🔒 Package ${packageId} updated locally only (pre-stored driver: ${driverId})`);
      }

    } catch (error) {
      console.error('Error updating package status:', error);
      throw error;
    }
  };

  /**
   * Local-first package assignment with immediate sync of assignments only
   */
  const assignPackageToDriver = async (packageIds: string[], targetDriverId: string) => {
    try {
      const timestamp = new Date().toISOString();
      
      // Update all packages locally first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        
        if (pkgIndex >= 0) {
          const updates = {
            status: 'Assigned' as const,
            assigned_to: targetDriverId,
            assigned_at: timestamp,
            _lastModified: new Date().toISOString(),
          };
          
          const updatedPkg = { ...localPkgs[pkgIndex], ...updates };
          await upsertPackageLocally(updatedPkg);
          
          // Update local state
          setPackages(prev => prev.map(pkg => 
            pkg.id === pkgId ? updatedPkg : pkg
          ));
        }
      }

      // Sync assignments immediately (batch update for efficiency)
      try {
        // Use React Native Firebase v22 modular API
        const { getApp } = require('@react-native-firebase/app');
        const { getFirestore } = require('@react-native-firebase/firestore');
        
        const app = getApp();
        const db = getFirestore(app);

        const { doc, writeBatch } = require('@react-native-firebase/firestore');
        const batch = writeBatch(db);

        for (const pkgId of packageIds) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.update(pkgRef, {
            status: 'Assigned',
            assigned_to: targetDriverId,
            assigned_at: timestamp,
            _lastModified: timestamp
          });
        }
        await batch.commit();
        console.log(`✅ ${packageIds.length} packages assigned and synced`);
      } catch (syncError) {
        console.log(`⏳ Package assignments saved locally, will sync later`);
        // Add all to sync queue
        for (const pkgId of packageIds) {
          await addToSyncQueue({
            id: `sync_${Date.now()}_${pkgId}`,
            type: 'update',
            collection: 'packages',
            data: { 
              id: pkgId, 
              updates: {
                status: 'Assigned',
                assigned_to: targetDriverId,
                assigned_at: timestamp,
                _lastModified: timestamp
              }
            },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      }
    } catch (error) {
      console.error('Error assigning packages:', error);
      throw error;
    }
  };

  /**
   * Get filtered packages for admin dashboard
   */
  const getFilteredPackages = useCallback((filters: {
    status?: string;
    driverId?: string;
    dateRange?: 'today' | 'week' | 'month' | 'all';
    searchQuery?: string;
  }) => {
    let filtered = [...packages];

    // Status filter
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(pkg => pkg.status === filters.status);
    }

    // Driver filter
    if (filters.driverId && filters.driverId !== 'all') {
      filtered = filtered.filter(pkg => pkg.assigned_to === filters.driverId);
    }

    // Date range filter
    if (filters.dateRange && filters.dateRange !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      filtered = filtered.filter(pkg => {
        if (!pkg.limit_date) return false;
        const pkgDate = new Date(pkg.limit_date);
        
        switch (filters.dateRange) {
          case 'today':
            return pkgDate.toDateString() === today.toDateString();
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
            return pkgDate >= weekAgo;
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            return pkgDate >= monthAgo;
          default:
            return true;
        }
      });
    }

    // Search query filter
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(pkg => 
        pkg.ref_number?.toLowerCase().includes(query) ||
        pkg.customer_name?.toLowerCase().includes(query) ||
        pkg.customer_address?.toLowerCase().includes(query)
      );
    }

    return filtered;
  }, [packages]);

  /**
   * Manual refresh data (pull from Firestore) - only when explicitly requested
   */
  const refresh = useCallback(async () => {
    console.log('🔄 Manual refresh requested');
    await syncWithFirestore();
    // Reload local data after sync to get updated drivers/packages
    await loadLocalData();
  }, [driverId, isAdmin]);

  /**
   * Reload local data without syncing with Firestore
   */
  const reloadLocalData = useCallback(async () => {
    console.log('🔄 Reloading local data only');
    await loadLocalData();
  }, [driverId, isAdmin]);

  /**
   * Update a package in local state immediately (for instant UI updates)
   */
  const updatePackageInState = useCallback((updatedPkg: Package) => {
    setPackages(prev => prev.map(pkg => 
      pkg.id === updatedPkg.id ? updatedPkg : pkg
    ));
  }, []);

  /**
   * Add a new package to local state immediately
   */
  const addPackageToState = useCallback((newPkg: Package) => {
    setPackages(prev => [...prev, newPkg]);
  }, []);

  /**
   * Process sync queue periodically (every 2 minutes) for failed operations
   */
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        await processSyncQueue();
        console.log('🔄 Sync queue processed');
      } catch (error) {
        console.error('Error in periodic sync queue processing:', error);
      }
    }, 120000); // 2 minutes

    return () => clearInterval(interval);
  }, []);

  const archivePackages = async (packageIds: string[]) => {
    try {
      const timestamp = new Date().toISOString();

      // Local update first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        if (pkgIndex >= 0) {
          const updatedPkg = {
            ...localPkgs[pkgIndex],
            is_archived: true,
            status: 'Archived' as const,
            archived_at: timestamp,
            _lastModified: new Date().toISOString(),
          };
          await upsertPackageLocally(updatedPkg);
          setPackages(prev => prev.map(p => (p.id === pkgId ? updatedPkg : p)));
        }
      }

      // Try immediate Firestore update for archives
      try {
        const { getApp } = require('@react-native-firebase/app');
        const { getFirestore } = require('@react-native-firebase/firestore');
        const app = getApp();
        const db = getFirestore(app);

        const { doc, writeBatch } = require('@react-native-firebase/firestore');
        const batch = writeBatch(db);

        for (const pkgId of packageIds) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.update(pkgRef, {
            is_archived: true,
            status: 'Archived',
            archived_at: timestamp,
            _lastModified: timestamp,
          });
        }

        await batch.commit();
      } catch (syncError) {
        // Queue offline
        for (const pkgId of packageIds) {
          await addToSyncQueue({
            id: `sync_${Date.now()}_${pkgId}`,
            type: 'update',
            collection: 'packages',
            data: {
              id: pkgId,
              updates: {
                is_archived: true,
                status: 'Archived',
                archived_at: timestamp,
                _lastModified: timestamp,
              }
            },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      }
    } catch (error) {
      console.error('Error archiving packages:', error);
      throw error;
    }
  };

  const unarchivePackages = async (packageIds: string[]) => {
    try {
      const timestamp = new Date().toISOString();

      // Local update first
      for (const pkgId of packageIds) {
        const localPkgs = await getPackagesLocally(undefined, true);
        const pkgIndex = localPkgs.findIndex(p => p.id === pkgId);
        if (pkgIndex >= 0) {
          const updatedPkg = {
            ...localPkgs[pkgIndex],
            is_archived: false,
            status: 'Pending' as const,
            archived_at: undefined,
            _lastModified: new Date().toISOString(),
          };
          await upsertPackageLocally(updatedPkg);
          setPackages(prev => prev.map(p => (p.id === pkgId ? updatedPkg : p)));
        }
      }

      // Try immediate Firestore update
      try {
        const { getApp } = require('@react-native-firebase/app');
        const { getFirestore } = require('@react-native-firebase/firestore');
        const app = getApp();
        const db = getFirestore(app);

        const { doc, writeBatch } = require('@react-native-firebase/firestore');
        const batch = writeBatch(db);

        for (const pkgId of packageIds) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.update(pkgRef, {
            is_archived: false,
            status: 'Pending',
            archived_at: null,
            _lastModified: timestamp,
          });
        }

        await batch.commit();
      } catch (syncError) {
        // Queue offline
        for (const pkgId of packageIds) {
          await addToSyncQueue({
            id: `sync_${Date.now()}_${pkgId}`,
            type: 'update',
            collection: 'packages',
            data: {
              id: pkgId,
              updates: {
                is_archived: false,
                status: 'Pending',
                archived_at: null,
                _lastModified: timestamp,
              }
            },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
      }
    } catch (error) {
      console.error('Error unarchiving packages:', error);
      throw error;
    }
  };

  const deletePackages = async (packageIds: string[]) => {
    try {
      // Check if all packages are archived
      const packagesToDelete = packages.filter(p => packageIds.includes(p.id));
      const unarchivedPackages = packagesToDelete.filter(p => !p.is_archived && !p.archived_at);
      
      if (unarchivedPackages.length > 0) {
        const names = unarchivedPackages.map(p => p.ref_number).join(', ');
        throw new Error(`Les colis suivants ne sont pas archivés et ne peuvent pas être supprimés: ${names}. Veuillez d'abord les archiver.`);
      }

      // Delete locally first
      for (const pkgId of packageIds) {
        await deletePackageLocally(pkgId);
        setPackages(prev => prev.filter(p => p.id !== pkgId));
      }

      // Try immediate Firestore deletion
      try {
        const { getApp } = require('@react-native-firebase/app');
        const { getFirestore } = require('@react-native-firebase/firestore');
        const app = getApp();
        const db = getFirestore(app);

        const { doc, writeBatch, deleteDoc } = require('@react-native-firebase/firestore');
        const batch = writeBatch(db);

        for (const pkgId of packageIds) {
          const pkgRef = doc(db, 'packages', pkgId);
          batch.delete(pkgRef);
        }

        await batch.commit();
        console.log(`🗑️ Deleted ${packageIds.length} packages from Firestore`);
      } catch (syncError) {
        // Queue offline deletion
        for (const pkgId of packageIds) {
          await addToSyncQueue({
            id: `delete_${Date.now()}_${pkgId}`,
            type: 'delete',
            collection: 'packages',
            data: {
              id: pkgId,
            },
            timestamp: new Date().toISOString(),
            synced: false
          });
        }
        console.log(`⚠️ Queued ${packageIds.length} packages for deletion`);
      }
    } catch (error) {
      console.error('Error deleting packages:', error);
      throw error;
    }
  };

  return {
    packages,
    drivers,
    loading,
    syncing,
    lastSync,
    pendingSyncCount,
    isOnline,
    connectionError,
    refresh,
    reloadLocalData,
    updatePackageInState,
    addPackageToState,
    updatePackageStatus,
    assignPackageToDriver,
    archivePackages,
    unarchivePackages,
    deletePackages,
    getFilteredPackages,
    packageStats,
  };
};
