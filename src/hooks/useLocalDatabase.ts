/**
 * useLocalDatabase Hook
 * 
 * React hook for managing local database with Firestore sync
 */

import { useState, useEffect, useCallback } from 'react';
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
        getPackagesLocally(driverId), // Will filter if driverId provided
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
      };

      // Add timestamp for status changes
      if (status === 'In Transit' && !additionalData?.accepted_at) {
        updates.accepted_at = new Date().toISOString();
      } else if (status === 'Delivered' && !additionalData?.delivered_at) {
        updates.delivered_at = new Date().toISOString();
      }

      // Update locally first (always works)
      const localPkgs = await getPackagesLocally();
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
          
          await db.collection('packages').doc(packageId).update(updates);
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
        const localPkgs = await getPackagesLocally();
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
        const batch = db.batch();
        for (const pkgId of packageIds) {
          const pkgRef = db.collection('packages').doc(pkgId);
          batch.update(pkgRef, {
            status: 'Assigned',
            assigned_to: targetDriverId,
            assigned_at: timestamp
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
                assigned_at: timestamp
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

  return {
    packages,
    drivers,
    loading,
    syncing,
    lastSync,
    pendingSyncCount,
    refresh,
    updatePackageStatus,
    assignPackageToDriver,
    getFilteredPackages,
    packageStats,
  };
};
