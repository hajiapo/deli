import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Platform } from 'react-native';
import { getStatusColor } from '../utils/statusColors';
import { 
  deviceType, 
  orientation, 
  SPACING, 
  FONTS, 
  RESPONSIVE_SHADOWS, 
  BORDER_RADIUS,
  responsiveSize 
} from '../utils/responsive';

interface PackageCardProps {
  pkg: {
    id: string;
    ref_number: string;
    customer_name?: string; // Made optional
    customer_address?: string; // Made optional
    customer_phone?: string;
    customer_phone_2?: string;
    gps_lat?: number;
    gps_lng?: number;
    status: string;
    price: number;
    is_paid: boolean;
    limit_date?: string; // Made optional
    description?: string;
    return_reason?: string;
    assigned_to?: string;
  };
  drivers?: Array<{ id: string; name: string }>;
  onAssign?: (id: string) => void;
  onAccept?: (id: string) => void;
  onDeliver?: (id: string) => void;
  onReturn?: (id: string) => void;
  assigning?: boolean;
}

export default function PackageCard({ pkg, drivers, onAssign, onAccept, onDeliver, onReturn, assigning }: PackageCardProps) {
  const statusColor = getStatusColor(pkg.status);
  
  // French translations for status labels
  const statusLabels: Record<string, string> = {
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
  };
  
  const frenchStatus = statusLabels[pkg.status] || pkg.status;

  const handleCallPhone = (phone: string) => {
    if (phone) {
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleWhatsApp = (phone: string) => {
    if (phone) {
      // Remove leading 0 and add country code (assuming French numbers)
      const formattedPhone = phone.startsWith('0') ? `33${phone.substring(1)}` : phone;
      Linking.openURL(`whatsapp://send?phone=${formattedPhone}`);
    }
  };

  const handleOpenMap = () => {
    if (pkg.gps_lat && pkg.gps_lng) {
      // Use geo: URI scheme for better native app support on Android
      // Falls back to https if Google Maps app is not installed
      const geoUrl = `geo:${pkg.gps_lat},${pkg.gps_lng}?q=${pkg.gps_lat},${pkg.gps_lng}`;
      const httpsUrl = `https://www.google.com/maps/search/?api=1&query=${pkg.gps_lat},${pkg.gps_lng}`;
      
      // Try geo: first (opens native Maps app), fallback to https
      Linking.canOpenURL(geoUrl).then(supported => {
        if (supported) {
          Linking.openURL(geoUrl);
        } else {
          Linking.openURL(httpsUrl);
        }
      }).catch(() => {
        // If geo: fails, use https as fallback
        Linking.openURL(httpsUrl);
      });
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.refText}>{pkg.ref_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
          <Text style={styles.statusText}>{frenchStatus}</Text>
        </View>
      </View>

      <View style={styles.body}>
        <Text style={styles.name}>{pkg.customer_name}</Text>
        <Text style={styles.address} numberOfLines={1}>{pkg.customer_address}</Text>
        
        {/* Assigned Driver */}
        {pkg.assigned_to && (
          <View style={styles.driverRow}>
            <Text style={styles.driverLabel}>🚚 Assigné à:</Text>
            <Text style={styles.driverName}>
              {drivers?.find(d => d.id === pkg.assigned_to)?.name || pkg.assigned_to || 'Non assigné'}
            </Text>
          </View>
        )}
        
        {/* Description */}
        {pkg.description && (
          <View style={styles.descriptionContainer}>
            <Text style={styles.descriptionLabel}>📝 Description:</Text>
            <Text style={styles.descriptionText}>{pkg.description}</Text>
          </View>
        )}
        
        <Text style={styles.date}>À livrer avant: {pkg.limit_date}</Text>
        
        {/* Customer Phone */}
        {(pkg.customer_phone || pkg.customer_phone_2) && (
          <View style={styles.phoneSection}>
            {pkg.customer_phone && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneNumber}>{pkg.customer_phone}</Text>
                <View style={styles.phoneActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleCallPhone(pkg.customer_phone!)}>
                    <Text style={styles.iconText}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleWhatsApp(pkg.customer_phone!)}>
                    <Text style={styles.iconText}>💬</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            {pkg.customer_phone_2 && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneNumber}>{pkg.customer_phone_2}</Text>
                <View style={styles.phoneActions}>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleCallPhone(pkg.customer_phone_2!)}>
                    <Text style={styles.iconText}>📞</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconBtn} onPress={() => handleWhatsApp(pkg.customer_phone_2!)}>
                    <Text style={styles.iconText}>💬</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* GPS Location */}
        {pkg.gps_lat && pkg.gps_lng && (
          <TouchableOpacity style={styles.mapBtn} onPress={handleOpenMap}>
            <View style={styles.mapContent}>
              <Text style={styles.mapIcon}>📍</Text>
              <Text style={styles.mapText}>Ouvrir dans Google Maps</Text>
            </View>
          </TouchableOpacity>
        )}
        
        {pkg.status === 'Returned' && pkg.return_reason && (
          <Text style={styles.reasonText}>Raison: {pkg.return_reason}</Text>
        )}
      </View>

      <View style={styles.footer}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          <Text style={styles.priceLabel}>Montant:</Text>
          <Text style={styles.priceValue}>{pkg.price.toFixed(2)} DH</Text>
          {pkg.is_paid && (
            <View style={styles.paidBadge}>
              <Text style={styles.paidText}>✓ PAYÉ</Text>
            </View>
          )}
        </View>

        <View style={styles.actionsContainer}>
          {pkg.status === 'Pending' && onAssign && (
            <TouchableOpacity 
              style={[styles.actionBtn, assigning && styles.actionBtnDisabled]} 
              onPress={() => onAssign(pkg.id)}
              disabled={assigning}
            >
              {assigning ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.actionBtnText}>Assigner</Text>}
            </TouchableOpacity>
          )}

          {pkg.status === 'Assigned' && onAccept && (
            <TouchableOpacity style={styles.acceptBtn} onPress={() => onAccept(pkg.id)}>
              <Text style={styles.actionBtnText}>Accepter</Text>
            </TouchableOpacity>
          )}

          {pkg.status === 'In Transit' && onDeliver && onReturn && (
            <>
              <TouchableOpacity style={styles.returnBtn} onPress={() => onReturn(pkg.id)}>
                <Text style={styles.actionBtnText}>Retour</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.deliverBtn} onPress={() => onDeliver(pkg.id)}>
                <Text style={styles.actionBtnText}>Livré</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF', 
    borderRadius: BORDER_RADIUS.responsive.card, 
    padding: responsiveSize(10, 12), 
    marginBottom: responsiveSize(8, 10),
    borderWidth: 1, 
    borderColor: '#F3F4F6',
    ...RESPONSIVE_SHADOWS.card,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        marginHorizontal: SPACING.xs,
        marginBottom: SPACING.xs,
      } : {},
      android: {},
    }),
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: responsiveSize(8, 10),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        marginBottom: SPACING.xs,
      } : {},
      android: {},
    }),
  },
  refText: { 
    fontSize: FONTS.compact.small, 
    fontWeight: '700', 
    color: '#6B7280' 
  },
  statusBadge: { 
    paddingHorizontal: responsiveSize(6, 8), 
    paddingVertical: responsiveSize(2, 3), 
    borderRadius: BORDER_RADIUS.md 
  },
  statusText: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.tiny, 
    fontWeight: '600', 
    textTransform: 'uppercase' 
  },
  body: { 
    marginBottom: responsiveSize(10, 12) 
  },
  name: { 
    fontSize: FONTS.compact.subtitle, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: SPACING.xs 
  },
  address: { 
    fontSize: FONTS.compact.caption, 
    color: '#4B5563', 
    marginBottom: SPACING.xs 
  },
  descriptionContainer: { 
    backgroundColor: '#FEF3C7', 
    padding: responsiveSize(6, 8), 
    borderRadius: BORDER_RADIUS.sm, 
    marginBottom: SPACING.xs,
    borderLeftWidth: 2,
    borderLeftColor: '#F59E0B',
  },
  descriptionLabel: { 
    fontSize: FONTS.compact.tiny, 
    fontWeight: '700', 
    color: '#92400E', 
    marginBottom: 2,
  },
  descriptionText: { 
    fontSize: FONTS.compact.caption, 
    color: '#78350F', 
    fontWeight: '500',
    lineHeight: 14,
  },
  driverRow: { flexDirection: 'row', alignItems: 'center', marginTop: SPACING.xs, backgroundColor: '#EFF6FF', padding: responsiveSize(4, 6), borderRadius: BORDER_RADIUS.sm },
  driverLabel: { fontSize: FONTS.compact.tiny, color: '#1E40AF', fontWeight: '600', marginRight: SPACING.xs },
  driverName: { fontSize: FONTS.compact.tiny, color: '#1D4ED8', fontWeight: '700' },
  date: { fontSize: FONTS.compact.tiny, color: '#9CA3AF', fontStyle: 'italic' },
  reasonText: { fontSize: FONTS.compact.tiny, color: '#EF4444', fontStyle: 'italic', marginTop: 2, fontWeight: '600' },
  phoneSection: { marginTop: SPACING.sm, gap: SPACING.xs },
  phoneRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    paddingVertical: responsiveSize(4, 6),
    paddingHorizontal: responsiveSize(8, 10),
    borderRadius: BORDER_RADIUS.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  phoneNumber: { 
    fontSize: FONTS.compact.body, 
    fontWeight: '600', 
    color: '#111827',
    flex: 1,
  },
  phoneActions: { 
    flexDirection: 'row', 
    gap: SPACING.xs,
  },
  iconBtn: { 
    backgroundColor: '#FFFFFF',
    width: responsiveSize(28, 32),
    height: responsiveSize(28, 32),
    borderRadius: responsiveSize(14, 16),
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  iconText: { 
    fontSize: FONTS.compact.small,
  },
  phoneContainer: { flexDirection: 'row', gap: 8, marginTop: 8 },
  phoneBtn: { backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  phoneText: { color: '#2563EB', fontSize: 13, fontWeight: '600' },
  mapBtn: { 
    backgroundColor: '#10B981', 
    paddingVertical: responsiveSize(8, 10), 
    paddingHorizontal: responsiveSize(10, 12),
    borderRadius: BORDER_RADIUS.sm, 
    marginTop: SPACING.sm,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  mapContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  mapIcon: {
    fontSize: FONTS.compact.body,
  },
  mapText: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.caption, 
    fontWeight: '700',
  },
  footer: { flexDirection: 'row', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: responsiveSize(8, 10), justifyContent: 'space-between' },
  priceLabel: { fontSize: FONTS.compact.caption, color: '#6B7280', marginRight: SPACING.xs },
  priceValue: { fontSize: FONTS.compact.subtitle, fontWeight: '800', color: '#111827', marginRight: SPACING.xs },
  paidBadge: { backgroundColor: '#DEF7EC', paddingHorizontal: responsiveSize(6, 8), paddingVertical: responsiveSize(2, 3), borderRadius: BORDER_RADIUS.sm },
  paidText: { color: '#03543F', fontSize: FONTS.compact.tiny, fontWeight: '700' },
  actionsContainer: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: { backgroundColor: '#3B82F6', paddingHorizontal: responsiveSize(8, 10), paddingVertical: responsiveSize(6, 8), borderRadius: BORDER_RADIUS.sm },
  actionBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  acceptBtn: { backgroundColor: '#10B981', paddingHorizontal: responsiveSize(8, 10), paddingVertical: responsiveSize(6, 8), borderRadius: BORDER_RADIUS.sm },
  deliverBtn: { backgroundColor: '#10B981', paddingHorizontal: responsiveSize(8, 10), paddingVertical: responsiveSize(6, 8), borderRadius: BORDER_RADIUS.sm },
  returnBtn: { backgroundColor: '#EF4444', paddingHorizontal: responsiveSize(8, 10), paddingVertical: responsiveSize(6, 8), borderRadius: BORDER_RADIUS.sm },
  actionBtnText: { color: '#FFFFFF', fontSize: FONTS.compact.tiny, fontWeight: '700' },
});
