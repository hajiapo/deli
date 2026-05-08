/**
 * Offline Export Utility
 * 
 * Allows drivers to export package status updates when Firebase is down.
 * Supports multiple formats: WhatsApp, Email, CSV, PDF-like text
 */

import { Alert, Platform } from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { Package } from '../types';


// ============================================
// FORMAT GENERATORS
// ============================================

/**
 * Generate simple text format for WhatsApp/SMS - FOCUSED ON DELIVERY STATUS
 */
export const generateTextReport = (packages: Package[], driverName?: string): string => {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  // Count by delivery status
  const delivered = packages.filter(p => p.status === 'Delivered');
  const notDelivered = packages.filter(p => p.status !== 'Delivered');
  const returned = packages.filter(p => p.status === 'Returned');
  
  const header = `📦 ÉTAT DES LIVRAISONS
Driver: ${driverName || 'N/A'}
Date: ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ LIVRÉS: ${delivered.length}
❌ NON LIVRÉS: ${notDelivered.length}
⚠️ RETOURNÉS: ${returned.length}

📋 LISTE DES COLIS:
`;

  // Sort by delivery status - Delivered first, then others
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  const packageLines = sortedPackages.map((pkg, index) => {
    const isDelivered = pkg.status === 'Delivered';
    const isReturned = pkg.status === 'Returned';
    const statusIcon = isDelivered ? '✅' : isReturned ? '⚠️' : '❌';
    
    return `${index + 1}. ${statusIcon} ${pkg.ref_number} - ${isDelivered ? 'LIVRÉ' : isReturned ? 'RETOURNÉ' : pkg.status}
   👤 ${pkg.customer_name || 'Client'} - ${pkg.customer_phone || 'N/A'}
   💰 ${pkg.price?.toFixed(2)} DH ${pkg.is_paid ? '(PAYÉ)' : '(COD)'}
   ${pkg.delivered_at ? `📅 Livré: ${new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}` : ''}
   ${pkg.return_reason ? `🔙 Raison: ${pkg.return_reason}` : ''}
`;
  }).join('\n');

  const summary = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
� RÉSUMÉ FINANCIER:
✓ Encaissé: ${delivered.filter(p => !p.is_paid).reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH
� Total colis: ${packages.length}
� Taux livraison: ${packages.length > 0 ? ((delivered.length / packages.length) * 100).toFixed(1) : 0}%
`;

  return header + packageLines + summary;
};

/**
 * Generate CSV format for spreadsheet import - FOCUSED ON DELIVERY STATUS
 */
export const generateCSV = (packages: Package[]): string => {
  const headers = [
    'STATUT_LIVRAISON',
    'Référence',
    'Client',
    'Téléphone',
    'Montant',
    'Payé',
    'Date_Livraison',
    'Accepté_Le',
    'Adresse',
    'Raison_Retour'
  ].join(',');

  // Sort by delivery status - Delivered first
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  const rows = sortedPackages.map(pkg => {
    const isDelivered = pkg.status === 'Delivered';
    const deliveryStatus = isDelivered ? 'LIVRÉ' : pkg.status === 'Returned' ? 'RETOURNÉ' : 'NON LIVRÉ';
    
    return [
      `"${deliveryStatus}"`,
      pkg.ref_number,
      `"${pkg.customer_name || ''}"`,
      pkg.customer_phone || '',
      pkg.price?.toFixed(2) || '0',
      pkg.is_paid ? 'OUI' : 'NON',
      pkg.delivered_at ? new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '',
      pkg.accepted_at ? new Date(pkg.accepted_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'}) : '',
      `"${pkg.customer_address || ''}"`,
      `"${pkg.return_reason || ''}"`
    ].join(',');
  }).join('\n');

  return headers + '\n' + rows;
};

/**
 * Generate detailed report (PDF-like text format) - FOCUSED ON DELIVERY STATUS
 */
export const generateDetailedReport = (packages: Package[], driverName?: string): string => {
  const timestamp = new Date().toLocaleString('fr-FR');
  
  // Count by delivery status
  const delivered = packages.filter(p => p.status === 'Delivered');
  const notDelivered = packages.filter(p => p.status !== 'Delivered');
  const returned = packages.filter(p => p.status === 'Returned');
  
  let report = `╔════════════════════════════════════════════════════════════╗
║              ÉTAT DES LIVRAISONS - RAPPORT DÉTAILLÉ           ║
╚════════════════════════════════════════════════════════════╝

Driver: ${driverName || 'N/A'}
Date du rapport: ${timestamp}
Total colis: ${packages.length}

╔════════════════════════════════════════════════════════════╗
║                       RÉSUMÉ LIVRAISON                     ║
╚════════════════════════════════════════════════════════════╝
✅ LIVRÉS:        ${delivered.length} colis
❌ NON LIVRÉS:     ${notDelivered.length} colis  
⚠️ RETOURNÉS:     ${returned.length} colis
📊 TAUX LIVRAISON: ${packages.length > 0 ? ((delivered.length / packages.length) * 100).toFixed(1) : 0}%
💵 CASH COLLECTÉ:  ${delivered.filter(p => !p.is_paid).reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH

`;

  // Sort by delivery status - Delivered first, then others
  const sortedPackages = [...packages].sort((a, b) => {
    if (a.status === 'Delivered' && b.status !== 'Delivered') return -1;
    if (a.status !== 'Delivered' && b.status === 'Delivered') return 1;
    return 0;
  });

  // Group by delivery status for better organization
  const byStatus = {
    'LIVRÉ': delivered,
    'RETOURNÉ': returned,
    'NON LIVRÉ': packages.filter(p => p.status !== 'Delivered' && p.status !== 'Returned'),
  };

  Object.entries(byStatus).forEach(([status, pkgs]) => {
    if (pkgs.length === 0) return;
    
    const statusIcon = status === 'LIVRÉ' ? '✅' : status === 'RETOURNÉ' ? '⚠️' : '❌';
    
    report += `\n${'═'.repeat(60)}\n`;
    report += `${statusIcon} ${status} (${pkgs.length} colis)\n`;
    report += `${'═'.repeat(60)}\n\n`;

    pkgs.forEach((pkg, index) => {
      report += `${index + 1}. ${pkg.ref_number}\n`;
      report += `   Client: ${pkg.customer_name || 'N/A'}\n`;
      report += `   Téléphone: ${pkg.customer_phone || 'N/A'}\n`;
      report += `   Montant: ${pkg.price?.toFixed(2)} DH ${pkg.is_paid ? '(PAYÉ)' : '(COD)'}\n`;
      
      if (pkg.customer_address) {
        report += `   Adresse: ${pkg.customer_address}\n`;
      }
      
      if (status === 'LIVRÉ' && pkg.delivered_at) {
        report += `   📅 DATE LIVRAISON: ${new Date(pkg.delivered_at).toLocaleString('fr-FR', {day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'})}\n`;
      }
      
      if (status === 'RETOURNÉ' && pkg.return_reason) {
        report += `   🔙 RAISON RETOUR: ${pkg.return_reason}\n`;
      }
      
      if (status === 'NON LIVRÉ') {
        report += `   📋 STATUT ACTUEL: ${pkg.status}\n`;
      }
      
      report += '\n';
    });
  });

  // Summary
  const totalCash = packages
    .filter(p => p.status === 'Delivered' && !p.is_paid)
    .reduce((sum, p) => sum + (p.price || 0), 0);

  report += `\n${'═'.repeat(60)}\n`;
  report += `RÉSUMÉ FINANCIER\n`;
  report += `${'═'.repeat(60)}\n`;
  report += `Cash collecté (COD): ${totalCash.toFixed(2)} DH\n`;
  report += `Colis payés: ${packages.filter(p => p.is_paid).length}\n`;
  report += `Colis COD: ${packages.filter(p => !p.is_paid).length}\n`;
  report += `\nRevenu total: ${packages.reduce((sum, p) => sum + (p.price || 0), 0).toFixed(2)} DH\n`;

  return report;
};

