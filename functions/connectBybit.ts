import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { createHmac } from 'node:crypto';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({
        ok: false,
        connected: false,
        message: 'Authentication required',
        errorCode: 'AUTH_REQUIRED',
        nextStep: 'Please log in to continue',
        lastCheckedAt: new Date().toISOString()
      }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { apiKey, apiSecret, environment = 'mainnet' } = payload;

    // Validate inputs
    if (!apiKey || !apiSecret) {
      return Response.json({
        ok: false,
        connected: false,
        message: 'API credentials are required',
        errorCode: 'MISSING_CREDENTIALS',
        nextStep: 'Enter both API Key and API Secret',
        lastCheckedAt: new Date().toISOString()
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
        message: 'No active trading profile found',
        errorCode: 'NO_ACTIVE_PROFILE',
        nextStep: 'Create or activate a trading profile in Settings',
        lastCheckedAt: new Date().toISOString()
      }, { status: 400 });
    }

    const activeProfile = profiles[0];

    // Get relay configuration
    const relayUrl = Deno.env.get('BYBIT_PROXY_URL');
    const relaySecret = Deno.env.get('BYBIT_PROXY_SECRET');

    if (!relayUrl || !relaySecret) {
      console.error('[connectBybit] Missing relay configuration');
      return Response.json({
        ok: false,
        connected: false,
        message: 'Exchange relay not configured',
        errorCode: 'RELAY_NOT_CONFIGURED',
        nextStep: 'Contact support - relay configuration missing',
        lastCheckedAt: new Date().toISOString()
      }, { status: 500 });
    }

    // Test connection through relay with a real private endpoint
    // Use Get Wallet Balance endpoint (requires authentication)
    const timestamp = Date.now().toString();
    const testEndpoint = '/v5/account/wallet-balance';
    const testParams = `accountType=UNIFIED&timestamp=${timestamp}`;
    const testParamString = testParams;

    // Create Bybit signature
    const signString = timestamp + apiKey + '5000' + testParamString;
    const signature = createHmac('sha256', apiSecret)
      .update(signString)
      .digest('hex');

    console.log(`[connectBybit] Testing connection via relay for profile ${activeProfile.id}`);

    // Call relay server
    const relayResponse = await fetch(`${relayUrl}/v5/account/wallet-balance?${testParams}`, {
      method: 'GET',
      headers: {
        'X-BAPI-API-KEY': apiKey,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-SIGN': signature,
        'X-BAPI-RECV-WINDOW': '5000',
        'X-Relay-Secret': relaySecret
      }
    });

    const responseData = await relayResponse.json();

    console.log(`[connectBybit] Relay response status: ${relayResponse.status}, retCode: ${responseData.retCode}`);

    // Check Bybit response
    if (!relayResponse.ok || responseData.retCode !== 0) {
      const errorMsg = responseData.retMsg || 'Unknown error';
      const retCode = responseData.retCode;

      let userMessage = 'Failed to connect to Bybit';
      let errorCode = 'CONNECTION_FAILED';
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
      } else if (errorMsg.includes('ip')) {
        userMessage = 'IP address not whitelisted';
        errorCode = 'IP_NOT_ALLOWED';
        nextStep = 'Remove IP restrictions from your Bybit API key settings or whitelist the relay server IP';
      } else {
        userMessage = `Bybit error: ${errorMsg}`;
        errorCode = 'BYBIT_ERROR';
        nextStep = `Bybit returned error code ${retCode}. Check your API settings`;
      }

      console.error(`[connectBybit] Connection failed: ${errorCode} - ${userMessage}`);

      return Response.json({
        ok: false,
        connected: false,
        message: userMessage,
        errorCode,
        nextStep,
        lastCheckedAt: new Date().toISOString(),
        debug: { retCode, retMsg: errorMsg }
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
      message: 'Bybit connected successfully',
      errorCode: null,
      nextStep: 'You can now sync your trade history and balances',
      lastCheckedAt: new Date().toISOString(),
      balance: responseData.result?.list?.[0]?.totalWalletBalance || null
    });

  } catch (error) {
    console.error('[connectBybit] Unexpected error:', error.message);
    
    // Map common network errors
    let userMessage = 'Connection failed';
    let errorCode = 'NETWORK_ERROR';
    let nextStep = 'Check your internet connection and try again';

    if (error.message.includes('fetch') || error.message.includes('network')) {
      userMessage = 'Cannot reach exchange relay';
      errorCode = 'RELAY_UNREACHABLE';
      nextStep = 'The relay server may be down. Try again in a few minutes';
    } else if (error.message.includes('timeout')) {
      userMessage = 'Connection timeout';
      errorCode = 'TIMEOUT';
      nextStep = 'The request took too long. Try again';
    }

    return Response.json({
      ok: false,
      connected: false,
      message: userMessage,
      errorCode,
      nextStep,
      lastCheckedAt: new Date().toISOString()
    }, { status: 500 });
  }
});