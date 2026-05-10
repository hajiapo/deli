# Local QR Code Generation

## Overview
The app now generates QR codes **locally** using `react-native-qrcode-svg` instead of relying on the external quickchart.io service. This provides:

✅ No external dependencies  
✅ Works offline  
✅ Faster QR code generation  
✅ Full control over QR code styling  

---

## Installation

The library has been installed:
```bash
npm install react-native-qrcode-svg
```

---

## Usage

### 1. **Use the QRCodeComponent in any screen:**

```typescript
import { QRCodeComponent } from '../components/QRCodeComponent';

// In your screen component
<QRCodeComponent
  data={packageData}
  size={300}
  errorCorrectionLevel="M"
/>
```

### 2. **Manually generate QR strings:**

```typescript
import { generateQRString, extractQRData } from '../utils/qrGenerator';

const qrString = generateQRString(packageData);
// Result: JSON string that can be encoded in QR code
```

### 3. **Export QR code as image:**

```typescript
const qrRef = useRef<any>(null);

const handleExportQR = async () => {
  if (qrRef.current) {
    const svg = await qrRef.current.toDataURL();
    // Save or share the SVG
  }
};

<QRCodeComponent data={packageData} onSVGRef={qrRef} />
```

---

## File Structure

### New Files Created:
```
src/
├── components/
│   ├── QRCodeComponent.tsx          # Main QR code component
│   └── QRCodeDisplayExample.tsx     # Example usage in screen
└── utils/
    └── qrGenerator.ts              # QR data generation utilities

scripts/
└── (migration script removed)      # One-time migration already run
```

---

## Component Props

### QRCodeComponent

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `data` | `any` | required | Full package object |
| `size` | `number` | `300` | QR code size in pixels |
| `errorCorrectionLevel` | `'L' \| 'M' \| 'Q' \| 'H'` | `'M'` | QR error correction level |
| `onSVGRef` | `(ref) => void` | optional | Callback to get SVG reference |

---

## Utility Functions

### `generateQRString(packageData)`
Converts package object to JSON string suitable for QR encoding.

```typescript
const qrString = generateQRString({
  ref_number: 'PKG-123',
  customer_name: 'John Doe',
  // ...
});
// Returns: '{"ref_number":"PKG-123",...}'
```

### `extractQRData(fullPackage)`
Extracts only QR-relevant fields from a package object.

```typescript
const qrData = extractQRData(fullPackageObject);
```

---

## Migrating Test Data

To remove old `qr_url` fields from test-packages.json:

```bash
# (Migration script removed; run has been completed)
```

This will:
- ✓ Create a backup (test-packages.backup.json)
- ✓ Remove all `qr_url` fields
- ✓ Keep all other package data intact

---

## Error Correction Levels

- **L (7%)** - Low, ~7% error tolerance
- **M (15%)** - Medium, ~15% error tolerance (recommended)
- **Q (25%)** - Quartile, ~25% error tolerance
- **H (30%)** - High, ~30% error tolerance

---

## Example: Full Screen Implementation

```typescript
import React, { useRef } from 'react';
import { View, ScrollView, StyleSheet } from 'react-native';
import { QRCodeComponent } from '../components/QRCodeComponent';

const PackageDetailScreen = ({ route }: any) => {
  const { packageData } = route.params;
  const qrRef = useRef<any>(null);

  return (
    <ScrollView style={styles.container}>
      {/* Package Info */}
      <View style={styles.infoSection}>
        <Text>{packageData.ref_number}</Text>
        <Text>{packageData.customer_name}</Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrSection}>
        <QRCodeComponent
          data={packageData}
          size={300}
          onSVGRef={qrRef}
        />
      </View>
    </ScrollView>
  );
};
```

---

## Troubleshooting

**Issue**: QR code not displaying  
**Solution**: Ensure `data` prop is a valid object and not `null/undefined`

**Issue**: QR code too small/large  
**Solution**: Adjust the `size` prop (width/height in pixels)

**Issue**: QR code not scannable  
**Solution**: Increase `errorCorrectionLevel` to `'H'`

---

## Notes

- QR codes are generated dynamically and in-memory
- No external API calls are made
- Works completely offline
- SVG-based rendering is scalable without quality loss
