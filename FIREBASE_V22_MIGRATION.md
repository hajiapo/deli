# React Native Firebase v22 Migration

## What Changed?

React Native Firebase v22 deprecated the **namespaced API** and moved to a **modular API** that matches Firebase Web SDK.

### ❌ Deprecated (Old Way)
```typescript
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const db = firestore(); // ❌ Deprecated
const authInstance = auth(); // ❌ Deprecated
```

### ✅ Correct (New Way - v22)
```typescript
import { getApp } from '@react-native-firebase/app';
import { getFirestore } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';

const app = getApp(); // Get the Firebase app instance
const db = getFirestore(app); // ✅ Pass app to getFirestore
const authInstance = getAuth(app); // ✅ Pass app to getAuth
```

## Key Points

1. **Always get the app first**: `const app = getApp();`
2. **Pass app to all Firebase services**: `getFirestore(app)`, `getAuth(app)`
3. **The API methods remain the same**: `db.collection()`, `auth.currentUser`, etc.

## What We Fixed

### Files Updated:
- ✅ `src/firebase/config.ts` - Central Firebase configuration
- ✅ `src/utils/localDatabase.ts` - All Firestore operations
- ✅ `src/hooks/useLocalDatabase.ts` - Hook Firebase calls
- ✅ `src/utils/authMiddleware.ts` - Auth middleware
- ✅ `src/screens/LoginScreen.tsx` - Login Firebase calls
- ✅ `App.tsx` - App initialization

### Pattern Used:
```typescript
// Dynamic require pattern (when needed)
const { getApp } = require('@react-native-firebase/app');
const { getFirestore } = require('@react-native-firebase/firestore');

const app = getApp();
const db = getFirestore(app);

// Now use db normally
await db.collection('packages').doc(id).get();
```

## Why This Matters

- **No more deprecation warnings** in console
- **Future-proof**: v22 is the current standard
- **Consistent with Web SDK**: Easier to share code/knowledge
- **Better tree-shaking**: Smaller bundle sizes

## Testing

After migration, test:
1. ✅ Admin login
2. ✅ Driver login (admin-created IDs)
3. ✅ Package sync from Firestore
4. ✅ Driver sync from Firestore
5. ✅ Package creation/update
6. ✅ Offline mode still works

## References

- [React Native Firebase v22 Migration Guide](https://rnfirebase.io/migrating-to-v22)
- [Firebase Modular SDK](https://firebase.google.com/docs/web/modular-upgrade)
