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

    // Get bridge server URL
    const bridgeUrl = Deno.env.get('BYBIT_BRIDGE_URL') || Deno.env.get('BYBIT_PROXY_URL');

    if (!bridgeUrl) {
      console.error('[connectBybit] BYBIT_BRIDGE_URL not configured');
      return Response.json({
        ok: false,
        connected: false,
        exchange: 'bybit',
        message: 'Bridge server not configured',
        errorCode: 'BRIDGE_NOT_CONFIGURED',
        nextStep: 'Contact support - bridge server URL missing',
        checkedAt: new Date().toISOString()
      }, { status: 500 });
    }

    console.log(`[connectBybit] Connecting to bridge server for profile ${activeProfile.id}, env: ${environment}`);

    // Call bridge server
    const bridgeEndpoint = `${bridgeUrl}/bybit/connect`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let bridgeResponse;
    try {
      bridgeResponse = await fetch(bridgeEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiKey,
          apiSecret,
          environment
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

    console.log(`[connectBybit] Bridge response status: ${bridgeResponse.status}`);

    // Handle non-2xx responses
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
      message: responseData.message || 'Bybit connected successfully',
      checkedAt: new Date().toISOString(),
      ...(responseData.balance && { balance: responseData.balance }),
      ...(responseData.accountType && { accountType: responseData.accountType })
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