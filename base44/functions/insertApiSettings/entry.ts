import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { api_key, api_secret } = await req.json();

    if (!api_key || !api_secret) {
      return Response.json({ error: 'API Key and Secret required' }, { status: 400 });
    }

    // Check if already exists
    const existing = await base44.asServiceRole.entities.ApiSettings.filter({
      created_by: user.email
    });

    let result;
    if (existing && existing.length > 0) {
      // Update existing
      result = await base44.asServiceRole.entities.ApiSettings.update(existing[0].id, {
        api_key: api_key,
        api_secret: api_secret,
        is_active: true,
        exchange: 'bybit'
      });
    } else {
      // Create new
      result = await base44.asServiceRole.entities.ApiSettings.create({
        api_key: api_key,
        api_secret: api_secret,
        is_active: true,
        exchange: 'bybit',
        created_by: user.email
      });
    }

    return Response.json({
      success: true,
      message: 'API Settings saved successfully',
      data: result
    });

  } catch (error) {
    console.error('Insert error:', error);
    return Response.json({ 
      error: 'Failed to save API settings', 
      details: error.message 
    }, { status: 500 });
  }
});