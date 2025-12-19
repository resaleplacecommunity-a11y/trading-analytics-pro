import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

// Normalize proxy URL - remove trailing slash and /proxy endpoint
function getProxyEndpoint() {
  let url = Deno.env.get('BYBIT_PROXY_URL') || '';
  url = url.replace(/\/+$/, ''); // Remove trailing slashes
  url = url.replace(/\/proxy$/, ''); // Remove /proxy if someone added it
  return `${url}/proxy`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const proxySecret = Deno.env.get('BYBIT_PROXY_SECRET');
    if (!proxySecret) {
      return Response.json({ error: 'BYBIT_PROXY_SECRET not configured' }, { status: 500 });
    }

    const endpoint = getProxyEndpoint();

    const response = await fetch(endpoint, {
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
        error: errorData.detail || `Request failed with status code ${response.status}`,
        status: response.status,
      }, { status: response.status });
    }

    const data = await response.json();

    let usdtBalance = null;
    if (data?.result?.list?.[0]?.coin) {
      const usdtCoin = data.result.list[0].coin.find(c => c.coin === 'USDT');
      if (usdtCoin) {
        usdtBalance = parseFloat(usdtCoin.walletBalance || usdtCoin.equity || 0);
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