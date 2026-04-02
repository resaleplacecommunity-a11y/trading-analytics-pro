import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

//Create a client with authentication required
export const base44 = createClient({
  appId: appId || '69349b30698117be30e537d8',
  serverUrl: serverUrl || 'https://app.base44.com',
  token,
  functionsVersion,
  requiresAuth: false
});
