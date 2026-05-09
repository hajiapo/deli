import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import useAuthStore from '../store/useAuthStore';
import { getStatusColor } from '../utils/statusColors';
import type { AdminDashboardScreenProps } from '../types/navigation';
import type { Package, Driver } from '../types';
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

const AdminDashboardScreen: React.FC<AdminDashboardScreenProps> = ({ navigation }) => {
  const { userRole, logout } = useAuthStore();
  const { packages, drivers, loading, refresh, packageStats } = useLocalDatabase({ isAdmin: true });
  
  const [statsLoading, setStatsLoading] = useState(true);
  const isFocused = useIsFocused();
  const [forceRefreshKey, setForceRefreshKey] = useState(0);

  // Refresh once when screen becomes focused.
  // (Avoid multiple refreshes on mount+focus which can cause visible blinking)
  useEffect(() => {
    if (!isFocused) return;

    const loadStats = async () => {
      setStatsLoading(true);
      await refresh();
      setStatsLoading(false);
    };

    loadStats();
  }, [isFocused, refresh]);


  // Use real-time stats from hook
  const totalPackages = packageStats?.total || 0;
  const totalDrivers = drivers.length;
  const pendingPackages = packageStats?.pending || 0;
  const inTransitPackages = packageStats?.inTransit || 0;
  const deliveredPackages = packageStats?.delivered || 0;
  const returnedPackages = packageStats?.returned || 0;

  if (loading || statsLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.loadingText}>Chargement du tableau de bord...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Tableau de Bord Admin</Text>
          <TouchableOpacity style={styles.logoutBtn} onPress={() => {
            console.log('🔄 Admin logout button clicked');
            try {
              logout();
              console.log('✅ Logout function called');
              navigation.replace('Login');
              console.log('✅ Navigation to Login screen initiated');
            } catch (error) {
              console.error('❌ Error during admin logout:', error);
              // Try to navigate anyway
              try {
                navigation.replace('Login');
              } catch (navError) {
                console.error('❌ Navigation also failed:', navError);
              }
            }
          }}>
            <Text style={styles.logoutText}>Déconnexion</Text>
          </TouchableOpacity>
        </View>

        {/* Stats Cards - Admin view */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalPackages}</Text>
            <Text style={styles.statLabel}>Total Paquets</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{pendingPackages}</Text>
            <Text style={styles.statLabel}>En Attente</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{inTransitPackages}</Text>
            <Text style={styles.statLabel}>En Transit</Text>
          </View>
        </View>
        
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{deliveredPackages}</Text>
            <Text style={styles.statLabel}>Livrés</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{returnedPackages}</Text>
            <Text style={styles.statLabel}>Retournés</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{totalDrivers}</Text>
            <Text style={styles.statLabel}>Chauffeurs</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <Text style={styles.sectionTitle}>Actions Rapides</Text>
          
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#3B82F6' }]}
            onPress={() => navigation.navigate('AdminPackageList')}
          >
            <Text style={styles.actionBtnText}>📦 Liste Paquets Admin</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('AdminPackageList', { archivedOnly: true })}
          >
            <Text style={styles.actionBtnText}>📦 Colis archiveés</Text>
          </TouchableOpacity>


          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
            onPress={() => navigation.navigate('AddPackage')}
          >
            <Text style={styles.actionBtnText}>➕ Ajouter Colis</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#6B7280' }]}
            onPress={() => navigation.navigate('PackageList')}
          >
            <Text style={styles.actionBtnText}>📋 Tous les Paquets</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#F59E0B' }]}
            onPress={() => navigation.navigate('DriverList')}
          >
            <Text style={styles.actionBtnText}>👨‍💼 Gérer Chauffeurs</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#8B5CF6' }]}
            onPress={() => navigation.navigate('ChangeAdminPin')}
          >
            <Text style={styles.actionBtnText}>🔐 Changer PIN Admin</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  logoutBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
  },
  logoutText: {
    color: '#DC2626',
    fontWeight: '600',
  },
  pinSection: {
    backgroundColor: '#FFFFFF',
    padding: 24,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  pinTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 16,
  },
  pinInput: {
    backgroundColor: '#F1F5F9',
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    letterSpacing: 4,
    textAlign: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  errorText: {
    color: '#EF4444',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 16,
  },
  pinSubmitBtn: {
    backgroundColor: '#3B82F6',
    padding: 16,
    borderRadius: 12,
  },
  pinSubmitText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: responsiveSize(16, 20),
    flexWrap: 'wrap',
  },
  statCard: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSize(12, 14),
    borderRadius: responsiveSize(12, 14),
    alignItems: 'center',
    flex: 1,
    marginHorizontal: responsiveSize(4, 6),
    minWidth: 80,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  statNumber: {
    fontSize: FONTS.compact.heading,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: FONTS.compact.tiny,
    color: '#64748B',
  },
  actionsSection: {
    backgroundColor: '#FFFFFF',
    padding: responsiveSize(16, 20),
    borderRadius: responsiveSize(12, 14),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  sectionTitle: {
    fontSize: FONTS.compact.subtitle,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: responsiveSize(12, 16),
  },
  actionBtn: {
    padding: responsiveSize(12, 14),
    borderRadius: BORDER_RADIUS.md,
    marginBottom: responsiveSize(8, 10),
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: FONTS.compact.body,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: FONTS.compact.body,
    color: '#64748B',
  },
});

export default AdminDashboardScreen;

