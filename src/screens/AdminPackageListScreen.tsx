import React, { useState, useCallback, useEffect, useMemo } from 'react';
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
  Linking,
  Clipboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import { AdminPackageListScreenProps } from '../types/navigation';
import ScannerModal from '../components/ScannerModal';
import { parseDriverReport, autoUpdatePackagesFromReport, validateReport } from '../utils/driverReportParser';

export default function AdminPackageListScreen({ navigation, route }: AdminPackageListScreenProps) {
  
  const { packages, drivers, loading, refresh, archivePackages, unarchivePackages } = useLocalDatabase({ isAdmin: true });
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const showArchived = !!route?.params?.archivedOnly;
  const [filterDate, setFilterDate] = useState('all'); // 'all', 'today', 'week'
  const archivedStatusOptions = ['archived'] as const;

  // Selection
  const [selectedPackageIds, setSelectedPackageIds] = useState<Set<string>>(new Set());
  const [bulkAssignModalVisible, setBulkAssignModalVisible] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState('');
  const [bulkAssigning, setBulkAssigning] = useState(false);
  const [statusPickerVisible, setStatusPickerVisible] = useState(false);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  
  // Package Details modal state (real-time)
  const [detailsModalVisible, setDetailsModalVisible] = useState(false);
  const [selectedPackageForDetailsId, setSelectedPackageForDetailsId] = useState<string | null>(null);
  const [selectedPackageForDetails, setSelectedPackageForDetails] = useState<any>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // Edit/Delete states
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<any>(null);

  // Scanner state
  const [scannerVisible, setScannerVisible] = useState(false);

  // WhatsApp sharing state
  const [whatsappModalVisible, setWhatsappModalVisible] = useState(false);
  const [selectedDriverForWhatsapp, setSelectedDriverForWhatsapp] = useState('');
  const [sharingViaWhatsapp, setSharingViaWhatsapp] = useState(false);

  // Driver report monitoring state
  const [reportMonitorModalVisible, setReportMonitorModalVisible] = useState(false);
  const [reportText, setReportText] = useState('');
  const [processingReport, setProcessingReport] = useState(false);
  const [lastProcessedReport, setLastProcessedReport] = useState<any>(null);

  // Edit package form states - all fields from create screen
  const [editSenderName, setEditSenderName] = useState('');
  const [editSenderCompany, setEditSenderCompany] = useState('');
  const [editSenderPhone, setEditSenderPhone] = useState('');
  const [editDateOfArrive, setEditDateOfArrive] = useState('');
  const [editSupplementInfo, setEditSupplementInfo] = useState('');
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerAddress, setEditCustomerAddress] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editCustomerPhone2, setEditCustomerPhone2] = useState('');
  const [editGpsLat, setEditGpsLat] = useState('');
  const [editGpsLng, setEditGpsLng] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editWeight, setEditWeight] = useState('');
  const [editLimitDate, setEditLimitDate] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editIsPaid, setEditIsPaid] = useState(false);

  const formatDateTime = (value?: string): string => {
    if (!value) return 'N/A';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return value;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');

    return `${dd}/${mm}/${yyyy} ${HH}:${MM}`;
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

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];

  // Filter packages
  const filteredPackages = packages.filter((pkg: any) => {
    const isArchived = !!(pkg.is_archived || pkg.archived_at);

    // Archive mode first: only archived packages
    if (showArchived) {
      if (!isArchived) return false;
    } else {
      // Normal mode: hide archived packages
      if (isArchived) return false;
    }

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

  const shareViaWhatsApp = async () => {
    if (!selectedDriverForWhatsapp || selectedPackageIds.size === 0) {
      Alert.alert('Erreur', 'Sélectionnez un livreur et des colis.');
      return;
    }

    setSharingViaWhatsapp(true);
    try {
      const selectedDriver = drivers.find((d: any) => d.id === selectedDriverForWhatsapp);
      if (!selectedDriver) {
        Alert.alert('Erreur', 'Livreur introuvable.');
        return;
      }

      // Get selected packages details
      const selectedPackages = packages.filter((pkg: any) => selectedPackageIds.has(pkg.id));
      
      // Format WhatsApp message
      let message = `📦 *MISSION DE LIVRAISON* 🚚\n\n`;
      message += `👤 *Livreur:* ${selectedDriver.name}\n`;
      message += `🚗 *Véhicule:* ${selectedDriver.vehicle_type}\n`;
      message += `📱 *Téléphone:* ${selectedDriver.phone || 'Non spécifié'}\n\n`;
      message += `📋 *LISTE DES COLIS (${selectedPackages.length})*\n`;
      message += `${'='.repeat(30)}\n\n`;

      selectedPackages.forEach((pkg: any, index: number) => {
        message += `${index + 1}. 📦 *${pkg.ref_number}*\n`;
        message += `   👤 Client: ${pkg.customer_name || 'N/A'}\n`;
        message += `   📍 Adresse: ${pkg.customer_address || 'N/A'}\n`;
        message += `   📞 Téléphone: ${pkg.customer_phone || 'N/A'}\n`;
        message += `   💰 Prix: ${pkg.is_paid ? 'Payé' : `${pkg.price || 0} DH`}\n`;
        if (pkg.customer_phone_2) {
          message += `   📞 Téléphone 2: ${pkg.customer_phone_2}\n`;
        }
        message += `   📝 Description: ${pkg.description || 'N/A'}\n\n`;
      });

      message += `\n${'='.repeat(30)}\n`;
      message += `📊 *Total à encaisser:* ${selectedPackages.reduce((sum, pkg) => sum + (pkg.is_paid ? 0 : (pkg.price || 0)), 0)} DH\n\n`;
      message += `⚠️ *Instructions:*\n`;
      message += `• Veuillez confirmer la réception de cette mission\n`;
      message += `• Appelez les clients avant la livraison\n`;
      message += `• Signalez tout problème immédiatement\n\n`;
      message += `*Merci pour votre travail!* 💪\n`;
      message += `_Généré depuis Delivry App_`;

      // Clean phone number for WhatsApp
      const cleanPhone = selectedDriver.phone?.replace(/[^0-9]/g, '');
      if (!cleanPhone) {
        Alert.alert('Erreur', 'Le livreur n\'a pas de numéro de téléphone valide.');
        return;
      }

      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      
      // Check if WhatsApp is available
      const supported = await Linking.canOpenURL(whatsappUrl);
      if (supported) {
        await Linking.openURL(whatsappUrl);
        setWhatsappModalVisible(false);
        setSelectedDriverForWhatsapp('');
        setSelectedPackageIds(new Set());
      } else {
        Alert.alert('WhatsApp non disponible', 'WhatsApp n\'est pas installé sur cet appareil.');
      }
    } catch (error) {
      console.error('WhatsApp sharing error:', error);
      Alert.alert('Erreur', 'Impossible de partager via WhatsApp.');
    } finally {
      setSharingViaWhatsapp(false);
    }
  };

  // Process driver report function
  const processDriverReport = async () => {
    if (!reportText.trim()) {
      Alert.alert('Erreur', 'Veuillez coller le rapport du livreur.');
      return;
    }

    setProcessingReport(true);
    try {
      // Parse the driver report
      const parsedReport = parseDriverReport(reportText);
      
      if (!parsedReport) {
        Alert.alert('Erreur', 'Format du rapport invalide. Assurez-vous que c\'est un rapport de livreur valide.');
        return;
      }

      // Validate the report
      const warnings = validateReport(parsedReport);
      
      // Show report summary for confirmation
      const confirmMessage = `Rapport reçu de ${parsedReport.driverName || parsedReport.driverId || 'Livreur inconnu'}\n\n` +
        `📦 Tâches terminées: ${parsedReport.completedTasks.length}\n` +
        `✅ Livrés: ${parsedReport.summary.delivered}\n` +
        `⚠️ Retournés: ${parsedReport.summary.returned}\n` +
        `💰 Cash collecté: ${parsedReport.financialSummary.cashCollected} DH\n\n` +
        (warnings.length > 0 ? `⚠️ Avertissements:\n${warnings.join('\n')}\n\n` : '') +
        `Voulez-vous mettre à jour automatiquement les statuts des colis?`;

      Alert.alert(
        '📋 Rapport de Livreur Détecté',
        confirmMessage,
        [
          {
            text: 'Annuler',
            style: 'cancel',
            onPress: () => setReportText('')
          },
          {
            text: 'Mettre à jour',
            onPress: async () => {
              try {
                const updateResult = await autoUpdatePackagesFromReport(parsedReport, packages);
                
                // Show result
                Alert.alert(
                  updateResult.success ? '✅ Mise à jour réussie' : '❌ Erreur',
                  updateResult.message,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        setReportMonitorModalVisible(false);
                        setReportText('');
                        setLastProcessedReport({ ...updateResult, report: parsedReport });
                        refresh(); // Refresh package list
                      }
                    }
                  ]
                );
              } catch (error) {
                console.error('Auto-update error:', error);
                Alert.alert('Erreur', 'Échec de la mise à jour automatique.');
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('Report processing error:', error);
      Alert.alert('Erreur', 'Impossible de traiter le rapport.');
    } finally {
      setProcessingReport(false);
    }
  };

  // Check clipboard for driver report
  const checkClipboardForReport = async () => {
    try {
      const clipboardText = await Clipboard.getString();
      
      if (clipboardText && parseDriverReport(clipboardText)) {
        Alert.alert(
          '📋 Rapport détecté',
          'Un rapport de livreur a été détecté dans votre presse-papiers. Voulez-vous le traiter?',
          [
            {
              text: 'Non',
              style: 'cancel'
            },
            {
              text: 'Oui',
              onPress: () => {
                setReportText(clipboardText);
                setReportMonitorModalVisible(true);
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Clipboard check error:', error);
    }
  };

  const handleEditPackage = (pkg: any) => {
    setEditingPackage(pkg);
    // Populate all edit form fields
    setEditSenderName(pkg.sender_name || '');
    setEditSenderCompany(pkg.sender_company || '');
    setEditSenderPhone(pkg.sender_phone || '');
    setEditDateOfArrive(pkg.date_of_arrive || '');
    setEditSupplementInfo(pkg.supplement_info || '');
    setEditCustomerName(pkg.customer_name || '');
    setEditCustomerAddress(pkg.customer_address || '');
    setEditCustomerPhone(pkg.customer_phone || '');
    setEditCustomerPhone2(pkg.customer_phone_2 || '');
    setEditGpsLat(pkg.gps_lat?.toString() || '');
    setEditGpsLng(pkg.gps_lng?.toString() || '');
    setEditDescription(pkg.description || '');
    setEditWeight(pkg.weight || '');
    setEditLimitDate(pkg.limit_date || '');
    setEditPrice(pkg.price?.toString() || '');
    setEditIsPaid(pkg.is_paid || false);
    setEditModalVisible(true);
  };

  const handleDeletePackage = (pkg: any) => {
    setPackageToDelete(pkg);
    setDeleteModalVisible(true);
  };

  const confirmDelete = async () => {
    if (!packageToDelete) return;
    
    try {
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore, doc, deleteDoc } = require('@react-native-firebase/firestore');
      
      const app = getApp();
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
      // Prepare all updated fields
      const updates: any = {
        sender_name: editSenderName || undefined,
        sender_company: editSenderCompany || undefined,
        sender_phone: editSenderPhone || undefined,
        date_of_arrive: editDateOfArrive || undefined,
        supplement_info: editSupplementInfo || undefined,
        customer_name: editCustomerName || undefined,
        customer_address: editCustomerAddress || undefined,
        customer_phone: editCustomerPhone || undefined,
        customer_phone_2: editCustomerPhone2 || undefined,
        gps_lat: editGpsLat ? parseFloat(editGpsLat) : undefined,
        gps_lng: editGpsLng ? parseFloat(editGpsLng) : undefined,
        description: editDescription || undefined,
        weight: editWeight || undefined,
        limit_date: editLimitDate || undefined,
        price: editIsPaid ? 0 : (parseFloat(editPrice) || 0),
        is_paid: editIsPaid,
        _lastModified: new Date().toISOString()
      };

      // Update Firestore immediately for real-time sync to drivers
      const { getApp } = require('@react-native-firebase/app');
      const { getFirestore, doc, updateDoc } = require('@react-native-firebase/firestore');
      
      const app = getApp();
      const db = getFirestore(app);
      await updateDoc(doc(db, 'packages', editingPackage.id), updates);

      // Update local state immediately
      await refresh();

      Alert.alert('Succès', 'Colis modifié avec succès');
      setEditModalVisible(false);
      setEditingPackage(null);
    } catch (error) {
      console.error('Error updating package:', error);
      Alert.alert('Erreur', 'Impossible de modifier le colis');
    }
  };

  const renderTableHeader = () => (
    <View style={styles.tableHeader}>
      <Text style={styles.headerCheckbox}>#</Text>
      <Text style={[styles.headerText, styles.headerPkg]}>Colis</Text>
      <Text style={[styles.headerText, styles.headerCustomer]}>Client</Text>
      <Text style={[styles.headerText, styles.headerPrice]}>Prix</Text>
      <Text style={[styles.headerText, styles.headerStatus]}>Statut</Text>
    </View>
  );

  const openPackageDetails = (pkg: any) => {
    setSelectedPackageForDetailsId(pkg.id);
    setSelectedPackageForDetails(pkg);
    setDetailsLoading(true);
    setDetailsModalVisible(true);
  };

  const handleScan = (data: string) => {
    setScannerVisible(false);
    
    // Validate QR code data - reject URLs and invalid formats
    if (!data || data.trim().length === 0) {
      Alert.alert('Format invalide', 'Le QR code scanné est vide.');
      return;
    }
    
    // Reject URLs and web links
    if (data.startsWith('http://') || data.startsWith('https://') || data.startsWith('www.')) {
      Alert.alert('Format invalide', 'Les liens web ne sont pas supportés.');
      return;
    }
    
    let searchRef = data.trim();
    let packageData: any = null;
    
    // Try to parse as JSON (in case QR is a full package JSON)
    try {
      const parsed = JSON.parse(data);
      if (parsed.ref_number || parsed.ref) {
        searchRef = String(parsed.ref_number || parsed.ref);
        packageData = parsed;
      } else {
        Alert.alert('Format invalide', 'Le QR code scanné n\'est pas un colis valide.');
        return;
      }
    } catch (e) {
      // Not JSON - treat as plain reference number
      // Validate reference number format (basic validation)
      if (!/^PKG-\d+$/.test(searchRef) && !/^\d+$/.test(searchRef)) {
        Alert.alert('Format invalide', 'Le QR code doit contenir un numéro de référence valide (ex: PKG-123456).');
        return;
      }
    }
    
    // First, check if package exists
    const foundPkg = packages.find(
      (p: any) => p.id === searchRef || p.ref_number.toLowerCase() === searchRef.toLowerCase()
    );
    
    if (foundPkg) {
      // Package exists - show details
      openPackageDetails(foundPkg);
    } else if (packageData) {
      // Package doesn't exist but we have JSON data - navigate to AddPackageScreen with pre-filled data
      Alert.alert(
        'Nouveau Colis Détecté',
        'Ce colis n\'existe pas dans la base de données. Voulez-vous le créer avec les données scannées ?',
        [
          { text: 'Annuler', style: 'cancel' },
          { 
            text: 'Créer', 
            onPress: () => {
              // Navigate to AddPackageScreen with pre-filled data
              navigation.navigate('AddPackage', { 
                scannedData: packageData 
              });
            }
          }
        ]
      );
    } else {
      Alert.alert('Introuvable', 'Ce colis n\'existe pas.');
    }
  };

  // Real-time listener for selected package
  useEffect(() => {
    if (!detailsModalVisible || !selectedPackageForDetailsId) return;

    let unsubscribe: (() => void) | undefined;

    const start = async () => {
      try {
        setDetailsLoading(true);

        const { default: app } = require('@react-native-firebase/app');
        const { getFirestore, doc, onSnapshot } = require('@react-native-firebase/firestore');

        const db = getFirestore(app);
        const ref = doc(db, 'packages', selectedPackageForDetailsId);

        unsubscribe = onSnapshot(ref, (snap: any) => {
          if (!snap) return;
          if (snap.exists?.()) {
            setSelectedPackageForDetails({ id: snap.id, ...snap.data() });
          } else {
            setSelectedPackageForDetails(null);
          }
          setDetailsLoading(false);
        });
      } catch (e) {
        console.error('Package details onSnapshot error:', e);
        setDetailsLoading(false);
      }
    };

    start();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [detailsModalVisible, selectedPackageForDetailsId]);

  const renderTableRow = ({ item }: { item: any }) => (
    <View style={styles.tableRow}>
      <TouchableOpacity onPress={() => toggleSelection(item.id)} style={styles.checkbox}>
        <View style={[
          styles.checkboxInner,
          selectedPackageIds.has(item.id) && styles.checkboxChecked
        ]}>
          {selectedPackageIds.has(item.id) && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        onPress={() => openPackageDetails(item)}
        style={[styles.cellPkg, styles.pkgCellContainer]}
        accessibilityRole="button"
      >
        <View style={styles.pkgInfo}>
          <Text style={styles.pkgNumber}>{item.ref_number}</Text>
          <Text style={styles.pkgSubtitle} numberOfLines={1}>{item.description || 'Pas de description'}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.cellCustomer} numberOfLines={1}>{item.customer_name}</Text>
      <Text style={styles.cellPrice}>
        {item.is_paid ? 'payé' : (item.price || 0).toString()}
      </Text>
      <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}> 
        <Text style={styles.statusText}>{translateStatus(item.status)}</Text>
      </View>
    </View>
  );

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      Pending: '#FCD34D',
      Assigned: '#3B82F6',
      'In Transit': '#10B981',
      Delivered: '#059669',
      Returned: '#EF4444',
      Archived: '#8B5CF6',
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
          <TouchableOpacity onPress={() => setScannerVisible(true)} style={styles.adminScanBtn}>
            <Text style={styles.adminScanText}>📷</Text>
          </TouchableOpacity>
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
          {selectedPackageIds.size > 0 && (
            <Text> · Sélection: <Text style={styles.summaryBold}>{selectedPackageIds.size}</Text></Text>
          )}
        </Text>
        <View style={styles.bulkControls}>
          {selectedPackageIds.size > 0 && (
            <>
              {!showArchived ? (
                <>
                  <TouchableOpacity
                    style={styles.bulkAssignBtn}
                    onPress={() => setBulkAssignModalVisible(true)}
                    disabled={!drivers.length}
                  >
                    <Text style={styles.bulkAssignText}>Assigner</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bulkAssignBtn, { backgroundColor: '#10B981' }]}
                    onPress={checkClipboardForReport}
                  >
                    <Text style={styles.bulkAssignText}>📋 Traiter Rapport</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bulkAssignBtn, { backgroundColor: '#25D366' }]}
                    onPress={() => setWhatsappModalVisible(true)}
                    disabled={selectedPackageIds.size === 0}
                  >
                    <Text style={styles.bulkAssignText}>Partager via WhatsApp</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.bulkAssignBtn, { backgroundColor: '#8B5CF6' }]}
                    onPress={() => {
                      const ids = Array.from(selectedPackageIds);
                      void archivePackages(ids);
                      setSelectedPackageIds(new Set());
                    }}
                    disabled={selectedPackageIds.size === 0}
                  >
                    <Text style={styles.bulkAssignText}>Archive</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[styles.bulkAssignBtn, { backgroundColor: '#10B981' }]}
                  onPress={() => {
                    const ids = Array.from(selectedPackageIds);
                    void unarchivePackages(ids);
                    setSelectedPackageIds(new Set());
                  }}
                  disabled={selectedPackageIds.size === 0}
                >
                  <Text style={styles.bulkAssignText}>Restaurer</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </View>

      {/* Table */}
      <FlatList
        style={styles.list}
        data={filteredPackages}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.tableContent}
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

      {/* WhatsApp Sharing Modal */}
      <Modal visible={whatsappModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Partager via WhatsApp</Text>
            <Text style={styles.modalSubtitle}>
              Sélectionnez un livreur pour partager {selectedPackageIds.size} colis
            </Text>
            <ScrollView style={styles.driverList}>
              {drivers.map((driver: any) => (
                <TouchableOpacity
                  key={driver.id}
                  style={[
                    styles.driverOption,
                    selectedDriverForWhatsapp === driver.id && styles.driverOptionActive
                  ]}
                  onPress={() => setSelectedDriverForWhatsapp(driver.id)}
                >
                  <View style={styles.driverInfo}>
                    <Text style={styles.driverName}>{driver.name}</Text>
                    <Text style={styles.driverVehicle}>{driver.vehicle_type}</Text>
                    <Text style={styles.driverPhone}>📱 {driver.phone || 'Non spécifié'}</Text>
                  </View>
                  <View style={[
                    styles.driverRadio,
                    selectedDriverForWhatsapp === driver.id && styles.driverRadioActive
                  ]}>
                    {selectedDriverForWhatsapp === driver.id && <Text style={styles.radioDot}>●</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setWhatsappModalVisible(false);
                  setSelectedDriverForWhatsapp('');
                }}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.assignBtn, { backgroundColor: '#25D366' }, (!selectedDriverForWhatsapp || sharingViaWhatsapp) && styles.assignBtnDisabled]}
                onPress={shareViaWhatsApp}
                disabled={!selectedDriverForWhatsapp || sharingViaWhatsapp}
              >
                {sharingViaWhatsapp ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignText}>📤 Partager</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Driver Report Monitoring Modal */}
      <Modal visible={reportMonitorModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📋 Traiter Rapport de Livreur</Text>
            <Text style={styles.modalSubtitle}>
              Collez le rapport WhatsApp du livreur pour mettre à jour automatiquement les statuts
            </Text>
            
            <TextInput
              style={styles.reportInput}
              multiline
              numberOfLines={8}
              placeholder="Collez le rapport du livreur ici...\n\nExemple:\n📦 RAPPORT DE LIVRAISON AUTOMATIQUE 🚚\n👤 Livreur: DRV-001\n✅ Livré: 3 colis\n⚠️ Retourné: 1 colis\n..."
              value={reportText}
              onChangeText={setReportText}
              editable={!processingReport}
            />
            
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={styles.cancelBtn}
                onPress={() => {
                  setReportMonitorModalVisible(false);
                  setReportText('');
                }}
                disabled={processingReport}
              >
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.assignBtn, { backgroundColor: '#10B981' }, (!reportText.trim() || processingReport) && styles.assignBtnDisabled]}
                onPress={processDriverReport}
                disabled={!reportText.trim() || processingReport}
              >
                {processingReport ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.assignText}>🔄 Traiter</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Package Details Modal (real-time) */}
      <Modal visible={detailsModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Détails du Colis</Text>

            {detailsLoading ? (
              <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#3B82F6" />
                <Text style={styles.loadingText}>Chargement des détails...</Text>
              </View>
            ) : selectedPackageForDetails ? (
              <ScrollView style={{ maxHeight: 400 }}>
                <View style={styles.detailBlock}>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Réf:</Text> {selectedPackageForDetails.ref_number}</Text>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Client:</Text> {selectedPackageForDetails.customer_name || 'Non spécifié'}</Text>
                  <View style={{ marginBottom: 8 }}>
                    <Text style={styles.detailKey}>Statut:</Text>
                    <Text
                      style={{
                        marginTop: 6,
                        alignSelf: 'flex-start',
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: getStatusColor(selectedPackageForDetails.status),
                        color: '#FFFFFF',
                        fontWeight: '800',
                      }}
                    >
                      {translateStatus(selectedPackageForDetails.status)}
                    </Text>
                  </View>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>Assigné à:</Text> {(() => {
                    const assignedId = selectedPackageForDetails.assigned_to;
                    if (!assignedId) return 'N/A';
                    const driver = drivers.find((d: any) => d.id === assignedId);
                    return driver?.name || assignedId;
                  })()}</Text>

                  <Text style={styles.detailLine}><Text style={styles.detailKey}>assigned_at:</Text> {formatDateTime(selectedPackageForDetails.assigned_at)}</Text>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>accepted_at:</Text> {formatDateTime(selectedPackageForDetails.accepted_at)}</Text>
                  <Text style={styles.detailLine}><Text style={styles.detailKey}>delivered_at:</Text> {formatDateTime(selectedPackageForDetails.delivered_at)}</Text>

                  {selectedPackageForDetails.status === 'Returned' && (
                    <Text style={styles.detailLine}><Text style={styles.detailKey}>return_reason:</Text> {selectedPackageForDetails.return_reason || 'Raison non trouvée'}</Text>
                  )}
                </View>
              </ScrollView>
            ) : (
              <Text style={styles.modalText}>Aucun colis sélectionné.</Text>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setDetailsModalVisible(false);
                  setSelectedPackageForDetailsId(null);
                  setSelectedPackageForDetails(null);
                }}
              >
                <Text style={styles.modalBtnText}>Fermer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Scanner Modal */}
      <ScannerModal
        visible={scannerVisible}
        onClose={() => setScannerVisible(false)}
        onScan={handleScan}
      />

      {/* Edit Package Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeaderWithActions}>
              <Text style={styles.modalTitle}>Modifier Colis {editingPackage?.ref_number || ''}</Text>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn, styles.modalDeleteBtn]}
                onPress={() => {
                  setEditModalVisible(false);
                  setPackageToDelete(editingPackage);
                  setDeleteModalVisible(true);
                }}
              >
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }}>
              <Text style={styles.sectionTitle}>1. Informations Générales</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Expéditeur (Nom)</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSenderName}
                  onChangeText={setEditSenderName}
                  placeholder="Ex: Jean Dupont"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Entreprise Expéditeur</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSenderCompany}
                  onChangeText={setEditSenderCompany}
                  placeholder="Ex: Boutique Paris"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone Expéditeur</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editSenderPhone}
                    onChangeText={setEditSenderPhone}
                    placeholder="06..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Date d'arrivée</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editDateOfArrive}
                    onChangeText={setEditDateOfArrive}
                    placeholder="JJ/MM/AAAA"
                  />
                </View>
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Infos Supplémentaires</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editSupplementInfo}
                  onChangeText={setEditSupplementInfo}
                  placeholder="Ex: Informations..."
                />
              </View>

              <Text style={styles.sectionTitle}>2. Contact & Localisation</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Nom du Client</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerName}
                  onChangeText={setEditCustomerName}
                  placeholder="Ex: Jean Dupont"
                />
              </View>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Adresse de Livraison</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editCustomerAddress}
                  onChangeText={setEditCustomerAddress}
                  placeholder="Ex: 10 Rue de la Paix"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone 1</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomerPhone}
                    onChangeText={setEditCustomerPhone}
                    placeholder="06..."
                    keyboardType="phone-pad"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Téléphone 2</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editCustomerPhone2}
                    onChangeText={setEditCustomerPhone2}
                    placeholder="07..."
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>GPS Latitude</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editGpsLat}
                    onChangeText={setEditGpsLat}
                    placeholder="48.8566"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>GPS Longitude</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editGpsLng}
                    onChangeText={setEditGpsLng}
                    placeholder="2.3522"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>3. Détails du Colis</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Description</Text>
                <TextInput
                  style={styles.modalInput}
                  value={editDescription}
                  onChangeText={setEditDescription}
                  placeholder="Ex: Vêtements fragiles"
                />
              </View>

              <View style={styles.row}>
                <View style={[styles.filterGroup, { flex: 1, marginRight: 8 }]}>
                  <Text style={styles.filterLabel}>Poids</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editWeight}
                    onChangeText={setEditWeight}
                    placeholder="Ex: 2.5kg"
                  />
                </View>
                <View style={[styles.filterGroup, { flex: 1, marginLeft: 8 }]}>
                  <Text style={styles.filterLabel}>Date Limite</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={editLimitDate}
                    onChangeText={setEditLimitDate}
                    placeholder="JJ/MM/AAAA"
                  />
                </View>
              </View>

              <Text style={styles.sectionTitle}>4. Facturation</Text>

              <View style={styles.filterGroup}>
                <Text style={styles.filterLabel}>Montant (DH) {!editIsPaid && '*'}</Text>
                <TextInput
                  style={[styles.modalInput, editIsPaid && styles.inputDisabled]}
                  value={editPrice}
                  onChangeText={setEditPrice}
                  placeholder="Ex: 50.00"
                  keyboardType="numeric"
                  editable={!editIsPaid}
                />
                {editIsPaid && <Text style={styles.disabledNote}>Montant non requis si déjà payé</Text>}
              </View>

              <View style={styles.switchGroup}>
                <Text style={styles.filterLabel}>Déjà Payé (Pas de COD)</Text>
                <Switch
                  value={editIsPaid}
                  onValueChange={(value) => {
                    setEditIsPaid(value);
                    if (value) {
                      setEditPrice('0');
                    }
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#10B981' }}
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: '#111827',
  },
  adminScanBtn: {
    backgroundColor: '#3B82F6',
    padding: 10,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminScanText: {
    fontSize: 18,
  },
  filterRow: { flexDirection: 'row' },
  filterGroup: { flex: 1, marginRight: 12 },
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
  bulkControls: { flexDirection: 'row', alignItems: 'center' },
  bulkToggle: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    marginRight: 8,
  },
  summaryText: { fontSize: 16, fontWeight: '600', color: '#1E40AF' },
  summaryBold: { color: '#1E3A8A', fontWeight: '800', fontSize: 20 },
  bulkToggleActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  bulkText: { color: '#111827', fontSize: 16, fontWeight: '600' },
  bulkTextActive: { color: '#fff' },
  bulkAssignBtn: {
    backgroundColor: '#10B981',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginLeft: 8,
  },
  bulkAssignText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  actionButtons: {
    flexDirection: 'row',
  },
  actionBtn: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 32,
    marginRight: 4,
  },
  editBtn: {
    backgroundColor: '#E0F2FE',
  },
  viewBtn: {
    backgroundColor: '#DBEAFE',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
  },
  modalHeaderWithActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalDeleteBtn: {
    minWidth: 40,
    paddingHorizontal: 10,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },

  list: { flex: 1 },
  tableContent: { padding: 16 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginBottom: 8,
  },
  headerCheckbox: { width: 50, fontWeight: '700', textAlign: 'center' },
  headerText: { fontWeight: '700', fontSize: 14, color: '#374151' },
  headerPkg: { flex: 2.4 },
  headerCustomer: { flex: 2 },
  headerPrice: { flex: 1, textAlign: 'center' },
  headerStatus: { flex: 1.2, textAlign: 'center' },

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
  cellPkg: { flex: 2.4 },
  pkgCellContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pkgInfo: { flex: 1, marginRight: 8 },
  pkgNumber: { fontWeight: '700', fontSize: 14, color: '#111827' },
  pkgSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pkgActionButtons: { flexDirection: 'row', alignItems: 'center' },
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
    minWidth: 350,
    maxHeight: '90%',
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
    marginTop: 8,
  },
  modalButtonSpacing: { marginRight: 12 },
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
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end' },
  cancelText: { color: '#6B7280', fontWeight: '600' },
  modalActionSpacing: { marginLeft: 12 },
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

  // Additional styles for edit modal
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  switchGroup: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 32, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  disabledNote: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },

  // Package details modal styles
  detailBlock: { backgroundColor: '#F9FAFB', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  detailLine: { fontSize: 14, color: '#111827', marginBottom: 8 },
  detailKey: { fontWeight: '800', color: '#1F2937' },
  loadingText: { fontSize: 14, fontWeight: '600', color: '#1E3A8A', marginTop: 8 },

  // WhatsApp modal styles
  modalSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 16 },
  driverInfo: { flex: 1, paddingVertical: 4 },
  driverPhone: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  driverRadio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverRadioActive: {
    borderColor: '#25D366',
    backgroundColor: '#25D366',
  },
  radioDot: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reportInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#111827',
    textAlignVertical: 'top',
    minHeight: 120,
    marginBottom: 16,
  },

});

