import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

function getProxyEndpoint() {
  let url = Deno.env.get('BYBIT_PROXY_URL') || '';
  url = url.replace(/\/+$/, '');
  url = url.replace(/\/proxy$/, '');
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

    // Get walletBalance (NOT equity - without unrealized PnL)
    let usdtBalance = null;
    if (data?.result?.list?.[0]) {
      const account = data.result.list[0];
      
      // Try to get USDT coin walletBalance
      if (account.coin) {
        const usdtCoin = account.coin.find(c => c.coin === 'USDT');
        if (usdtCoin && usdtCoin.walletBalance) {
          usdtBalance = parseFloat(usdtCoin.walletBalance);
        }
      }
      
      // Fallback to totalWalletBalance
      if (usdtBalance === null && account.totalWalletBalance) {
        usdtBalance = parseFloat(account.totalWalletBalance);
      }
    }

    return Response.json({
      success: true,
      balance: usdtBalance,
    });
  } catch (error) {
    return Response.json({
      error: error.message || 'Internal server error',
      success: false,
    }, { status: 500 });
  }
});