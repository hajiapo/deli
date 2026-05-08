/**
 * Script to manually sync packages from Firestore to local storage
 * Run this to pull all packages from Firestore
 */

import { getApp } from '@react-native-firebase/app';
import { collection, getDocs, getFirestore as getFirebaseFirestore } from '@react-native-firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PACKAGES_KEY = '@delivry:packages';

async function syncPackages() {
  try {
    console.log('🔄 Starting manual package sync from Firestore...');
    
    // Get Firebase instances
    const app = getApp();
    const db = getFirebaseFirestore(app);
    
    // Fetch all packages from Firestore
    const snapshot = await getDocs(collection(db, 'packages'));
    
    console.log(`📦 Found ${snapshot.size} packages in Firestore`);
    
    const packages: any[] = [];
    snapshot.forEach((doc: any) => {
      const data = doc.data();
      packages.push({
        id: doc.id,
        ...data
      });
      console.log(`  - ${doc.id}: ${data.recipient_name} (${data.status})`);
    });
    
    // Save to local storage
    await AsyncStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
    
    console.log(`✅ Successfully synced ${packages.length} packages to local storage`);
    console.log('📱 Packages are now available offline');
    
    return packages;
  } catch (error) {
    console.error('❌ Error syncing packages:', error);
    throw error;
  }
}

// Export for use in app
export default syncPackages;

// If running as standalone script
if (require.main === module) {
  syncPackages()
    .then(() => {
      console.log('✅ Sync complete');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Sync failed:', error);
      process.exit(1);
    });
}
