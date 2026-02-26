import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        message: 'Authentication required',
        errorCode: 'AUTH_REQUIRED',
        nextStep: 'Please log in to continue',
        checkedAt: new Date().toISOString()
      }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { apiKey, apiSecret, environment = 'mainnet' } = payload;

    // Validate inputs
    if (!apiKey || !apiSecret) {
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        message: 'API credentials are required',
        errorCode: 'MISSING_CREDENTIALS',
        nextStep: 'Enter both API Key and API Secret',
        checkedAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Get active profile
    const profiles = await base44.entities.UserProfile.filter({ 
      created_by: user.email, 
      is_active: true 
    });

    if (profiles.length === 0) {
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        message: 'No active trading profile found',
        errorCode: 'NO_ACTIVE_PROFILE',
        nextStep: 'Create or activate a trading profile in Settings',
        checkedAt: new Date().toISOString()
      }, { status: 400 });
    }

    const activeProfile = profiles[0];

    // Get bridge server URL and secret
    const bridgeUrl = Deno.env.get('BYBIT_BRIDGE_URL') || Deno.env.get('BYBIT_PROXY_URL');
    const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');

    if (!bridgeUrl || !relaySecret) {
      console.error('[connectBybit] BYBIT_BRIDGE_URL or BYBIT_PROXY_SECRET not configured');
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        message: 'Bridge server not configured',
        errorCode: 'BRIDGE_NOT_CONFIGURED',
        nextStep: 'Contact support - bridge server URL or secret missing',
        checkedAt: new Date().toISOString()
      }, { status: 500 });
    }

    console.log(`[connectBybit] Connecting to bridge server for profile ${activeProfile.id}, env: ${environment}`);

    // Prepare Bybit API request
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const queryString = 'accountType=UNIFIED';
    
    // Create HMAC SHA256 signature
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiSecret);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const preSign = timestamp + apiKey + recvWindow + queryString;
    const signData = encoder.encode(preSign);
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, signData);
    const signature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Call bridge server proxy endpoint
    const bridgeEndpoint = `${bridgeUrl}/proxy`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let bridgeResponse;
    try {
      bridgeResponse = await fetch(bridgeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-relay-secret': relaySecret
        },
        body: JSON.stringify({
          url: 'https://api.bybit.com/v5/account/wallet-balance?accountType=UNIFIED',
          method: 'GET',
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recvWindow,
            'X-BAPI-SIGN': signature
          }
        }),
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        return Response.json({
          ok: false,
          connected: false,
          exchange: 'bybit',
          environment,
          message: 'Connection timeout',
          errorCode: 'TIMEOUT',
          nextStep: 'The bridge server took too long to respond. Try again',
          checkedAt: new Date().toISOString()
        }, { status: 500 });
      }

      console.error('[connectBybit] Bridge fetch error:', fetchError.message);
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        environment,
        message: 'Cannot reach bridge server',
        errorCode: 'BRIDGE_UNREACHABLE',
        nextStep: 'The bridge server may be down. Try again in a few minutes',
        checkedAt: new Date().toISOString()
      }, { status: 500 });
    }

    clearTimeout(timeoutId);

    const responseData = await bridgeResponse.json().catch(() => ({}));

    console.log(`[connectBybit] Bridge response status: ${bridgeResponse.status}, retCode: ${responseData.retCode}`);

    // Handle non-2xx responses from bridge
    if (!bridgeResponse.ok) {
      const errorMsg = responseData.message || responseData.error || `Bridge server error (${bridgeResponse.status})`;
      const errorCode = responseData.errorCode || 'BRIDGE_ERROR';
      const nextStep = responseData.nextStep || 'Check your API credentials and try again';

      console.error(`[connectBybit] Bridge error: ${errorCode} - ${errorMsg}`);

      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        environment,
        message: errorMsg,
        errorCode,
        nextStep,
        checkedAt: new Date().toISOString()
      }, { status: bridgeResponse.status });
    }

    // Check Bybit API response
    if (responseData.retCode && responseData.retCode !== 0) {
      const retCode = responseData.retCode;
      const retMsg = responseData.retMsg || 'Unknown error';

      let userMessage = 'Failed to connect to Bybit';
      let errorCode = 'BYBIT_ERROR';
      let nextStep = 'Verify your API credentials';

      // Map common Bybit error codes
      if (retCode === 10003 || retCode === 33004) {
        userMessage = 'Invalid API key';
        errorCode = 'INVALID_API_KEY';
        nextStep = 'Check that you copied the API key correctly';
      } else if (retCode === 10004 || retCode === 10005) {
        userMessage = 'Invalid API signature';
        errorCode = 'INVALID_SIGNATURE';
        nextStep = 'Check that you copied the API secret correctly';
      } else if (retCode === 10006) {
        userMessage = 'Missing API permissions';
        errorCode = 'INSUFFICIENT_PERMISSIONS';
        nextStep = 'Enable "Read" permission for Account and Position in Bybit API settings';
      } else if (retMsg.toLowerCase().includes('ip')) {
        userMessage = 'IP address not whitelisted';
        errorCode = 'IP_NOT_ALLOWED';
        nextStep = 'Remove IP restrictions from your Bybit API key settings or whitelist the bridge server IP';
      } else {
        userMessage = `Bybit error: ${retMsg}`;
        errorCode = 'BYBIT_ERROR';
        nextStep = `Bybit returned error code ${retCode}. Check your API settings`;
      }

      console.error(`[connectBybit] Bybit API error: ${errorCode} - ${userMessage}`);

      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        environment,
        message: userMessage,
        errorCode,
        nextStep,
        checkedAt: new Date().toISOString()
      }, { status: 400 });
    }

    // Connection successful - save settings
    console.log(`[connectBybit] Connection successful for profile ${activeProfile.id}`);

    const connectionData = {
      api_key: apiKey,
      api_secret: apiSecret,
      exchange: 'bybit',
      is_active: true,
      last_sync: new Date().toISOString()
    };

    // Check if ApiSettings exists for this profile
    const existingSettings = await base44.asServiceRole.entities.ApiSettings.filter({
      created_by: user.email,
      profile_id: activeProfile.id
    });

    if (existingSettings.length > 0) {
      await base44.asServiceRole.entities.ApiSettings.update(
        existingSettings[0].id, 
        connectionData
      );
    } else {
      await base44.asServiceRole.entities.ApiSettings.create({
        ...connectionData,
        created_by: user.email,
        profile_id: activeProfile.id
      });
    }

    return Response.json({
      ok: true,
      connected: true,
      exchange: 'bybit',
      environment,
      message: 'Bybit connected successfully',
      checkedAt: new Date().toISOString(),
      balance: responseData.result?.list?.[0]?.totalWalletBalance || null,
      accountType: 'UNIFIED'
    });

  } catch (error) {
    console.error('[connectBybit] Unexpected error:', error.message);
    
    return Response.json({
      ok: false,
      connected: false,
      exchange: 'bybit',
      environment: 'mainnet',
      message: error.message || 'Unexpected error occurred',
      errorCode: 'UNEXPECTED_ERROR',
      nextStep: 'Try again or contact support',
      checkedAt: new Date().toISOString()
    }, { status: 500 });
  }
});