/**
 * Generate JSON format for technical backup
 */
export const generateJSON = (packages: Package[]): string => {
  const exportData = {
    exportDate: new Date().toISOString(),
    version: '1.0',
    packageCount: packages.length,
    packages: packages.map(pkg => ({
      id: pkg.id,
      ref_number: pkg.ref_number,
      status: pkg.status,
      customer_name: pkg.customer_name,
      customer_address: pkg.customer_address,
      customer_phone: pkg.customer_phone,
      customer_phone_2: pkg.customer_phone_2,
      price: pkg.price,
      is_paid: pkg.is_paid,
      limit_date: pkg.limit_date,
      accepted_at: pkg.accepted_at,
      delivered_at: pkg.delivered_at,
      return_reason: pkg.return_reason,
      _lastModified: pkg._lastModified,
    }))
  };

  return JSON.stringify(exportData, null, 2);
};

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export via WhatsApp
 */
export const exportViaWhatsApp = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const message = generateTextReport(packages, driverName);
    
    // Try WhatsApp URL scheme first
    const whatsappUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    
    await Share.open({
      message: message,
    });
  } catch (error) {
    console.error('WhatsApp export error:', error);
    
    // Fallback to general share
    try {
      await Share.open({
        message: generateTextReport(packages, driverName),
      });
    } catch (fallbackError) {
      Alert.alert('Erreur', 'Impossible d\'ouvrir WhatsApp. Assurez-vous qu\'il est installé.');
    }
  }
};

