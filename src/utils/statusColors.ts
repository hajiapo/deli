export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    Delivered: '#10B981',
    Returned: '#EF4444',
    'In Transit': '#F59E0B',
    Assigned: '#3B82F6',
    Pending: '#9CA3AF',
  };
  return colors[status] || '#9CA3AF';
};
