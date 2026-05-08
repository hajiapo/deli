import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalDatabase } from '../hooks/useLocalDatabase';
import PackageCard from '../components/PackageCard';

interface PackageListScreenProps {
  navigation: any;
}

export default function PackageListScreen({ navigation }: PackageListScreenProps) {
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  
  const { packages = [], drivers = [], loading = false, syncing = false, refresh } = useLocalDatabase({ isAdmin: true });

  useEffect(() => {
    console.log('📋 PackageListScreen mounted');
    console.log('📦 Packages loaded:', packages?.length || 0);
  }, [packages]);

  const filteredPackages = filterStatus === 'all' 
    ? packages
    : packages.filter(p => p.status === filterStatus);

  const statusOptions = ['all', 'Pending', 'Assigned', 'In Transit', 'Delivered', 'Returned'];
  
  // French translations for status labels
  const statusLabels: Record<string, string> = {
    'all': 'Tous',
    'Pending': 'En attente',
    'Assigned': 'Assigné',
    'In Transit': 'En cours',
    'Delivered': 'Livré',
    'Returned': 'Retourné'
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
          data={filteredPackages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <PackageCard pkg={item} drivers={drivers} />
          )}
          refreshControl={
            <RefreshControl refreshing={syncing} onRefresh={refresh} colors={['#3B82F6']} />
          }
        />
      )}
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
    gap: 8,
  },
  filterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
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
});