/**
 * Export as CSV file
 */
export const exportAsCSV = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const csv = generateCSV(packages);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `livraisons_${driverName || 'driver'}_${timestamp}.csv`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write file
    await RNFS.writeFile(path, csv, 'utf8');
    
    // Share file
    await Share.open({
      url: Platform.OS === 'android' ? `file://${path}` : path,
      type: 'text/csv',
      title: 'Exporter le rapport',
      subject: `Rapport de livraison - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('CSV export error:', error);
    Alert.alert('Erreur', 'Impossible de créer le fichier CSV.');
  }
};

/**
 * Export as detailed text report
 */
export const exportAsTextReport = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const report = generateDetailedReport(packages, driverName);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `rapport_${driverName || 'driver'}_${timestamp}.txt`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write file
    await RNFS.writeFile(path, report, 'utf8');
    
    // Share file
    await Share.open({
      url: Platform.OS === 'android' ? `file://${path}` : path,
      type: 'text/plain',
      title: 'Exporter le rapport détaillé',
      subject: `Rapport détaillé - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('Text report export error:', error);
    Alert.alert('Erreur', 'Impossible de créer le rapport.');
  }
};

/**
 * Export as JSON backup
 */
export const exportAsJSON = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const json = generateJSON(packages);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backup_${driverName || 'driver'}_${timestamp}.json`;
    const path = `${RNFS.DocumentDirectoryPath}/${filename}`;
    
    // Write file
    await RNFS.writeFile(path, json, 'utf8');
    
    // Share file
    await Share.open({
      url: Platform.OS === 'android' ? `file://${path}` : path,
      type: 'application/json',
      title: 'Exporter la sauvegarde',
      subject: `Sauvegarde - ${driverName || 'Driver'}`,
    });
  } catch (error) {
    console.error('JSON export error:', error);
    Alert.alert('Erreur', 'Impossible de créer la sauvegarde JSON.');
  }
};

/**
 * Export via Email
 */
export const exportViaEmail = async (packages: Package[], driverName?: string, adminEmail?: string): Promise<void> => {
  try {
    const report = generateDetailedReport(packages, driverName);
    const subject = `Rapport de livraison - ${driverName || 'Driver'} - ${new Date().toLocaleDateString('fr-FR')}`;
    
    await Share.open({
      message: report,
      subject: subject,
      email: adminEmail,
    });
  } catch (error) {
    console.error('Email export error:', error);
    Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application email.');
  }
};

/**
 * Quick share (let user choose app)
 */
export const quickShare = async (packages: Package[], driverName?: string): Promise<void> => {
  try {
    const message = generateTextReport(packages, driverName);
    
    await Share.open({
      message: message,
      title: 'Partager le rapport',
    });
  } catch (error) {
    if ((error as any).message !== 'User did not share') {
      console.error('Quick share error:', error);
      Alert.alert('Erreur', 'Impossible de partager le rapport.');
    }
  }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get emoji for status
 */
const getStatusEmoji = (status: string): string => {
  const emojiMap: Record<string, string> = {
    'Pending': '📋',
    'Assigned': '📦',
    'In Transit': '🚚',
    'Delivered': '✅',
    'Returned': '⚠️',
  };
  return emojiMap[status] || '📦';
};

/**
 * Show export options dialog
 */
export const showExportOptions = (packages: Package[], driverName?: string, adminEmail?: string): void => {
  Alert.alert(
    '📤 Exporter le rapport',
    'Choisissez le format d\'export:',
    [
      {
        text: '💬 WhatsApp',
        onPress: () => exportViaWhatsApp(packages, driverName),
      },
      {
        text: '📧 Email',
        onPress: () => exportViaEmail(packages, driverName, adminEmail),
      },
      {
        text: '📊 CSV (Excel)',
        onPress: () => exportAsCSV(packages, driverName),
      },
      {
        text: '📄 Rapport détaillé',
        onPress: () => exportAsTextReport(packages, driverName),
      },
      {
        text: '💾 Backup JSON',
        onPress: () => exportAsJSON(packages, driverName),
      },
      {
        text: '📱 Partager',
        onPress: () => quickShare(packages, driverName),
      },
      {
        text: 'Annuler',
        style: 'cancel',
      },
    ],
    { cancelable: true }
  );
};
