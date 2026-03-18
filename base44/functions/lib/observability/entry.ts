/**
 * Structured logging and error normalization for exchange operations
 */

/**
 * Normalize errors into standard categories
 */
export function normalizeError(error, context = {}) {
  const message = error?.message || String(error);
  
  let errorClass = 'UNKNOWN_ERROR';
  let userMessage = message;
  
  if (message.includes('CONFIG_ERROR')) {
    errorClass = 'CONFIG_ERROR';
  } else if (message.includes('RELAY_ERROR') || message.includes('Relay')) {
    errorClass = 'RELAY_ERROR';
  } else if (message.includes('TIMEOUT') || message.includes('timeout') || message.includes('AbortError')) {
    errorClass = 'TIMEOUT';
    userMessage = 'Request timed out. Try again.';
  } else if (message.includes('401') || message.includes('Unauthorized') || message.includes('unauthorized')) {
    errorClass = 'AUTH_ERROR';
    userMessage = 'Authentication failed. Check credentials.';
  } else if (message.includes('403') || message.includes('Forbidden')) {
    errorClass = 'AUTH_ERROR';
    userMessage = 'Access denied.';
  } else if (message.includes('ENOTFOUND') || message.includes('DNS') || message.includes('getaddrinfo')) {
    errorClass = 'DNS_ERROR';
    userMessage = 'Network error. Check connectivity.';
  } else if (message.includes('retCode') || message.includes('Bybit')) {
    errorClass = 'UPSTREAM_ERROR';
  } else if (message.includes('VALIDATION') || message.includes('required')) {
    errorClass = 'VALIDATION_ERROR';
  } else if (message.includes('RATE_LIMITED')) {
    errorClass = 'RATE_LIMITED';
    userMessage = 'Too many requests. Slow down.';
  }

  return {
    errorClass,
    message: userMessage,
    originalMessage: message,
    timestamp: new Date().toISOString(),
    ...context,
  };
}

/**
 * Log structured exchange operation
 */
export function logExchangeOperation(params) {
  const {
    requestId,
    userId,
    profileId,
    action,
    exchange,
    relayUrl,
    status,
    latencyMs,
    errorClass,
    message,
  } = params;

  console.log(JSON.stringify({
    type: 'EXCHANGE_OPERATION',
    requestId,
    userId,
    profileId,
    action,
    exchange,
    relayUrl: relayUrl?.replace(/\/proxy$/, ''),
    status: status || 'unknown',
    latencyMs: latencyMs || null,
    errorClass: errorClass || null,
    message: message || null,
    timestamp: new Date().toISOString(),
  }));
}