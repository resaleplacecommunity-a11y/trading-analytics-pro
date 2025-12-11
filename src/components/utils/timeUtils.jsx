// Utility functions for timezone-aware date formatting

export const formatDateInTimezone = (dateString, timezone = 'Europe/Moscow', formatType = 'datetime') => {
  if (!dateString) return '—';
  
  try {
    const date = new Date(dateString);
    
    if (formatType === 'date') {
      return date.toLocaleDateString('ru-RU', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
    
    if (formatType === 'time') {
      return date.toLocaleTimeString('ru-RU', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    if (formatType === 'short') {
      const datePart = date.toLocaleDateString('ru-RU', {
        timeZone: timezone,
        day: '2-digit',
        month: '2-digit'
      });
      const timePart = date.toLocaleTimeString('ru-RU', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit'
      });
      return `${datePart} ${timePart}`;
    }
    
    // Default: full datetime
    return date.toLocaleString('ru-RU', {
      timeZone: timezone,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.error('Error formatting date:', error);
    return '—';
  }
};

export const getCurrentTimestamp = () => {
  return new Date().toISOString();
};