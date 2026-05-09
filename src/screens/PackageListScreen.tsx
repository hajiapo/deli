import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Modal, ScrollView, Platform, Image, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import PackageCard from '../components/PackageCard';

interface PackageListScreenProps {
  navigation: any;
}

export default function PackageListScreen({ navigation }: PackageListScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [selectedPkg, setSelectedPkg] = useState<any>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  const { packages = [], drivers = [], loading = false, syncing = false, refresh, assignPackageToDriver } = useLocalDatabase({ isAdmin: true });

  useEffect(() => {
    console.log('📋 PackageListScreen mounted');
    console.log('📦 Packages loaded:', packages?.length || 0);
  }, [packages]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleAssignPackage = useCallback(async (packageId: string) => {
    try {
      // Navigate to driver selection screen or show driver picker
      navigation.navigate('DriverList', { 
        mode: 'assign', 
        packageId,
        onAssign: async (driverId: string) => {
          await assignPackageToDriver([packageId], driverId);
          navigation.goBack();
        }
      });
    } catch (err: any) {
      console.error('Error assigning package:', err);
      setError(err?.message || 'Erreur lors de l\'assignation du colis');
    }
  }, [navigation, assignPackageToDriver]);

  // Note: unassign is not implemented in useLocalDatabase currently.
  // Keeping the handler removed to avoid type/runtime issues.


  const filteredPackages = filterStatus === 'all' 
    ? packages
    : packages.filter(p => p.status === filterStatus);

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];
  
  const statusLabels: Record<string, string> = {
    'all': 'Tous',
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
  };

  const getReceiptText = (pkg: any) => {
    return `----------------------------------
DÉTAILS DU COLIS
----------------------------------
RÉFÉRENCE : ${pkg.ref_number}
DATE CRÉA : ${pkg.created_at ? new Date(pkg.created_at).toLocaleDateString('fr-FR') : 'N/A'}
----------------------------------

EXPÉDITEUR
----------
Nom       : ${pkg.sender_name || 'N/A'}
Société   : ${pkg.sender_company || 'N/A'}
Téléphone : ${pkg.sender_phone || 'N/A'}
Date arr. : ${pkg.date_of_arrive || 'N/A'}
Infos supp: ${pkg.supplement_info || 'N/A'}

DESTINATAIRE
------------
Nom       : ${pkg.customer_name || 'N/A'}
Adresse   : ${pkg.customer_address || 'N/A'}
Téléphone : ${pkg.customer_phone || 'N/A'}${pkg.customer_phone_2 ? '\nTél 2     : ' + pkg.customer_phone_2 : ''}
GPS       : ${pkg.gps_lat && pkg.gps_lng ? `${pkg.gps_lat}, ${pkg.gps_lng}` : 'N/A'}

DÉTAILS COLIS
-------------
Poids     : ${pkg.weight || 'N/A'}
Prix      : ${pkg.is_paid ? 'Payé' : ((pkg.price || 0) + ' DH')}
Statut    : ${statusLabels[pkg.status] || pkg.status}
Date lim. : ${pkg.limit_date || 'N/A'}
Notes     : ${pkg.description || 'Aucune'}
----------------------------------`;
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Erreur: {error}</Text>
          <TouchableOpacity 
            style={styles.retryButton} 
            onPress={() => {
              setError(null);
              navigation.goBack();
            }}
          >
            <Text style={styles.retryButtonText}>Retour</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste des Colis</Text>
        <TouchableOpacity onPress={refresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter */}
      <View style={styles.filterBar}>
        {statusOptions.map(status => (
          <TouchableOpacity
            key={status}
            style={[styles.filterBtn, filterStatus === status && styles.filterBtnActive]}
            onPress={() => setFilterStatus(status)}
          >
            <Text style={[styles.filterText, filterStatus === status && styles.filterTextActive]}>
              {statusLabels[status]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>
          Total : <Text style={styles.summaryBold}>{filteredPackages.length}</Text> colis
        </Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : filteredPackages.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>Aucun colis</Text>
        </View>
      ) : (
        <FlatList
          style={styles.list}
          data={filteredPackages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <TouchableOpacity 
              style={styles.packageRow} 
              onPress={() => {
                setSelectedPkg(item);
                setModalVisible(true);
              }}
            >
              <Text style={styles.rowRef}>{item.ref_number}</Text>
              <Text style={styles.rowCustomer} numberOfLines={1}>{item.customer_name || 'Client Inconnu'}</Text>
              <View style={[styles.rowStatusBadge, { backgroundColor: getStatusColor(item.status) }]}>
                <Text style={styles.rowStatusText}>{statusLabels[item.status] || item.status}</Text>
              </View>
            </TouchableOpacity>
          )}
          refreshControl={
            <RefreshControl refreshing={syncing} onRefresh={refresh} colors={['#3B82F6']} />
          }
        />
      )}

      {/* Printable Text Modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Détails à imprimer</Text>
              <View style={styles.headerButtons}>
                <TouchableOpacity 
                  onPress={() => {
                    if (selectedPkg) {
                      Share.share({
                        message: getReceiptText(selectedPkg) + `\n\nQR Code: https://quickchart.io/qr?text=${encodeURIComponent(getReceiptText(selectedPkg))}&size=200`,
                      }).catch(err => console.log(err));
                    }
                  }} 
                  style={[styles.closeBtn, { backgroundColor: '#3B82F6', marginRight: 8 }]}
                >
                  <Text style={styles.closeBtnText}>Imprimer</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                  <Text style={styles.closeBtnText}>Fermer</Text>
                </TouchableOpacity>
              </View>
            </View>
            
            <ScrollView style={styles.printableContainer} contentContainerStyle={{ paddingBottom: 60 }}>
              {selectedPkg && (
                <>
                  <Text selectable={true} style={styles.printableText}>
                    {`----------------------------------
DÉTAILS DU COLIS
----------------------------------
RÉFÉRENCE : ${selectedPkg.ref_number}
DATE CRÉA : ${selectedPkg.created_at ? new Date(selectedPkg.created_at).toLocaleDateString('fr-FR') : 'N/A'}
----------------------------------

EXPÉDITEUR
----------
Nom       : ${selectedPkg.sender_name || 'N/A'}
Société   : ${selectedPkg.sender_company || 'N/A'}
Téléphone : ${selectedPkg.sender_phone || 'N/A'}
Date arr. : ${selectedPkg.date_of_arrive || 'N/A'}
Infos supp: ${selectedPkg.supplement_info || 'N/A'}

DESTINATAIRE
------------
Nom       : ${selectedPkg.customer_name || 'N/A'}
Adresse   : ${selectedPkg.customer_address || 'N/A'}
Téléphone : ${selectedPkg.customer_phone || 'N/A'}${selectedPkg.customer_phone_2 ? '\nTél 2     : ' + selectedPkg.customer_phone_2 : ''}
GPS       : ${selectedPkg.gps_lat && selectedPkg.gps_lng ? `${selectedPkg.gps_lat}, ${selectedPkg.gps_lng}` : 'N/A'}

DÉTAILS COLIS
-------------
Poids     : ${selectedPkg.weight || 'N/A'}
Prix      : ${selectedPkg.is_paid ? 'Payé' : ((selectedPkg.price || 0) + ' DH')}
Statut    : ${statusLabels[selectedPkg.status] || selectedPkg.status}
Date lim. : ${selectedPkg.limit_date || 'N/A'}
Notes     : ${selectedPkg.description || 'Aucune'}
----------------------------------`}
                  </Text>
                  <View style={styles.qrContainer}>
                    <Image 
                      source={{ 
                        uri: `https://quickchart.io/qr?text=${encodeURIComponent(
`RÉFÉRENCE : ${selectedPkg.ref_number}
DATE CRÉA : ${selectedPkg.created_at ? new Date(selectedPkg.created_at).toLocaleDateString('fr-FR') : 'N/A'}
EXPÉDITEUR : ${selectedPkg.sender_name || 'N/A'} - ${selectedPkg.sender_phone || 'N/A'}
DESTINATAIRE : ${selectedPkg.customer_name || 'N/A'} - ${selectedPkg.customer_phone || 'N/A'}
ADRESSE : ${selectedPkg.customer_address || 'N/A'}
POIDS : ${selectedPkg.weight || 'N/A'}
PRIX : ${selectedPkg.is_paid ? 'Payé' : ((selectedPkg.price || 0) + ' DH')}
`
                        )}&size=200&margin=1`
                      }}
                      style={{ width: 200, height: 200 }}
                      resizeMode="contain"
                    />
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );

  function getStatusColor(status: string) {
    const colors: Record<string, string> = {
      Pending: '#9CA3AF',
      Assigned: '#3B82F6',
      'In Transit': '#F59E0B',
      Delivered: '#10B981',
      Returned: '#EF4444',
      Archived: '#8B5CF6'
    };
    return colors[status] || '#6B7280';
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 24, color: '#3B82F6' },
  
  filterBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 12,
    backgroundColor: '#FFFFFF',
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    marginRight: 8,
    marginBottom: 8,
  },
  filterBtnActive: {
    backgroundColor: '#3B82F6',
  },
  filterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  filterTextActive: {
    color: '#FFFFFF',
  },
  
  summary: {
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderBottomWidth: 1,
    borderBottomColor: '#BFDBFE',
  },
  summaryText: { fontSize: 14, color: '#1E40AF' },
  summaryBold: { fontWeight: '800', fontSize: 18 },
  list: { flex: 1 },
  
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#6B7280', fontSize: 16 },
  listContent: { padding: 16 },
  
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 16,
    color: '#DC2626',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Row styles
  packageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rowRef: {
    fontWeight: '700',
    color: '#111827',
    width: 80,
  },
  rowCustomer: {
    flex: 1,
    color: '#4B5563',
    marginHorizontal: 8,
  },
  rowStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rowStatusText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeBtn: {
    padding: 8,
    backgroundColor: '#EF4444',
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  printableContainer: {
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  printableText: {
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 14,
    color: '#000000',
    lineHeight: 20,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
});
