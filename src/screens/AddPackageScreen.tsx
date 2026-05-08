import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Switch, ScrollView, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AddPackageScreenProps } from '../types/navigation';
import { validatePackageData, validateNumber, validateCoordinates, sanitizeInput } from '../utils/inputValidation';

export default function AddPackageScreen({ navigation }: AddPackageScreenProps) {
  // Core Identifiers
  const [senderName, setSenderName] = useState('');
  const [senderCompany, setSenderCompany] = useState('');
  const [senderPhone, setSenderPhone] = useState('');
  const [dateOfArrive, setDateOfArrive] = useState('');
  const [supplementInfo, setSupplementInfo] = useState('');
  
  // Customer Info
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [phone1, setPhone1] = useState('');
  const [phone2, setPhone2] = useState('');
  
  // Package Details
  const [weight, setWeight] = useState('');
  const [description, setDescription] = useState('');
  const [limitDate, setLimitDate] = useState('');
  const [price, setPrice] = useState('');
  const [isPaid, setIsPaid] = useState(false);

  // Handle payment status change
  const handlePaymentStatusChange = (value: boolean) => {
    setIsPaid(value);
    if (value) {
      setPrice('0'); // Clear price when marked as paid
    }
  };
  
  // GPS (Manual for now)
  const [gpsLat, setGpsLat] = useState('');
  const [gpsLng, setGpsLng] = useState('');

  const [loading, setLoading] = useState(false);

  const handleAddPackage = async () => {
    // Sanitize all inputs first
    const sanitizedData = {
      sender_name: sanitizeInput(senderName),
      sender_company: sanitizeInput(senderCompany),
      sender_phone: sanitizeInput(senderPhone),
      date_of_arrive: sanitizeInput(dateOfArrive),
      supplement_info: sanitizeInput(supplementInfo),
      customer_name: sanitizeInput(customerName),
      customer_address: sanitizeInput(address),
      customer_phone: sanitizeInput(phone1),
      customer_phone_2: sanitizeInput(phone2),
      weight: sanitizeInput(weight),
      description: sanitizeInput(description),
      gps_lat: sanitizeInput(gpsLat),
      gps_lng: sanitizeInput(gpsLng),
      limit_date: sanitizeInput(limitDate),
      price: sanitizeInput(price),
      is_paid: isPaid,
    };

    // Validate package data comprehensively
    const validation = validatePackageData(sanitizedData);
    
    if (!validation.isValid) {
      Alert.alert("Erreur de validation", validation.error || "Veuillez corriger les erreurs dans le formulaire.");
      return;
    }

    // Additional validation for price if not paid
    if (!isPaid) {
      const priceValidation = validateNumber(sanitizedData.price, {
        required: true,
        minLength: 0.01,
        maxLength: 999999.99
      });
      
      if (!priceValidation.isValid) {
        Alert.alert("Erreur", priceValidation.error || "Le prix doit être un nombre positif.");
        return;
      }
    }

    // Validate GPS coordinates if provided
    if (sanitizedData.gps_lat || sanitizedData.gps_lng) {
      const coordValidation = validateCoordinates(sanitizedData.gps_lat, sanitizedData.gps_lng);
      if (!coordValidation.isValid) {
        Alert.alert("Erreur", coordValidation.error || "Coordonnées GPS invalides.");
        return;
      }
    }

    // Set default limit date to today if not provided
    const finalLimitDate = sanitizedData.limit_date || new Date().toISOString().split('T')[0];

    setLoading(true);
    try {
      // Import the local database functions
      const { createPackage } = await import('../utils/localDatabase');
      
      const timestamp = new Date().toISOString();
      const newIdNumber = Date.now() % 1000000;
      
      // Create package with validated and sanitized data
      await createPackage({
        ref_number: `PKG-${newIdNumber}`,
        status: "Pending",
        sender_name: sanitizedData.sender_name || undefined,
        sender_company: sanitizedData.sender_company || undefined,
        sender_phone: sanitizedData.sender_phone || undefined,
        date_of_arrive: sanitizedData.date_of_arrive || undefined,
        supplement_info: sanitizedData.supplement_info || undefined,
        customer_name: sanitizedData.customer_name,
        customer_address: sanitizedData.customer_address || undefined,
        customer_phone: sanitizedData.customer_phone || undefined,
        customer_phone_2: sanitizedData.customer_phone_2 || undefined,
        weight: sanitizedData.weight || undefined,
        description: sanitizedData.description || undefined,
        gps_lat: sanitizedData.gps_lat ? parseFloat(sanitizedData.gps_lat) : undefined,
        gps_lng: sanitizedData.gps_lng ? parseFloat(sanitizedData.gps_lng) : undefined,
        limit_date: finalLimitDate,
        price: isPaid ? 0 : parseFloat(sanitizedData.price),
        is_paid: isPaid,
        assigned_to: undefined,
        created_at: timestamp,
        assigned_at: undefined,
        accepted_at: undefined,
        delivered_at: undefined,
        return_reason: undefined,
      });

      Alert.alert("Succès", "Colis créé avec succès !");
      navigation.goBack();
    } catch (error) {
      console.error('Package creation error:', error);
      Alert.alert("Erreur", "Impossible de créer le colis. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} disabled={loading}>
            <Text style={styles.backText}>← Retour</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Nouveau Colis</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <Text style={styles.sectionTitle}>1. Informations Générales</Text>
          
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Expéditeur (Nom) *</Text>
            <TextInput style={styles.input} placeholder="Ex: Jean Dupont" value={senderName} onChangeText={setSenderName} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Entreprise Expéditeur (Optionnel)</Text>
            <TextInput style={styles.input} placeholder="Ex: Boutique Paris" value={senderCompany} onChangeText={setSenderCompany} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Téléphone Expéditeur</Text>
              <TextInput style={styles.input} placeholder="06..." keyboardType="phone-pad" value={senderPhone} onChangeText={setSenderPhone} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Date d'arrivée</Text>
              <TextInput style={styles.input} placeholder="JJ/MM/AAAA" value={dateOfArrive} onChangeText={setDateOfArrive} />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Infos Supplémentaires</Text>
            <TextInput style={styles.input} placeholder="Ex: Informations..." value={supplementInfo} onChangeText={setSupplementInfo} />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Nom du Client *</Text>
            <TextInput style={styles.input} placeholder="Ex: Jean Dupont" value={customerName} onChangeText={setCustomerName} />
          </View>

          <Text style={styles.sectionTitle}>2. Contact & Localisation</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Adresse de Livraison</Text>
            <TextInput style={styles.input} placeholder="Ex: 10 Rue de la Paix" value={address} onChangeText={setAddress} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Téléphone 1</Text>
              <TextInput style={styles.input} placeholder="06..." keyboardType="phone-pad" value={phone1} onChangeText={setPhone1} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Téléphone 2 (Optionnel)</Text>
              <TextInput style={styles.input} placeholder="07..." keyboardType="phone-pad" value={phone2} onChangeText={setPhone2} />
            </View>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>GPS Latitude</Text>
              <TextInput style={styles.input} placeholder="48.8566" keyboardType="numbers-and-punctuation" value={gpsLat} onChangeText={setGpsLat} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>GPS Longitude</Text>
              <TextInput style={styles.input} placeholder="2.3522" keyboardType="numbers-and-punctuation" value={gpsLng} onChangeText={setGpsLng} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>3. Détails du Colis</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Description</Text>
            <TextInput style={styles.input} placeholder="Ex: Vêtements fragiles" value={description} onChangeText={setDescription} />
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
              <Text style={styles.label}>Poids</Text>
              <TextInput style={styles.input} placeholder="Ex: 2.5kg" value={weight} onChangeText={setWeight} />
            </View>
            <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
              <Text style={styles.label}>Date Limite *</Text>
              <TextInput style={styles.input} placeholder="JJ/MM/AAAA (laisser vide = aujourd'hui)" value={limitDate} onChangeText={setLimitDate} />
            </View>
          </View>

          <Text style={styles.sectionTitle}>4. Facturation</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Montant (DH) {!isPaid && '*'}</Text>
            <TextInput 
              style={[styles.input, isPaid && styles.inputDisabled]} 
              placeholder="Ex: 50.00" 
              keyboardType="numeric" 
              value={price} 
              onChangeText={setPrice}
              editable={!isPaid}
            />
            {isPaid && <Text style={styles.disabledNote}>Montant non requis si déjà payé</Text>}
          </View>

          <View style={styles.switchGroup}>
            <Text style={styles.label}>Déjà Payé (Pas de COD)</Text>
            <Switch
              value={isPaid}
              onValueChange={handlePaymentStatusChange}
              trackColor={{ false: '#D1D5DB', true: '#10B981' }}
            />
          </View>

          <TouchableOpacity style={[styles.submitBtn, loading && styles.submitBtnDisabled]} onPress={handleAddPackage} disabled={loading}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Créer le Colis</Text>}
          </TouchableOpacity>
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  backText: { color: '#3B82F6', fontSize: 16, fontWeight: '600' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  scrollContent: { padding: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2937', marginTop: 16, marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '700', color: '#4B5563', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D1D5DB',
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: '#111827',
  },
  switchGroup: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 32, backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12,
    borderWidth: 1, borderColor: '#D1D5DB',
  },
  submitBtn: { backgroundColor: '#111827', paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#9CA3AF' },
  inputDisabled: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
  disabledNote: { fontSize: 11, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },
  submitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
