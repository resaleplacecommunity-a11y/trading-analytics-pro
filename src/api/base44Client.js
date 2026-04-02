import { createClient } from '@base44/sdk';
import { appParams } from '@/lib/app-params';

const { appId, serverUrl, token, functionsVersion } = appParams;

const safeServerUrl = (serverUrl && serverUrl !== 'null') ? serverUrl : 'https://app.base44.com';
const safeAppId = (appId && appId !== 'null') ? appId : '69349b30698117be30e537d8';

//Create a client with authentication required
export const base44 = createClient({
  appId: safeAppId,
  serverUrl: safeServerUrl,
  token,
  functionsVersion,
  requiresAuth: false
});
