#!/usr/bin/env node

/**
 * Initialize Admin PIN Script
 * 
 * Usage: npx ts-node scripts/initializeAdminPin.ts <8-digit-PIN>
 * Example: npx ts-node scripts/initializeAdminPin.ts 12345678
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import CryptoJS from 'crypto-js';

// Firebase configuration (same as in app)
const firebaseConfig = {
  apiKey: "AIzaSyDB64X2P6NMLf8xmhajmRlaBcWm9b9h_Hc",
  authDomain: "delivry-app.firebaseapp.com",
  projectId: "delivry-app",
  storageBucket: "delivry-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef123456"
};

const SETTINGS_DOC = 'settings/admin';

/**
 * Hash PIN using SHA-256 (same as in app)
 */
const hashPin = (pin: string): string => {
  return CryptoJS.SHA256(pin).toString();
};

/**
 * Initialize admin PIN in Firestore
 */
async function initializeAdminPin(plainPin: string): Promise<void> {
  try {
    // Validate PIN
    if (!plainPin || plainPin.length !== 8) {
      console.error('❌ Error: PIN must be exactly 8 digits');
      process.exit(1);
    }

    if (!/^\d+$/.test(plainPin)) {
      console.error('❌ Error: PIN must contain only numbers');
      process.exit(1);
    }

    // Initialize Firebase
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    // Check if admin PIN already exists
    const docRef = doc(db, SETTINGS_DOC);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists() && docSnap.data()?.pin_hash) {
      console.error('❌ Error: Admin PIN already initialized');
      console.log('To change the PIN, use the admin dashboard or changeAdminPin function');
      process.exit(1);
    }

    // Hash the PIN using SHA-256
    const pin_hash = hashPin(plainPin);

    // Save to Firestore
    await setDoc(docRef, {
      pin_hash,
      updated_at: new Date().toISOString(),
      updated_by: 'system',
      initialized: true
    });

    console.log('✅ Admin PIN initialized successfully!');
    console.log(`📝 PIN: ${plainPin}`);
    console.log(`🔐 Hash: ${pin_hash.substring(0, 20)}...`);
    console.log('');
    console.log('You can now access admin features by:');
    console.log('1. Opening the app');
    console.log('2. Tapping the gear icon 3 times');
    console.log('3. Entering your 8-digit PIN');
    
  } catch (error) {
    console.error('❌ Error initializing admin PIN:', error);
    process.exit(1);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 1) {
    console.log('🔐 Admin PIN Initialization Script');
    console.log('');
    console.log('Usage: npx ts-node scripts/initializeAdminPin.ts <8-digit-PIN>');
    console.log('');
    console.log('Examples:');
    console.log('  npx ts-node scripts/initializeAdminPin.ts 12345678');
    console.log('  npx ts-node scripts/initializeAdminPin.ts 98765432');
    console.log('');
    console.log('Note: PIN must be exactly 8 digits');
    process.exit(1);
  }

  const pin = args[0];
  await initializeAdminPin(pin);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { initializeAdminPin };
