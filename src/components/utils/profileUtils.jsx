import { base44 } from '@/api/base44Client';

/**
 * Get trades filtered by active profile
 */
export async function getTradesForActiveProfile() {
  const profiles = await base44.entities.UserProfile.list('-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  
  if (!activeProfile) {
    return [];
  }
  
  return base44.entities.Trade.filter({ profile_id: activeProfile.id }, '-date', 1000);
}

/**
 * Get active profile ID
 */
export async function getActiveProfileId() {
  const profiles = await base44.entities.UserProfile.list('-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  return activeProfile?.id || null;
}

/**
 * Get data for active profile (generic)
 */
export async function getDataForActiveProfile(entityName, sortField = '-created_date', limit = 1000) {
  const profiles = await base44.entities.UserProfile.list('-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  
  if (!activeProfile) {
    return [];
  }
  
  return base44.entities[entityName].filter({ profile_id: activeProfile.id }, sortField, limit);
}