import { base44 } from '@/api/base44Client';

/**
 * Get trades filtered by active profile
 */
export async function getTradesForActiveProfile() {
  const user = await base44.auth.me();
  if (!user) return [];
  
  const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  
  if (!activeProfile) {
    return [];
  }
  
  return base44.entities.Trade.filter({ 
    profile_id: activeProfile.id
  }, '-date_open', 10000);
}

/**
 * Get active profile ID
 */
export async function getActiveProfileId() {
  const user = await base44.auth.me();
  if (!user) return null;
  
  const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  return activeProfile?.id || null;
}

/**
 * Get data for active profile (generic)
 */
export async function getDataForActiveProfile(entityName, sortField = '-created_date', limit = 1000) {
  const user = await base44.auth.me();
  if (!user) return [];
  
  const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
  const activeProfile = profiles.find(p => p.is_active);
  
  if (!activeProfile) {
    return [];
  }
  
  return base44.entities[entityName].filter({ 
    profile_id: activeProfile.id
  }, sortField, limit);
}