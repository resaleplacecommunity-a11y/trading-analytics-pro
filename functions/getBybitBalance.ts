import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

const PROXY_URL = 'https://baghdad-sectors-labels-closing.trycloudflare.com';
const ENDPOINT = '/proxy';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proxySecret = Deno.env.get('BYBIT_PROXY_SECRET');

    const response = await fetch(`${PROXY_URL}${ENDPOINT}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Proxy-Secret': proxySecret,
      },
      body: JSON.stringify({
        type: 'get_wallet_balance',
        accountType: 'UNIFIED',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return Response.json({
        error: errorData.detail || 'Proxy request failed',
        status: response.status,
      }, { status: response.status });
    }

    const data = await response.json();

    // Parse USDT balance from response
    let usdtBalance = null;
    if (data?.result?.list?.[0]?.coin) {
      const usdtCoin = data.result.list[0].coin.find(c => c.coin === 'USDT');
      if (usdtCoin) {
        usdtBalance = parseFloat(usdtCoin.walletBalance);
      }
    }

    return Response.json({
      success: true,
      balance: usdtBalance,
      rawData: data,
    });
  } catch (error) {
    return Response.json({
      error: error.message || 'Internal server error',
      success: false,
    }, { status: 500 });
  }
});