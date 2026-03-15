import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Relay proxy call - all Bybit API calls go through this
async function relayCall(url, method, headers, body) {
  const relayUrl = Deno.env.get('BYBIT_PROXY_URL');
  const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');

  if (!relayUrl || !relaySecret) {
    throw new Error('BYBIT_PROXY_URL or BYBIT_PROXY_SECRET not configured');
  }

  const response = await fetch(relayUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-relay-secret': relaySecret,
    },
    body: JSON.stringify({
      url,
      method,
      headers: headers || {},
      body: body || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`Relay failed: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

Deno.serve(async (req) => {
  const notifications = [];
  
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        notifications: ['❌ Authentication failed. Please log in again.']
      }, { status: 401 });
    }

    // Get active profile ID
    const profiles = await base44.asServiceRole.entities.UserProfile.filter({ 
      created_by: user.email,
      is_active: true 
    });
    
    if (!profiles.length) {
      return Response.json({ 
        error: 'No active profile',
        notifications: ['⚠️ No active trading profile found. Create a profile in Settings.']
      }, { status: 400 });
    }
    
    const activeProfileId = profiles[0].id;

    // Validate relay config
    const relayUrl = Deno.env.get('BYBIT_PROXY_URL');
    const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');
    
    if (!relayUrl || !relaySecret) {
      return Response.json({ 
        error: 'Relay not configured',
        notifications: ['❌ Bybit relay proxy not configured. Contact support.']
      }, { status: 500 });
    }


    // DELEGATE to canonical syncExchangeConnection
    try {
      // find connections for profile
      const appId = Deno.env.get('TAP_APP_ID');
      const base = Deno.env.get('TAP_BASE_URL') || 'https://base44.app';
      const token = Deno.env.get('TAP_TOKEN') || '';
      const listResp = await fetch(`${base}/api/apps/${appId}/functions/exchangeConnectionsApi`, {
        method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ _method:'GET', _path:'/connections', _query:{ profile_id: activeProfileId } })
      });
      const listJson = await listResp.json().catch(()=>({}));
      const conns = (listJson.connections || []);
      if (!conns.length) return Response.json({ ok:false, message:'No connection found', notifications: ['No connection for profile'] }, { status:400 });
      const connId = conns[0].id;
      // call canonical sync
      const syncResp = await fetch(`${base}/api/apps/${appId}/functions/syncExchangeConnection`, { method:'POST', headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ connection_id: connId, history_limit: 100 }) });
      const syncJson = await syncResp.json().catch(()=>({}));
      return Response.json(Object.assign({ ok: true }, syncJson));
    } catch(e) {
      return Response.json({ ok:false, message: 'Delegate sync failed', error: String(e) }, { status:500 });
    }
