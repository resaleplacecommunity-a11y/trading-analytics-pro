/**
 * Centralized Exchange Relay Configuration
 * Single source of truth for all exchange proxy/relay settings
 */

export function getRelayConfig() {
  const relayUrl = (
    Deno.env.get('BYBIT_PROXY_URL') || 
    Deno.env.get('BYBIT_BRIDGE_URL') || 
    Deno.env.get('EXCHANGE_PROXY_URL') || 
    ''
  ).replace(/\/+$/, '');

  const relaySecret = 
    Deno.env.get('BYBIT_PROXY_SECRET') || 
    Deno.env.get('EXCHANGE_PROXY_SECRET') || 
    '';

  // Reject temporary tunnel URLs in production
  const isTempTunnel = relayUrl.includes('trycloudflare.com') || 
                       relayUrl.includes('loca.lt') || 
                       relayUrl.includes('ngrok.io') ||
                       relayUrl.includes('serveo.net');

  if (isTempTunnel) {
    throw new Error('CONFIG_ERROR: Temporary tunnel URL detected. Use permanent relay URL.');
  }

  if (!relayUrl || !relaySecret) {
    throw new Error('CONFIG_ERROR: BYBIT_PROXY_URL or BYBIT_PROXY_SECRET not configured');
  }

  return {
    relayUrl: relayUrl + '/proxy',
    relaySecret,
    timeout: 20000,
    retryPolicy: { maxRetries: 2, backoff: 1000 },
  };
}

export const ALLOWED_EXCHANGE_DOMAINS = [
  'api.bybit.com', 'api-demo.bybit.com',
  'api.binance.com', 'fapi.binance.com', 'testnet.binancefuture.com',
  'www.okx.com', 'aws.okx.com',
  'api.bitget.com',
  'api.kucoin.com', 'api-futures.kucoin.com',
  'api.gateio.ws',
  'api.mexc.com', 'contract.mexc.com',
  'open-api.bingx.com',
];

/**
 * Execute relay call with standardized error handling
 */
export async function relayCall(targetUrl, method, headers, params) {
  const { relayUrl, relaySecret, timeout } = getRelayConfig();

  // Allowlist check
  const hostname = new URL(targetUrl).hostname;
  if (!ALLOWED_EXCHANGE_DOMAINS.includes(hostname)) {
    throw new Error(`CONFIG_ERROR: Exchange domain not in allowlist: ${hostname}`);
  }

  let finalUrl = targetUrl;
  let bodyPayload = undefined;

  if (method === 'GET' && params && Object.keys(params).length > 0) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)]))
    ).toString();
    finalUrl = targetUrl + (targetUrl.includes('?') ? '&' : '?') + qs;
  } else if (method !== 'GET' && params) {
    bodyPayload = params;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(relayUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'x-relay-secret': relaySecret 
      },
      body: JSON.stringify({ 
        url: finalUrl, 
        method, 
        headers: headers || {}, 
        body: bodyPayload 
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`RELAY_ERROR: ${response.status} ${txt}`);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error('TIMEOUT: Relay request timed out');
    }
    throw error;
  }
}