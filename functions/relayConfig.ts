export function getRelayConfig() {
  // Canonical env names (preferred)
  const relayUrl = Deno.env.get('RELAY_BASE_URL') || ''; 
  const relaySecret = Deno.env.get('RELAY_SECRET') || '';

  // Backwards compatibility: check deprecated names but do NOT use runtime fallback
  if (!relayUrl) {
    const dep = Deno.env.get('EXCHANGE_PROXY_URL') || Deno.env.get('BYBIT_PROXY_URL') || '';
    if (dep) console.warn('DEPRECATED ENV: using EXCHANGE_PROXY_URL/BYBIT_PROXY_URL — switch to RELAY_BASE_URL');
    // do not overwrite canonical unless deliberately set above
  }
  if (!relaySecret) {
    const depS = Deno.env.get('EXCHANGE_PROXY_SECRET') || Deno.env.get('BYBIT_PROXY_SECRET') || '';
    if (depS) console.warn('DEPRECATED ENV: using EXCHANGE_PROXY_SECRET/BYBIT_PROXY_SECRET — switch to RELAY_SECRET');
  }

  return {
    relayUrl: relayUrl || (Deno.env.get('EXCHANGE_PROXY_URL') || Deno.env.get('BYBIT_PROXY_URL') || ''),
    relaySecret: relaySecret || (Deno.env.get('EXCHANGE_PROXY_SECRET') || Deno.env.get('BYBIT_PROXY_SECRET') || ''),
  };
}
