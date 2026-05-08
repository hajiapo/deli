import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import { AdminPackageListScreenProps } from '../types/navigation';

export default function AdminPackageListScreen({ navigation }: AdminPackageListScreenProps) {
  
  const { packages, drivers, loading, refresh } = useLocalDatabase({ isAdmin: true });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'week'
  const [bulkMode, setBulkMode] = useState(false);

  // Bulk selection
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  
  // Edit/Delete states
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);

  // Translate status to French for display
  const translateStatus = (status: string): string => {
    const statusTranslations: Record<string, string> = {
      'Pending': 'En attente',
      'Assigned': 'Assigné',
      'In Transit': 'En cours',
      'Delivered': 'Livré',
      'Returned': 'Retourné'
    };
    return statusTranslations[status] || status;
  };

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];

  // Filter packages
  const filteredPackages = packages.filter((pkg: any) => {
    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      if (!pkg.ref_number?.toLowerCase().includes(query) &&
          !pkg.customer_name?.toLowerCase().includes(query)) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== 'all' && pkg.status !== filterStatus) {
      return false;
    }

    // Date filter
    const pkgDate = pkg.limit_date?.split('T')[0];
    const today = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    if (filterDate === 'today' && pkgDate !== today) return false;
    if (filterDate === 'week' && (pkgDate as string) && pkgDate < oneWeekAgo) return false;

    return true;
  });

  const toggleSelection = (pkgId: string) => {
    setSelectedPackageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pkgId)) newSet.delete(pkgId);
      else newSet.add(pkgId);
      return newSet;
    });
  };

  const selectAll = useCallback(() => {
    if (selectedPackageIds.size === filteredPackages.length) {
      setSelectedPackageIds(new Set());
    } else {
      setSelectedPackageIds(new Set(filteredPackages.map((p: any) => p.id)));
    }
  }, [filteredPackages.length, selectedPackageIds.size]);

  const handleBulkAssign = async () => {
    if (!selectedDriverId || selectedPackageIds.size === 0) {
      Alert.alert('Erreur', 'Sélectionnez un livreur et des colis.');
      return;
    }

    setBulkAssigning(true);
    try {
      const { getFirestore, collection, doc, writeBatch } = require('firebase/firestore');
      
      // Get the Firebase app from React Native Firebase
      const { default: app } = require('@react-native-firebase/app');
      const db = getFirestore(app);
      const batch = writeBatch(db);
      const timestamp = new Date().toISOString();

      selectedPackageIds.forEach(pkgId => {
        const ref = doc(db, 'packages', pkgId);
        batch.update(ref, {
          status: 'Assigned',
          assigned_to: selectedDriverId,
          assigned_at: timestamp,
        });
      });

      await batch.commit();
      await refresh();
      
      setBulkAssignModalVisible(false);
      setSelectedPackageIds(new Set());
      setSelectedDriverId('');
      Alert.alert('Succès', `${selectedPackageIds.size} colis assignés!`);
    } catch (error) {
      Alert.alert('Erreur', `Échec de l'assignation.`);
    } finally {
      setBulkAssigning(false);
    }
  };

  const handleEditPackage = (pkg: any) => {
    setEditingPackage(pkg);
    setEditModalVisible(true);
  };

  const handleDeletePackage = (pkg: any) => {
    setPackageToDelete(pkg);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!packageToDelete) return;
    
    try {
      const { getFirestore, collection, doc, deleteDoc } = require('firebase/firestore');
      
      // Get the Firebase app from React Native Firebase
      const { default: app } = require('@react-native-firebase/app');
      const db = getFirestore(app);
      await deleteDoc(doc(db, 'packages', packageToDelete.id));
      await refresh();
      Alert.alert('Succès', 'Colis supprimé avec succès');
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de supprimer le colis');
    } finally {
      setDeleteModalVisible(false);
      setPackageToDelete(null);
    }
  };

  const saveEditedPackage = async () => {
    if (!editingPackage) return;
    
    try {
      const { getFirestore, collection, doc, updateDoc } = require('firebase/firestore');
      
      // Get the Firebase app from React Native Firebase
      const { default: app } = require('@react-native-firebase/app');
      const db = getFirestore(app);
      await updateDoc(doc(db, 'packages', editingPackage.id), {
        customer_name: editingPackage.customer_name,
        customer_address: editingPackage.customer_address,
        customer_phone: editingPackage.customer_phone,
        price: parseFloat(editingPackage.price),
        description: editingPackage.description,
        weight: editingPackage.weight,
        _lastModified: new Date().toISOString()
      });
      
      await refresh();
      Alert.alert('Succès', 'Colis modifié avec succès');
      setEditModalVisible(false);
      setEditingPackage(null);
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de modifier le colis');
    }
  };

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={styles.headerCheckbox}>#</Text>
      <Text style={styles.headerText}>Colis</Text>
      <Text style={styles.headerText}>Client</Text>
      <Text style={styles.headerText}>Prix</Text>
      <Text style={styles.headerText}>Statut</Text>
    </View>
  );

  const renderTableRow = ({ item }: { item: any }) => (
    <View style={styles.tableRow}>
      {bulkMode && (
        <TouchableOpacity onPress={() => toggleSelection(item.id)} style={styles.checkbox}>
          <View style={[
            styles.checkboxInner,
            selectedPackageIds.has(item.id) && styles.checkboxChecked
          ]}>
            {selectedPackageIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>
      )}
      <Text style={styles.cellPkg}>{item.ref_number}</Text>
      <Text style={styles.cellCustomer} numberOfLines={1}>{item.customer_name}</Text>
      <Text style={styles.cellPrice}>
        {item.is_paid ? 'payé' : (item.price || 0).toString()}
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
        <Text style={styles.statusText}>{translateStatus(item.status)}</Text>
      </View>
      
      {/* Admin Actions */}
      {!bulkMode && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => handleEditPackage(item)}
          >
            <Text style={styles.actionBtnText}>✏️</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, styles.deleteBtn]} 
            onPress={() => handleDeletePackage(item)}
          >
            <Text style={styles.actionBtnText}>🗑️</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Pending: '#FCD34D',
      Assigned: '#3B82F6',
      'In Transit': '#10B981',
      Delivered: '#059669',
      Returned: '#EF4444',
    };
    return colors[status] || '#6B7280';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Retour</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Liste des Colis</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <View style={styles.searchContainer}>
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher colis/client..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <View style={styles.filterRow}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Statut</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setStatusPickerVisible(true)}
            >
              <Text style={styles.pickerText}>
                {filterStatus === 'all' ? 'Tous' : filterStatus}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Date</Text>
            <TouchableOpacity
              style={styles.picker}
              onPress={() => setDatePickerVisible(true)}
            >
              <Text style={styles.pickerText}>
                {filterDate === 'all' ? 'Toutes' : filterDate === 'today' ? "Aujourd'hui" : 'Cette semaine'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Status Picker Modal */}
      <Modal visible={statusPickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner un statut</Text>
            <ScrollView>
              {statusOptions.map(s => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.driverOption,
                    filterStatus === s && styles.driverOptionActive
                  ]}
                  onPress={() => {
                    setFilterStatus(s);
                    setStatusPickerVisible(false);
                  }}
                >
                  <Text style={styles.driverName}>
                    {s === 'all' ? 'Tous' : s}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setStatusPickerVisible(false)}
            >
              <Text style={styles.modalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Date Picker Modal */}
      <Modal visible={datePickerVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Sélectionner une date</Text>
            <ScrollView>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'all' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('all');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Toutes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'today' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('today');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Aujourd'hui</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.driverOption,
                  filterDate === 'week' && styles.driverOptionActive
                ]}
                onPress={() => {
                  setFilterDate('week');
                  setDatePickerVisible(false);
                }}
              >
                <Text style={styles.driverName}>Cette semaine</Text>
              </TouchableOpacity>
            </ScrollView>
            <TouchableOpacity
              style={[styles.modalBtn, styles.cancelBtn]}
              onPress={() => setDatePickerVisible(false)}
            >
              <Text style={styles.modalBtnText}>Annuler</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Summary & Bulk Controls */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryText}>
          Total: <Text style={styles.summaryBold}>{filteredPackages.length}</Text> colis
        </Text>
        <View style={styles.bulkControls}>
          <TouchableOpacity 
            style={[styles.bulkToggle, bulkMode && styles.bulkToggleActive]}
            onPress={() => setBulkMode(!bulkMode)}
          >
            <Text style={[styles.bulkText, bulkMode && styles.bulkTextActive]}>
              {bulkMode ? `✓ ${selectedPackageIds.size}` : '☐ Bulk'}
            </Text>
          </TouchableOpacity>
          {bulkMode && selectedPackageIds.size > 0 && (
            <TouchableOpacity 
              style={styles.bulkAssignBtn}
              onPress={() => setBulkAssignModalVisible(true)}
              disabled={!drivers.length}
            >
              <Text style={styles.bulkAssignText}>Assigner</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Table */}
      <FlatList
        data={filteredPackages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.tableContainer}
        ListHeaderComponent={renderTableHeader}
        renderItem={renderTableRow}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Aucun colis trouvé</Text>
          </View>
        }
      />

      {/* Bulk Assign Modal */}
      <Modal visible={bulkAssignModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Assigner {selectedPackageIds.size} colis</Text>
            <ScrollView style={styles.driverList}>
{drivers.map((driver: any) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverOption,
                    selectedDriverId === driver.id && styles.driverOptionActive
                  ]}
                  onPress={() => setSelectedDriverId(driver.id)}
                >
                  <Text style={styles.driverName}>{driver.name}</Text>
                  <Text style={styles.driverVehicle}>{driver.vehicle_type}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setBulkAssignModalVisible(false);
                  setSelectedDriverId('');
                }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.assignBtn, (!selectedDriverId || bulkAssigning) && styles.assignBtnDisabled]}
                onPress={handleBulkAssign}
                disabled={!selectedDriverId || bulkAssigning}
              >
                {bulkAssigning ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignText}>Assigner</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Package Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Modifier Colis</Text>
            <ScrollView>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Nom Client</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingPackage?.customer_name || ''}
                  onChangeText={(text) => setEditingPackage({...editingPackage, customer_name: text})}
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Adresse</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingPackage?.customer_address || ''}
                  onChangeText={(text) => setEditingPackage({...editingPackage, customer_address: text})}
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Téléphone</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingPackage?.customer_phone || ''}
                  onChangeText={(text) => setEditingPackage({...editingPackage, customer_phone: text})}
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Prix (DH)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingPackage?.price?.toString() || ''}
                  onChangeText={(text) => setEditingPackage({...editingPackage, price: parseFloat(text) || 0})}
                  keyboardType="numeric"
                />
              </View>
              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Description</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editingPackage?.description || ''}
                  onChangeText={(text) => setEditingPackage({...editingPackage, description: text})}
                />
              </View>
            </ScrollView>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingPackage(null);
                }}
              >
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.saveBtn]}
                onPress={saveEditedPackage}
              >
                <Text style={styles.modalBtnText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal visible={deleteModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirmer la Suppression</Text>
            <Text style={styles.modalText}>
              Voulez-vous vraiment supprimer le colis {packageToDelete?.ref_number ? `(${packageToDelete.ref_number})` : ''}
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setDeleteModalVisible(false);
                  setPackageToDelete(null);
                }}
              >
                <Text style={styles.modalBtnText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalBtn, styles.deleteBtn]}
                onPress={confirmDelete}
              >
                <Text style={styles.modalBtnText}>Supprimer</Text>
              </TouchableOpacity>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backBtn: { padding: 8 },
  backText: { fontSize: 16, fontWeight: '600', color: '#3B82F6' },
  headerTitle: { fontSize: 18, fontWeight: '700', flex: 1, textAlign: 'center' },
  refreshBtn: { padding: 8 },
  refreshText: { fontSize: 20, color: '#3B82F6' },

  filtersContainer: { padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  searchContainer: { marginBottom: 12 },
  searchInput: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  filterRow: { flexDirection: 'row', gap: 12 },
  filterGroup: { flex: 1 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  picker: { backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', padding: 12 },
  pickerText: { fontSize: 16, color: '#111827' },

  summaryContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#EFF6FF',
  },
  summaryText: { fontSize: 16, fontWeight: '600', color: '#1E40AF' },
  summaryBold: { color: '#1E3A8A', fontWeight: '800', fontSize: 20 },
  bulkControls: { flexDirection: 'row', gap: 8 },
  bulkToggle: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  bulkToggleActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  bulkText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bulkAssignBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  bulkAssignText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  bulkTextActive: { color: '#fff' },

  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  actionBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 32,
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  tableContainer: { flex: 1, padding: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerCheckbox: { width: 50, fontWeight: '700', textAlign: 'center' },
  headerText: { flex: 1, fontWeight: '700', fontSize: 14, color: '#374151' },

  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  checkbox: { width: 50, paddingRight: 8 },
  checkboxInner: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkmark: { color: '#fff', fontWeight: 'bold' },
  cellPkg: { flex: 1.2, fontWeight: '600', fontSize: 14 },
  cellCustomer: { flex: 2, fontSize: 14 },
  cellPrice: { flex: 1, fontWeight: '600', textAlign: 'center', fontSize: 14 },
  statusBadge: {
    flex: 1.2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignItems: 'center',
  },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 16, color: '#6B7280', textAlign: 'center' },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalContent: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 12,
    minWidth: 300,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  modalText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalInput: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: '#6B7280',
  },
  saveBtn: {
    backgroundColor: '#3B82F6',
  },
  modalBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  driverVehicle: { fontSize: 14, color: '#6B7280' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  assignBtn: { backgroundColor: '#10B981', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  assignBtnDisabled: { backgroundColor: '#9CA3AF' },
  assignText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  
  // Driver list styles
  driverList: { maxHeight: 200 },
  driverOption: {
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  driverOptionActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  driverName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  driverVehicleType: { fontSize: 14, color: '#6B7280' },
});

