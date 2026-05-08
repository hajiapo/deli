# CryptoJS PIN Verification Setup

This document explains the PIN verification system using CryptoJS instead of bcrypt.

## Overview

The application now uses `crypto-js` for PIN hashing and verification instead of `bcrypt`. This change was made to simplify local development and reduce dependencies.

## Changes Made

### 1. Updated Dependencies
- Removed: `react-native-bcrypt`, `@types/bcrypt`, `bcrypt`
- Kept: `crypto-js` (already installed)

### 2. Updated Files

#### `src/config/credentials.ts`
- Replaced bcrypt imports with crypto-js
- Updated driver PIN hashes from bcrypt to SHA-256
- Updated `verifyDriverPin` function to use SHA-256 hashing
- Updated comments to reflect SHA-256 instead of bcrypt

#### `src/config/env.ts`
- Updated comments to reflect SHA-256 hashing instead of bcrypt

#### `src/screens/LoginScreen.tsx`
- Removed bcrypt test import and function

#### `src/screens/ChangeAdminPinScreen.tsx`
- Updated security text from "bcrypt" to "SHA-256"

#### `src/utils/testBcryptRN.ts` → `src/utils/testCryptoJs.ts`
- Renamed and updated to test crypto-js functionality
- Removed bcrypt-specific tests
- Added crypto-js/SHA-256 tests

#### `src/types/react-native-bcrypt.d.ts`
- Removed (no longer needed)

#### `package.json`
- Removed bcrypt-related dependencies

## Driver PINs

The system now uses simple 4-digit PINs for drivers:

- **DRV-001**: PIN `0001`
- **DRV-002**: PIN `0002`
- **DRV-003**: PIN `0003`
- ... and so on up to ...
- **DRV-020**: PIN `0020`

Each PIN is hashed using SHA-256 via `crypto-js`.

## Admin PIN

The admin PIN system remains the same:
- Uses 8-digit PINs
- Hashed with SHA-256 (same as driver PINs)
- Can be initialized using `scripts/initializeAdminPin.ts`

## Verification Logic

### Driver PIN Verification (`verifyDriverPin`)
1. Validates input: must be exactly 4 digits
2. Hashes the entered PIN using SHA-256
3. Compares with stored hash

### Admin PIN Verification
- Uses the existing `verifyAdminPin` function from `adminPin.ts`
- For local development: hardcoded PIN `90230155`
- For production: would verify against Firestore hash

## Testing

To test the crypto-js setup:
1. Run the app
2. Try logging in with driver credentials:
   - Driver ID: `DRV-001`
   - PIN: `0001`
3. Test admin access:
   - Tap gear icon 3 times
   - Enter PIN: `90230155`

## Security Notes

1. **SHA-256 vs bcrypt**: SHA-256 is a cryptographic hash function, while bcrypt is a password hashing function designed to be slow (to resist brute force attacks). For this application's use case (4-8 digit PINs), SHA-256 is sufficient for local development.

2. **Production Considerations**: For a production app, consider:
   - Using a proper password hashing algorithm like bcrypt or Argon2
   - Adding rate limiting for PIN attempts
   - Implementing secure PIN storage

3. **Local Development**: The current setup is optimized for local development where simplicity and ease of setup are priorities.