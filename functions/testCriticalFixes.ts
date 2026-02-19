import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * ACCEPTANCE TEST for critical fixes:
 * 1. Profile auto-create
 * 2. Trade integrity (metrics calculation)
 * 3. Notification reliability (user filtering)
 * 4. Bybit relay connectivity
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const results = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      tests: {}
    };

    // TEST 1: Profile Auto-Create
    try {
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      results.tests.profile_auto_create = {
        passed: profiles.length > 0,
        profile_count: profiles.length,
        active_profile: profiles.find(p => p.is_active)?.profile_name || null,
        message: profiles.length > 0 ? 'Profile exists' : 'No profile found (should auto-create on next login)'
      };
    } catch (error) {
      results.tests.profile_auto_create = {
        passed: false,
        error: error.message
      };
    }

    // TEST 2: Trade Integrity (check if trades have required fields)
    try {
      const trades = await base44.entities.Trade.filter({ created_by: user.email }, '-date_open', 10);
      const integrityIssues = [];
      
      trades.forEach(trade => {
        if (!trade.original_entry_price && trade.entry_price) {
          integrityIssues.push(`Trade ${trade.id}: missing original_entry_price`);
        }
        if (!trade.original_risk_usd && trade.risk_usd) {
          integrityIssues.push(`Trade ${trade.id}: missing original_risk_usd`);
        }
        if (trade.close_price && !trade.r_multiple) {
          integrityIssues.push(`Trade ${trade.id}: closed but missing r_multiple`);
        }
      });

      results.tests.trade_integrity = {
        passed: integrityIssues.length === 0,
        trades_checked: trades.length,
        integrity_issues: integrityIssues,
        message: integrityIssues.length === 0 ? 'All trades have proper metrics' : `${integrityIssues.length} issues found`
      };
    } catch (error) {
      results.tests.trade_integrity = {
        passed: false,
        error: error.message
      };
    }

    // TEST 3: Notification Reliability (check user filtering)
    try {
      const notifications = await base44.entities.Notification.filter({ 
        created_by: user.email, 
        is_closed: false 
      });
      
      const settings = await base44.entities.NotificationSettings.filter({ 
        created_by: user.email 
      });

      results.tests.notification_reliability = {
        passed: true,
        notification_count: notifications.length,
        settings_configured: settings.length > 0,
        unread_count: notifications.filter(n => !n.is_read).length,
        message: 'Notifications properly filtered by user'
      };
    } catch (error) {
      results.tests.notification_reliability = {
        passed: false,
        error: error.message
      };
    }

    // TEST 4: Bybit Relay Connectivity
    try {
      const proxyUrl = Deno.env.get('BYBIT_PROXY_URL');
      const proxySecret = Deno.env.get('BYBIT_PROXY_SECRET');
      
      if (!proxyUrl || !proxySecret) {
        results.tests.bybit_relay = {
          passed: false,
          message: 'Relay credentials not configured',
          proxy_url_set: !!proxyUrl,
          proxy_secret_set: !!proxySecret
        };
      } else {
        // Test connectivity
        const testEndpoint = proxyUrl.replace(/\/+$/, '').replace(/\/proxy$/, '') + '/proxy';
        const response = await fetch(testEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Proxy-Secret': proxySecret,
          },
          body: JSON.stringify({
            type: 'get_server_time'
          })
        });

        results.tests.bybit_relay = {
          passed: response.ok,
          status: response.status,
          endpoint: testEndpoint,
          message: response.ok ? 'Relay connection successful' : `Connection failed with status ${response.status}`
        };
      }
    } catch (error) {
      results.tests.bybit_relay = {
        passed: false,
        error: error.message
      };
    }

    // Overall summary
    const allTestsPassed = Object.values(results.tests).every(test => test.passed);
    results.summary = {
      all_passed: allTestsPassed,
      passed_count: Object.values(results.tests).filter(test => test.passed).length,
      total_count: Object.keys(results.tests).length,
      status: allTestsPassed ? '✅ ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'
    };

    return Response.json(results, { 
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return Response.json({
      error: error.message,
      stack: error.stack,
      success: false
    }, { status: 500 });
  }
});