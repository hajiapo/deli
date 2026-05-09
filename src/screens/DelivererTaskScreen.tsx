import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, Alert, Modal, TextInput, ToastAndroid, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import PackageCard from '../components/PackageCard';
import useAuthStore from '../store/useAuthStore';
import { DelivererTaskScreenProps } from '../types/navigation';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import { updatePackage } from '../utils/localDatabase';
import { showExportOptions } from '../utils/offlineExport';
import { getStatusColor } from '../utils/statusColors';
import { 
  Responsive, 
  deviceType, 
  orientation, 
  SPACING, 
  FONTS, 
  DIMENSIONS, 
  LAYOUT, 
  RESPONSIVE_SHADOWS, 
  BORDER_RADIUS,
  responsiveFontSize,
  responsivePadding,
  responsiveSize 
} from '../utils/responsive';

export default function DelivererTaskScreen({ navigation }: DelivererTaskScreenProps) {
  const { driverId, logout } = useAuthStore();
  
  // Use local database hook - drivers only sync their packages
  const { 
    packages: localPackages, 
    loading, 
    syncing, 
    lastSync,
    pendingSyncCount,
    refresh,
    updatePackageStatus 
  } = useLocalDatabase({ driverId: driverId || undefined, isAdmin: false });

  // Return Modal State
  const [returnModalVisible, setReturnModalVisible] = useState(false);
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState('');
  const [returnReasonError, setReturnReasonError] = useState('');
  const [returningPackageId, setReturningPackageId] = useState<string | null>(null);

  // Expanded package state
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(null);

  // Sort packages by status
  const packages = [...localPackages].sort((a, b) => {
    const statusOrder: Record<string, number> = {
      'Assigned': 1,
      'In Transit': 2,
      'Returned': 3,
      'Delivered': 4,
      'Archived': 5
    };
    return (statusOrder[a.status] || 99) - (statusOrder[b.status] || 99);
  });

  const handleAcceptTask = async (pkgId: string) => {
    Alert.alert(
      "Confirmation d'acceptation",
      "Voulez-vous accepter cette mission de livraison ?",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Accepter", 
          onPress: async () => {
            try {
              await updatePackageStatus(pkgId, 'In Transit', {
                accepted_at: new Date().toISOString(),
              });
              ToastAndroid.show('Mission acceptée avec succès', ToastAndroid.SHORT);
            } catch (error) {
              console.error('Accept task error:', error);
              Alert.alert("Erreur", "Impossible d'accepter la mission. Vérifiez votre connexion.");
            }
          }
        }
      ]
    );
  };

  const handleDeliverTask = async (pkgId: string) => {
    try {
      await updatePackageStatus(pkgId, 'Delivered', {
        delivered_at: new Date().toISOString(),
      });
      ToastAndroid.show('✅ Colis livré avec succès', ToastAndroid.SHORT);
    } catch (error) {
      Alert.alert("Erreur", "Impossible de valider la livraison. Réessayez.");
    }
  };

  // Phone call functionality
  const makePhoneCall = (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    const phoneUrl = `tel:${phoneNumber}`;
    Linking.canOpenURL(phoneUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(phoneUrl);
        } else {
          Alert.alert("Erreur", "Impossible d'ouvrir l'application téléphone");
        }
      })
      .catch((error) => {
        console.error('Phone call error:', error);
        Alert.alert("Erreur", "Impossible d'effectuer l'appel");
      });
  };

  // WhatsApp functionality
  const openWhatsApp = (phoneNumber: string) => {
    if (!phoneNumber) return;
    
    // Remove all non-numeric characters for WhatsApp
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const whatsappUrl = `https://wa.me/${cleanPhone}`;
    
    Linking.canOpenURL(whatsappUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(whatsappUrl);
        } else {
          Alert.alert("Erreur", "WhatsApp n'est pas installé");
        }
      })
      .catch((error) => {
        console.error('WhatsApp error:', error);
        Alert.alert("Erreur", "Impossible d'ouvrir WhatsApp");
      });
  };

  // GPS/Maps functionality
  const openMaps = (address: string, lat?: number, lng?: number) => {
    let mapsUrl: string;
    
    if (lat && lng) {
      // Use coordinates if available
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
    } else if (address) {
      // Use address if no coordinates
      const encodedAddress = encodeURIComponent(address);
      mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;
    } else {
      Alert.alert("Erreur", "Aucune adresse disponible");
      return;
    }
    
    Linking.canOpenURL(mapsUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(mapsUrl);
        } else {
          Alert.alert("Erreur", "Impossible d'ouvrir l'application cartes");
        }
      })
      .catch((error) => {
        console.error('Maps error:', error);
        Alert.alert("Erreur", "Impossible d'ouvrir les cartes");
      });
  };

  const openReturnModal = (pkgId: string) => {
    // Keep clean separation: only reset when opening a new package modal
    setSelectedPackageId(pkgId);
    setReturnReason('');
    setReturnReasonError('');
    setReturnModalVisible(true);
  };

  const handleConfirmReturn = async () => {
    // Clear previous errors
    setReturnReasonError('');

    // Validate return reason
    if (!returnReason.trim()) {
      setReturnReasonError('Veuillez indiquer une raison de retour');
      ToastAndroid.show('Veuillez indiquer une raison de retour', ToastAndroid.SHORT);
      return;
    }

    if (returnReason.trim().length < 5) {
      setReturnReasonError('La raison doit contenir au moins 5 caractères');
      ToastAndroid.show('Raison trop courte', ToastAndroid.SHORT);
      return;
    }

    if (!selectedPackageId) {
      Alert.alert('Erreur', 'Aucun colis sélectionné');
      return;
    }

    setReturningPackageId(selectedPackageId);
    
    try {
      await updatePackageStatus(selectedPackageId, 'Returned', {
        return_reason: returnReason.trim(),
        delivered_at: new Date().toISOString(), // Mark as processed
      });
      
      ToastAndroid.show('📦 Colis retourné avec succès', ToastAndroid.SHORT);
      setReturnModalVisible(false);
      setReturnReason('');
      setSelectedPackageId(null);
    } catch (error) {
      console.error('Return package error:', error);
      Alert.alert('Erreur', 'Impossible de traiter le retour. Réessayez.');
    } finally {
      setReturningPackageId(null);
    }
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  const handleExport = () => {
    if (packages.length === 0) {
      Alert.alert('Aucun colis', 'Vous n\'avez aucun colis à exporter.');
      return;
    }
    
    // Show export options
    showExportOptions(packages, `Driver_${driverId}`);
  };

  // Cash to collect (Only counts delivered packages)
  const cashToCollect = packages
    .filter(p => p.status === 'Delivered')
    .filter(p => !p.is_paid)
    .reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  // Total delivered packages count
  const deliveredCount = packages.filter(p => p.status === 'Delivered').length;

  // Total delivered revenue (sum of all delivered packages)
  const deliveredRevenue = packages
    .filter(p => p.status === 'Delivered')
    .reduce((sum, pkg) => sum + (pkg.price || 0), 0);

  const toggleExpand = (pkgId: string) => {
    setExpandedPackageId(expandedPackageId === pkgId ? null : pkgId);
  };

  // Translate status to French for display
  const translateStatus = (status: string): string => {
    const statusTranslations: Record<string, string> = {
      'Pending': 'En attente',
      'Assigned': 'Assigné',
      'In Transit': 'En cours',
      'Delivered': 'Livré',
      'Returned': 'Retourné',
      'Archived': 'Archivé'
    };
    return statusTranslations[status] || status;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Mes Missions</Text>
            {/* Sync Status Indicator */}
            <View style={styles.syncStatus}>
              {syncing ? (
                <View style={styles.syncIndicator}>
                  <ActivityIndicator size="small" color="#10B981" />
                  <Text style={styles.syncText}>Synchronisation...</Text>
                </View>
              ) : pendingSyncCount > 0 ? (
                <View style={styles.syncIndicator}>
                  <Text style={styles.syncDot}>⚠️</Text>
                  <Text style={styles.syncText}>{pendingSyncCount} en attente</Text>
                </View>
              ) : lastSync ? (
                <View style={styles.syncIndicator}>
                  <Text style={styles.syncDot}>✓</Text>
                  <Text style={styles.syncText}>Synchronisé</Text>
                </View>
              ) : null}
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleExport} style={styles.exportBtn}>
              <Text style={styles.exportText}>📤</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={refresh} style={styles.refreshBtn} disabled={syncing}>
              <Text style={styles.refreshText}>{syncing ? '⟳' : '↻'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
              <Text style={styles.logoutText}>Déconnexion</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.cashBox}>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Total Colis</Text>
              <Text style={styles.statValue}>{packages.length}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Livrés</Text>
              <Text style={styles.statValue}>{deliveredCount}</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Revenu Total</Text>
              <Text style={styles.statValue}>{deliveredRevenue.toFixed(2)} DH</Text>
            </View>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      ) : packages.length === 0 ? (
        <View style={styles.center}><Text style={styles.emptyText}>Aucune mission assignée pour le moment.</Text></View>
      ) : (
        <FlatList
          data={packages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => (
            <View style={styles.numberedItem}>
              {/* Simple Numbered Line */}
              <TouchableOpacity 
                style={styles.numberedLine}
                onPress={() => toggleExpand(item.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.lineNumber}>{index + 1}.</Text>
                <View style={styles.lineInfo}>
                  <Text style={styles.lineText}>{item.ref_number} - {item.customer_name || 'Client'}</Text>
                  <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) }]}>
                    <Text style={styles.statusText}>{translateStatus(item.status)}</Text>
                  </View>
                </View>
                <Text style={styles.expandIcon}>{expandedPackageId === item.id ? '▼' : '▶'}</Text>
              </TouchableOpacity>

              {/* Expanded Details - Show on Tap */}
              {expandedPackageId === item.id && (
                <View style={styles.expandedDetails}>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailTitle}>📦 Détails du Colis</Text>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Référence:</Text>
                      <Text style={styles.detailValue}>{item.ref_number}</Text>
                    </View>
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Client:</Text>
                      <Text style={styles.detailValue}>{item.customer_name || 'Non spécifié'}</Text>
                    </View>
                    
                    {/* Address with GPS button */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Adresse:</Text>
                      <View style={styles.addressRow}>
                        <Text style={styles.detailValue}>{item.customer_address || 'Non spécifiée'}</Text>
                        {(item.customer_address || (item.gps_lat && item.gps_lng)) && (
                          <TouchableOpacity 
                            style={styles.gpsBtn} 
                            onPress={() => openMaps(item.customer_address || '', item.gps_lat, item.gps_lng)}
                          >
                            <Text style={styles.gpsBtnText}>🗺️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                    
                    {/* Primary Phone with Call & WhatsApp */}
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Téléphone 1:</Text>
                      <View style={styles.phoneRow}>
                        <Text style={styles.detailValue}>{item.customer_phone || 'Non spécifié'}</Text>
                        {item.customer_phone && (
                          <View style={styles.phoneButtons}>
                            <TouchableOpacity 
                              style={styles.callBtn} 
                              onPress={() => makePhoneCall(item.customer_phone!)}
                            >
                              <Text style={styles.callBtnText}>📞</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.whatsappBtn} 
                              onPress={() => openWhatsApp(item.customer_phone!)}
                            >
                              <Text style={styles.whatsappBtnText}>💬</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </View>
                    
                    {/* Secondary Phone with Call & WhatsApp */}
                    {item.customer_phone_2 && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Téléphone 2:</Text>
                        <View style={styles.phoneRow}>
                          <Text style={styles.detailValue}>{item.customer_phone_2}</Text>
                          <View style={styles.phoneButtons}>
                            <TouchableOpacity 
                              style={styles.callBtn} 
                              onPress={() => makePhoneCall(item.customer_phone_2!)}
                            >
                              <Text style={styles.callBtnText}>📞</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                              style={styles.whatsappBtn} 
                              onPress={() => openWhatsApp(item.customer_phone_2!)}
                            >
                              <Text style={styles.whatsappBtnText}>💬</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    )}
                    
                    <View style={styles.detailRow}>
                      <Text style={styles.detailLabel}>Prix:</Text>
                      <Text style={styles.detailValue}>{item.is_paid ? 'Payé' : `${item.price} DH`}</Text>
                    </View>
                    {item.description && (
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Description:</Text>
                        <Text style={styles.detailValue}>{item.description}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.actionSection}>
                    {item.status === 'Assigned' && (
                      <TouchableOpacity 
                        style={[styles.actionBtn, styles.acceptBtn]} 
                        onPress={() => handleAcceptTask(item.id)}
                      >
                        <Text style={styles.actionBtnText}>✅ Accepter Mission</Text>
                      </TouchableOpacity>
                    )}
                    {item.status === 'In Transit' && (
                      <>
                        <TouchableOpacity 
                          style={[styles.actionBtn, styles.deliverBtn]} 
                          onPress={() => handleDeliverTask(item.id)}
                        >
                          <Text style={styles.actionBtnText}>📦 Marquer Livré</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.actionBtn, styles.returnBtn]} 
                          onPress={() => openReturnModal(item.id)}
                        >
                          <Text style={styles.actionBtnText}>🔙 Retourner Colis</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              )}
            </View>
          )}
        />
      )}

      {/* Return Reason Modal */}
      <Modal visible={returnModalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Raison du Retour</Text>
            {selectedPackageId && (
              <Text style={styles.errorText}>
                {returnReason.trim()
                  ? ''
                  : 'Raison rapide: si colis introuvable / non répondant, indiquez-le ici'}
              </Text>
            )}
            <TextInput
              style={[styles.input, returnReasonError ? styles.inputError : null]}
              placeholder="Ex: Client absent, refusé..."
              value={returnReason}
              onChangeText={setReturnReason}
              multiline
            />
            {returnReasonError && <Text style={styles.errorText}>{returnReasonError}</Text>}
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setReturnModalVisible(false); setReturnReason(''); setReturnReasonError(''); }}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.returnConfirmBtn, !!returningPackageId && styles.returnConfirmBtnDisabled]} 
                onPress={handleConfirmReturn}
                disabled={!!returningPackageId}
              >
                {returningPackageId ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.confirmText}>Confirmer le Retour</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#F9FAFB',
  },
  header: { 
    backgroundColor: '#111827', 
    ...DIMENSIONS.header,
    borderBottomLeftRadius: responsiveSize(24, 32), 
    borderBottomRightRadius: responsiveSize(24, 32),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: SPACING.lg,
      } : {},
      android: {},
    }),
  },
  headerTop: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'flex-start', 
    marginBottom: responsiveSize(24, 16),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        marginBottom: 0,
        flex: 1,
      } : {},
      android: {},
    }),
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.heading, 
    fontWeight: '700',
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        fontSize: FONTS.compact.subtitle,
      } : {},
      android: {},
    }),
  },
  headerActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.sm,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        gap: SPACING.md,
      } : {},
      android: {},
    }),
  },
  exportBtn: { 
    padding: responsiveSize(8, 12), 
    backgroundColor: '#8B5CF6', 
    borderRadius: BORDER_RADIUS.responsive.button,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        paddingHorizontal: SPACING.md,
      } : {},
      android: {},
    }),
  },
  exportText: { 
    fontSize: responsiveFontSize(20, 22),
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        fontSize: 18,
      } : {},
      android: {},
    }),
  },
  refreshBtn: { 
    padding: responsiveSize(8, 12) 
  },
  refreshText: { 
    color: '#10B981', 
    fontSize: responsiveFontSize(24, 28), 
    fontWeight: '600' 
  },
  logoutBtn: { 
    padding: responsiveSize(8, 12) 
  },
  logoutText: { 
    color: '#9CA3AF', 
    fontSize: FONTS.responsive.caption 
  },
  syncStatus: { 
    marginTop: SPACING.xs 
  },
  syncIndicator: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: SPACING.xs 
  },
  syncDot: { 
    fontSize: FONTS.responsive.small 
  },
  syncText: { 
    color: '#9CA3AF', 
    fontSize: FONTS.responsive.small, 
    fontWeight: '500' 
  },
  cashBox: { 
    backgroundColor: '#10B981', 
    padding: responsiveSize(12, 14), 
    borderRadius: responsiveSize(12, 14), 
    ...RESPONSIVE_SHADOWS.card,
    marginHorizontal: SPACING.responsive.paddingHorizontal,
    marginBottom: SPACING.sm,
  },
  statsRow: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    alignItems: 'center',
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        justifyContent: 'space-evenly',
        paddingHorizontal: SPACING.md,
      } : {},
      android: {},
    }),
  },
  statItem: { 
    alignItems: 'center', 
    flex: 1,
    ...Platform.select({
      ios: orientation.isLandscape && deviceType.isTablet ? {
        flex: 0,
        paddingHorizontal: SPACING.sm,
      } : {},
      android: {},
    }),
  },
  statLabel: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.tiny, 
    fontWeight: '600', 
    marginBottom: 2, 
    opacity: 0.9 
  },
  statValue: { 
    color: '#FFFFFF', 
    fontSize: FONTS.compact.subtitle, 
    fontWeight: '700' 
  },
  statDivider: { width: 1, height: 40, backgroundColor: '#FFFFFF', opacity: 0.3 },
  listContent: { padding: SPACING.md, paddingBottom: SPACING.xl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: FONTS.compact.body },
  
  // Compact Card Styles
  compactCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  compactHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  compactLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  indexNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: '#6B7280',
    marginRight: 12,
    minWidth: 30,
  },
  compactInfo: {
    flex: 1,
  },
  compactRef: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 2,
  },
  compactCustomer: {
    fontSize: 13,
    color: '#6B7280',
  },
  compactRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  compactStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  compactStatusText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandIcon: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  expandedContent: {
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    padding: 0,
  },
  
  // New Numbered List Styles
  numberedItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  numberedLine: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  lineNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#6B7280',
    marginRight: 12,
    minWidth: 25,
  },
  lineInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  statusIndicator: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  expandedDetails: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  detailSection: {
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    flex: 1,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#111827',
    flex: 2,
    textAlign: 'right',
  },
  actionSection: {
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptBtn: {
    backgroundColor: '#10B981',
  },
  deliverBtn: {
    backgroundColor: '#3B82F6',
  },
  returnBtn: {
    backgroundColor: '#EF4444',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Phone and GPS action styles
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  phoneButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  callBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  callBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  whatsappBtn: {
    backgroundColor: '#25D366',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  whatsappBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  gpsBtn: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 30,
  },
  gpsBtnText: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  
  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16, color: '#111827' },
  input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 12, padding: 16, fontSize: 16, minHeight: 100, textAlignVertical: 'top' },
  inputError: { borderColor: '#EF4444' },
  errorText: { color: '#EF4444', fontSize: 12, marginTop: 4 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, gap: 12 },
  cancelBtn: { padding: 12 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  returnConfirmBtn: { backgroundColor: '#EF4444', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8 },
  returnConfirmBtnDisabled: { backgroundColor: '#9CA3AF', shadowOpacity: 0, elevation: 0 },
  confirmText: { color: '#FFFFFF', fontWeight: '700' },
});
