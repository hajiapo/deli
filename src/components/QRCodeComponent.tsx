import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { generateQRString, extractQRData } from '../utils/qrGenerator';

interface QRCodeComponentProps {
  data: any; // Full package data
  size?: number;
  getRef?: (ref: any) => void;
}

/**
 * QRCodeComponent
 * Displays a QR code for package data
 * Usage: <QRCodeComponent data={packageData} size={300} />
 */
export const QRCodeComponent: React.FC<QRCodeComponentProps> = ({
  data,
  size = 300,
  getRef,
}) => {
  const qrRef = useRef<any>(null);

  React.useEffect(() => {
    if (getRef && qrRef.current) {
      getRef(qrRef.current);
    }
  }, [getRef]);

  const qrData = extractQRData(data);
  const qrString = generateQRString(qrData);

  return (
    <View style={styles.container}>
      <QRCode
        value={qrString}
        size={size}
        color="black"
        backgroundColor="white"
        getRef={(ref: any) => {
          qrRef.current = ref;
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
