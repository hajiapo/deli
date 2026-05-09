import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getActiveDrivers, DRIVER_CREDENTIALS } from '../config/credentials';
import { DriverListScreenProps } from '../types/navigation';
import { 
  SPACING, 
  FONTS, 
  BORDER_RADIUS,
  responsiveSize 
} from '../utils/responsive';

export default function DriverListScreen({ navigation, route }: DriverListScreenProps) {
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [firebaseAvailable, setFirebaseAvailable] = useState(true);
  const [showPrestoredDrivers, setShowPrestoredDrivers] = useState(false);
  const [prestoredDrivers, setPrestoredDrivers] = useState<any[]>([]);
  const [assigning, setAssigning] = useState(false);

  // Check if we're in assignment mode
  const isAssignmentMode = route?.params?.mode === 'assign';
  const packageId = route?.params?.packageId;
  const onAssign = route?.params?.onAssign;

  useEffect(() => {
    let isSubscribed = true;

    const loadAllDrivers = async () => {
      try {
        // 1. Try to load drivers from local storage first
        const { getDriversLocally } = await import('../utils/localDatabase');
        const localDrivers = await getDriversLocally();
        
        // 2. Load active pre-stored drivers
        const activeStored = getActiveDrivers();
        const storedWithDetails = activeStored.map(d => ({
          ...d,
          name: `Livreur ${d.id.split('-')[1]}`,
          vehicle_type: 'Non spécifié',
          phone: 'Non spécifié',
          pin_code: '****', // Never expose actual PINs
          source: 'stored'
        }));

        // 3. Remove duplicates - prioritize local drivers over pre-stored generic ones
        const uniqueLocalDrivers: any[] = [];
        const seenIds = new Set<string>();
        
        console.log(`📱 Loaded ${localDrivers.length} drivers from local storage`);
        console.log(`📋 Loaded ${storedWithDetails.length} pre-stored drivers`);
        
        // First add local drivers (admin-created with real data)
        localDrivers.forEach(driver => {
          if (!seenIds.has(driver.id)) {
            seenIds.add(driver.id);
            uniqueLocalDrivers.push(driver);
          }
        });
        
        // Then add pre-stored drivers ONLY if they don't conflict with local drivers
        storedWithDetails.forEach(storedDriver => {
          if (!seenIds.has(storedDriver.id)) {
            seenIds.add(storedDriver.id);
            uniqueLocalDrivers.push(storedDriver);
          } else {
            console.log(`⚠️ Skipping duplicate pre-stored ID: ${storedDriver.id} (already exists as local driver)`);
          }
        });
        
        console.log(`📊 Unique local drivers: ${uniqueLocalDrivers.length}`);
        
        // 4. Try Firebase for real-time updates
        try {
          const { getFirestore, collection, onSnapshot } = require('firebase/firestore');
          
          // Get the Firebase app from React Native Firebase
          const { default: app } = require('@react-native-firebase/app');
          const db = getFirestore(app);
          
          console.log('🔍 Attempting to connect to Firebase Firestore...');
          
          const unsubscribe = onSnapshot(
            collection(db, 'drivers'),
            (snapshot: any) => {
              if (!isSubscribed) return;
              const fetchedDrivers: any[] = [];
              if (snapshot) {
                snapshot.forEach((doc: any) => {
                  const driverData = doc.data();
                  // Include all drivers, but mark inactive ones
                  // Default is_active to true if field doesn't exist
                  const isActive = driverData.is_active !== undefined ? driverData.is_active : true;
                  
                  // Only include drivers that are active (or have no is_active field)
                  if (isActive) {
                    // Ensure all required fields exist with defaults
                    const normalizedDriver = {
                      id: doc.id,
                      name: driverData.name || `Driver ${doc.id}`,
                      phone: driverData.phone || 'Non spécifié',
                      vehicle_type: driverData.vehicle_type || 'Moto',
                      pin_code: driverData.pin_code || '****',
                      is_active: isActive,
                      created_at: driverData.created_at || new Date().toISOString(),
                      source: 'firebase',
                      ...driverData // Keep any additional fields
                    };
                    
                    fetchedDrivers.push(normalizedDriver);
                  } else {
                    console.log(`⚠️ Skipping inactive driver: ${doc.id}`);
                  }
                });
              }
              
              console.log(`✅ Loaded ${fetchedDrivers.length} drivers from Firebase`);
              if (fetchedDrivers.length > 0) {
                console.log('Firebase drivers:', fetchedDrivers.map(d => ({ id: d.id, name: d.name, is_active: d.is_active })));
              }
              
              // Merge Firebase drivers with local drivers
              // Start with Firebase drivers (most authoritative)
              const mergedDrivers = [...fetchedDrivers];
              const firebaseIds = new Set(fetchedDrivers.map(d => d.id));
              
              // Add local drivers that aren't in Firebase
              uniqueLocalDrivers.forEach(localDriver => {
                if (!firebaseIds.has(localDriver.id)) {
                  mergedDrivers.push(localDriver);
                } else {
                  console.log(`⚠️ Skipping local driver ${localDriver.id} (already in Firebase)`);
                }
              });
              
              console.log(`📊 Total drivers: ${mergedDrivers.length} (${fetchedDrivers.length} Firebase + ${mergedDrivers.length - fetchedDrivers.length} local)`);
              setDrivers(mergedDrivers);
              setFirebaseAvailable(true); // Mark Firebase as available
              setLoading(false);
            },
            (error: any) => {
              console.error('❌ Firebase Firestore error:', error);
              console.log('Error code:', error.code);
              console.log('Error message:', error.message);
              console.log('Firebase unavailable, using local drivers only');
              setFirebaseAvailable(false);
              // Use unique local drivers as fallback
              setDrivers(uniqueLocalDrivers);
              setLoading(false);
            }
          );

          return () => {
            isSubscribed = false;
            unsubscribe();
          };
        } catch (firebaseError) {
          console.log('Firebase initialization failed:', firebaseError);
          setFirebaseAvailable(false);
          setDrivers(uniqueLocalDrivers);
          setLoading(false);
          return () => {
            isSubscribed = false;
          };
        }
      } catch (error) {
        console.error('Error loading drivers:', error);
        setLoading(false);
        return () => {
          isSubscribed = false;
        };
      }
    };

    loadAllDrivers();
  }, []);

  const handleModifyDriver = (driver: any) => {
    // Navigate to modify screen with driver data
    navigation.navigate('ModifyDriver', { driver });
  };

  const handleRemoveDriver = (driver: any) => {
    Alert.alert(
      "Confirmer la suppression",
      `Voulez-vous vraiment supprimer le livreur "${driver.name}" (${driver.id}) ?`,
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive",
          onPress: () => confirmRemoveDriver(driver)
        }
      ]
    );
  };

  const confirmRemoveDriver = async (driver: any) => {
    try {
      console.log('Removing driver:', driver.id);
      
      // 1. Try to mark as inactive in Firebase instead of deleting
      if (firebaseAvailable) {
        try {
          const { getFirestore, doc, updateDoc } = require('firebase/firestore');
          
          // Get the Firebase app from React Native Firebase
          const { default: app } = require('@react-native-firebase/app');
          const db = getFirestore(app);
          // Mark driver as inactive instead of deleting
          await updateDoc(doc(db, 'drivers', driver.id), {
            is_active: false,
            deleted_at: new Date().toISOString(),
            deleted_by: 'admin'
          });
          console.log('✅ Driver marked as inactive in Firebase');
        } catch (firebaseError) {
          console.log('Could not update driver in Firebase:', firebaseError);
          // If update fails, try to delete as fallback
          try {
            const { getFirestore, doc, deleteDoc } = require('firebase/firestore');
            
            // Get the Firebase app from React Native Firebase
            const { default: app } = require('@react-native-firebase/app');
            const db = getFirestore(app);
            await deleteDoc(doc(db, 'drivers', driver.id));
            console.log('✅ Driver deleted from Firebase (fallback)');
          } catch (deleteError) {
            console.log('Could not delete from Firebase either:', deleteError);
          }
        }
      }
      
      // 2. Remove from local storage
      try {
        const { removeDriverLocally } = await import('../utils/localDatabase');
        await removeDriverLocally(driver.id);
        console.log('✅ Driver removed from local storage');
      } catch (localError) {
        console.warn('⚠️ Could not remove from local storage:', localError);
      }
      
      // 3. If it's a pre-stored driver, deactivate it
      if (driver.id.startsWith('DRV-')) {
        const { deactivateDriverId } = await import('../config/credentials');
        deactivateDriverId(driver.id);
        console.log('✅ Pre-stored driver deactivated');
      }
      
      // 4. For admin-created drivers, also remove from credentials if present
      if (driver.id.startsWith('ADM-')) {
        try {
          const { DRIVER_CREDENTIALS } = require('../config/credentials');
          // Find and remove admin-created driver from credentials array
          const driverIndex = DRIVER_CREDENTIALS.findIndex((d: any) => d.id === driver.id);
          if (driverIndex !== -1) {
            DRIVER_CREDENTIALS.splice(driverIndex, 1);
            console.log('✅ Admin-created driver removed from credentials');
          }
        } catch (credError) {
          console.warn('⚠️ Could not remove from credentials:', credError);
        }
      }
      
      // 5. Update UI by removing from state
      setDrivers(prevDrivers => prevDrivers.filter(d => d.id !== driver.id));
      
      Alert.alert("Succès", "Livreur supprimé avec succès");
    } catch (error) {
      console.error('❌ Error removing driver:', error);
      Alert.alert("Erreur", "Impossible de supprimer le livreur");
    }
  };

  const handleAssignToDriver = async (driverId: string) => {
    if (!packageId || !onAssign) return;
    
    setAssigning(true);
    try {
      await onAssign(driverId);
      Alert.alert("Succès", "Colis assigné avec succès");
      navigation.goBack();
    } catch (error) {
      console.error('Error assigning package:', error);
      Alert.alert("Erreur", "Impossible d'assigner le colis");
    } finally {
      setAssigning(false);
    }
  };

  const loadPrestoredDrivers = () => {
    // Load all prestored drivers from credentials
    const allPrestored = DRIVER_CREDENTIALS.map(d => ({
      ...d,
      name: `Livreur ${d.id.split('-')[1]}`,
      vehicle_type: 'Non spécifié',
      phone: 'Non spécifié',
      pin_code: '****',
      source: 'prestored',
      status: d.is_active ? 'Actif' : 'Inactif'
    }));
    
    setPrestoredDrivers(allPrestored);
    setShowPrestoredDrivers(true);
  };


  const activatePrestoredDriver = (driverId: string) => {
    const { activateDriverId } = require('../config/credentials');
    const success = activateDriverId(driverId);
    
    if (success) {
      Alert.alert("Succès", `Livreur ${driverId} activé`);
      // Update the prestored drivers list
      const updated = prestoredDrivers.map(d => 
        d.id === driverId ? { ...d, is_active: true, status: 'Actif' } : d
      );
      setPrestoredDrivers(updated);
    } else {
      Alert.alert("Erreur", "Impossible d'activer ce livreur");
    }
  };

  const renderDriverCard = ({ item }: { item: any }) => (
    <View style={[styles.card, !firebaseAvailable && styles.cardStored]}>
      <View style={styles.cardHeader}>
        <Text style={styles.driverName}>{item.name}</Text>
        <View style={[styles.badge, item.source === 'stored' && styles.badgeStored]}>
          <Text style={styles.badgeText}>{item.vehicle_type}</Text>
        </View>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>ID Connexion:</Text>
        <Text style={styles.infoValue} selectable={true}>{item.id}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>Code PIN:</Text>
        <Text style={[styles.infoValue, { fontWeight: '800', color: '#3B82F6' }]}>{item.pin_code || 'N/A'}</Text>
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.infoLabel}>Téléphone:</Text>
        <Text style={styles.infoValue}>{item.phone}</Text>
      </View>
      
      {/* Action Buttons */}
      {isAssignmentMode ? (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.modifyButton, assigning && { opacity: 0.6 }]}
            onPress={() => handleAssignToDriver(item.id)}
            disabled={assigning}
          >
            {assigning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.actionButtonText}>🚚 Assigner</Text>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.modifyButton]}
            onPress={() => handleModifyDriver(item)}
          >
            <Text style={styles.actionButtonText}>✏️ Modifier</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, styles.removeButton]}
            onPress={() => handleRemoveDriver(item)}
          >
            <Text style={styles.actionButtonText}>🗑️ Supprimer</Text>
          </TouchableOpacity>
        </View>
      )}
      
      {item.source === 'stored' && (
        <View style={styles.sourceIndicator}>
          <Text style={styles.sourceText}>📱 Mode Hors Ligne</Text>
          {(!item.name || item.name.startsWith('Livreur ')) && (
            <Text style={styles.warningText}>⚠️ Ajouter nom/téléphone</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Livreurs (Équipe)</Text>
        <TouchableOpacity onPress={loadPrestoredDrivers} style={styles.prestoredBtn}>
          <Text style={styles.prestoredBtnText}>📋 IDs</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
      ) : (
        <FlatList
          data={drivers}
          keyExtractor={(item) => `${item.id}-${item.source || 'unknown'}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderDriverCard}
          ListEmptyComponent={() => (
            <View style={styles.center}>
              <Text style={styles.emptyText}>Aucun livreur trouvé.</Text>
            </View>
          )}
        />
      )}

      <View style={styles.footer}>
        {!firebaseAvailable && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>⚠️ Firebase indisponible - Mode hors ligne activé</Text>
          </View>
        )}
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('AddDriver')}>
          <Text style={styles.addBtnText}>+ Nouveau Livreur</Text>
        </TouchableOpacity>
      </View>

      {/* Modal for Prestored Drivers */}
      <Modal
        visible={showPrestoredDrivers}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPrestoredDrivers(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>📋 IDs Livreurs Pré-enregistrés</Text>
              <TouchableOpacity onPress={() => setShowPrestoredDrivers(false)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.modalSubtitle}>
              {DRIVER_CREDENTIALS.length} IDs disponibles (DRV-001 à DRV-020)
            </Text>
            
            <FlatList
              data={prestoredDrivers}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.prestoredListContent}
              renderItem={({ item }) => (
                <View style={[
                  styles.prestoredCard,
                  item.is_active ? styles.prestoredCardActive : styles.prestoredCardInactive
                ]}>
                  <View style={styles.prestoredCardHeader}>
                    <Text style={styles.prestoredDriverId}>{item.id}</Text>
                    <View style={[
                      styles.statusBadge,
                      item.is_active ? styles.statusBadgeActive : styles.statusBadgeInactive
                    ]}>
                      <Text style={[
                        styles.statusBadgeText,
                        { color: item.is_active ? '#065F46' : '#92400E' }
                      ]}>{item.status}</Text>
                    </View>
                  </View>
                  
                  <View style={styles.prestoredCardBody}>
                    <Text style={styles.prestoredInfoLabel}>Nom:</Text>
                    <Text style={styles.prestoredInfoValue}>{item.name}</Text>
                  </View>
                  
                  <View style={styles.prestoredCardBody}>
                    <Text style={styles.prestoredInfoLabel}>Code PIN:</Text>
                    <Text style={[styles.prestoredInfoValue, { fontWeight: '800', color: '#3B82F6' }]}>
                      {item.id.split('-')[1].padStart(4, '0')}
                    </Text>
                  </View>
                  
                  <View style={styles.prestoredCardBody}>
                    <Text style={styles.prestoredInfoLabel}>Statut:</Text>
                    <Text style={styles.prestoredInfoValue}>
                      {item.is_active ? '✅ Actif (déjà utilisé)' : '⏳ Inactif (disponible)'}
                    </Text>
                  </View>
                  
                  {!item.is_active && (
                    <TouchableOpacity 
                      style={styles.activateBtn}
                      onPress={() => activatePrestoredDriver(item.id)}
                    >
                      <Text style={styles.activateBtnText}>Activer cet ID</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={styles.center}>
                  <Text style={styles.emptyText}>Aucun ID pré-enregistré trouvé.</Text>
                </View>
              )}
            />
            
            <View style={styles.modalFooter}>
              <Text style={styles.modalNote}>
                Note: Les IDs inactifs peuvent être activés et assignés à des livreurs.
                Les PINs sont: 0001 pour DRV-001, 0002 pour DRV-002, etc.
              </Text>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: responsiveSize(12, 14), backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backBtn: { paddingVertical: responsiveSize(6, 8), paddingRight: SPACING.xs },
  backText: { color: '#3B82F6', fontSize: FONTS.compact.body, fontWeight: '600' },
  headerTitle: { fontSize: FONTS.compact.subtitle, fontWeight: '700', color: '#111827' },
  listContent: { padding: SPACING.md, paddingBottom: responsiveSize(80, 100) },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: responsiveSize(20, 30) },
  emptyText: { color: '#6B7280', fontSize: FONTS.compact.body },
  
  card: { backgroundColor: '#FFFFFF', borderRadius: BORDER_RADIUS.responsive.card, padding: responsiveSize(10, 12), marginBottom: responsiveSize(8, 10), borderWidth: 1, borderColor: '#F3F4F6' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: responsiveSize(8, 10) },
  driverName: { fontSize: FONTS.compact.subtitle, fontWeight: '700', color: '#111827' },
  badge: { backgroundColor: '#E0E7FF', paddingHorizontal: responsiveSize(6, 8), paddingVertical: responsiveSize(2, 3), borderRadius: BORDER_RADIUS.md },
  badgeText: { color: '#3730A3', fontSize: FONTS.compact.tiny, fontWeight: '600' },
  cardBody: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: responsiveSize(4, 6) },
  infoLabel: { color: '#6B7280', fontSize: FONTS.compact.caption },
  infoValue: { color: '#111827', fontSize: FONTS.compact.caption, fontWeight: '600' },
  
  footer: { padding: responsiveSize(12, 16), paddingBottom: responsiveSize(30, 40), backgroundColor: '#F9FAFB', borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  addBtn: { backgroundColor: '#10B981', paddingVertical: responsiveSize(8, 10), paddingHorizontal: responsiveSize(16, 20), borderRadius: BORDER_RADIUS.md, alignItems: 'center', alignSelf: 'center', marginBottom: responsiveSize(12, 16) },
  addBtnText: { color: '#FFFFFF', fontSize: FONTS.compact.body, fontWeight: '600' },
  
  // Firebase fallback styles
  cardStored: { borderColor: '#FEF3C7', backgroundColor: '#FFFBEB' },
  badgeStored: { backgroundColor: '#FEF3C7' },
  sourceIndicator: { marginTop: 8, alignItems: 'center' },
  sourceText: { fontSize: 12, color: '#D97706', fontWeight: '600' },
  warningBanner: { backgroundColor: '#FEF3C7', padding: 12, borderRadius: 8, marginBottom: 16 },
  warningText: { color: '#D97706', fontSize: 14, fontWeight: '600', textAlign: 'center' },
  
  // Action buttons
  actionButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 12,
    gap: 8
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  modifyButton: {
    backgroundColor: '#3B82F6',
  },
  removeButton: {
    backgroundColor: '#EF4444',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },

  // Prestored drivers button
  prestoredBtn: {
    paddingVertical: responsiveSize(6, 8),
    paddingHorizontal: responsiveSize(10, 12),
    backgroundColor: '#8B5CF6',
    borderRadius: BORDER_RADIUS.md,
  },
  prestoredBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.compact.caption,
    fontWeight: '600',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.responsive.card,
    width: '90%',
    maxHeight: '80%',
    padding: responsiveSize(16, 20),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(12, 16),
  },
  modalTitle: {
    fontSize: FONTS.compact.subtitle,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  closeBtn: {
    padding: responsiveSize(4, 6),
  },
  closeBtnText: {
    fontSize: FONTS.compact.subtitle,
    color: '#6B7280',
    fontWeight: '700',
  },
  modalSubtitle: {
    fontSize: FONTS.compact.caption,
    color: '#6B7280',
    marginBottom: responsiveSize(16, 20),
    textAlign: 'center',
  },
  prestoredListContent: {
    paddingBottom: responsiveSize(16, 20),
  },
  prestoredCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BORDER_RADIUS.responsive.card,
    padding: responsiveSize(10, 12),
    marginBottom: responsiveSize(8, 10),
    borderWidth: 1,
  },
  prestoredCardActive: {
    borderColor: '#D1FAE5',
    backgroundColor: '#ECFDF5',
  },
  prestoredCardInactive: {
    borderColor: '#FEF3C7',
    backgroundColor: '#FFFBEB',
  },
  prestoredCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSize(8, 10),
  },
  prestoredDriverId: {
    fontSize: FONTS.compact.body,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    paddingHorizontal: responsiveSize(6, 8),
    paddingVertical: responsiveSize(2, 3),
    borderRadius: BORDER_RADIUS.md,
  },
  statusBadgeActive: {
    backgroundColor: '#D1FAE5',
  },
  statusBadgeInactive: {
    backgroundColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: FONTS.compact.tiny,
    fontWeight: '600',
  },
  prestoredCardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSize(4, 6),
  },
  prestoredInfoLabel: {
    color: '#6B7280',
    fontSize: FONTS.compact.caption,
  },
  prestoredInfoValue: {
    color: '#111827',
    fontSize: FONTS.compact.caption,
    fontWeight: '600',
  },
  activateBtn: {
    backgroundColor: '#10B981',
    paddingVertical: responsiveSize(6, 8),
    paddingHorizontal: responsiveSize(12, 16),
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
    marginTop: responsiveSize(8, 10),
  },
  activateBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.compact.caption,
    fontWeight: '600',
  },
  modalFooter: {
    marginTop: responsiveSize(16, 20),
    paddingTop: responsiveSize(12, 16),
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  modalNote: {
    fontSize: FONTS.compact.tiny,
    color: '#6B7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
