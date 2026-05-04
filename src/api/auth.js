import { supabase } from './supabaseClient';

export const User = {
  async me() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) throw error || new Error('Not authenticated');
    return {
      id: user.id,
      email: user.email,
      full_name: user.user_metadata?.full_name || '',
      profile_image: user.user_metadata?.avatar_url || '',
      preferred_timezone: user.user_metadata?.preferred_timezone || 'UTC',
    };
  },

  async loginViaEmailPassword(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async register(emailOrObj, password, name) {
    // Accept both register({ email, password }) and register(email, password, name)
    const resolvedEmail = typeof emailOrObj === 'object' ? emailOrObj.email : emailOrObj;
    const resolvedPassword = typeof emailOrObj === 'object' ? emailOrObj.password : password;
    const resolvedName = typeof emailOrObj === 'object' ? emailOrObj.name : name;
    const { data, error } = await supabase.auth.signUp({
      email: resolvedEmail,
      password: resolvedPassword,
      options: { data: { full_name: resolvedName || '' } },
    });
    if (error) throw error;
    return data;
  },

  async loginWithProvider(provider, redirectTo = '/') {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}${redirectTo}`,
      },
    });
    if (error) throw error;
    return data;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  async updateMe(updates) {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    return data;
  },

  onAuthStateChange(callback) {
    return supabase.auth.onAuthStateChange(callback);
  },
};
