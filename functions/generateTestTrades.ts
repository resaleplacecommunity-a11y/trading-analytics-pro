import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { v4 as uuidv4 } from 'npm:uuid@10.0.0';

/**
 * GENERATE TEST TRADES
 * Profile-scoped, idempotent by run_id
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ 
        error: 'Unauthorized',
        error_code: 'AUTH_REQUIRED',
        next_step: 'Please log in'
      }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const { 
      count = 20, 
      mode = 'SMOKE', 
      seed = Date.now(), 
      includeOpen = true,
      request_id = null // For idempotency
    } = payload;

    // Get active profile - STRICT ownership check
    const profiles = await base44.entities.UserProfile.filter({ 
      created_by: user.email, 
      is_active: true 
    });

    if (profiles.length === 0) {
      return Response.json({ 
        error: 'No active profile found',
        error_code: 'NO_ACTIVE_PROFILE',
        next_step: 'Activate a profile in Settings'
      }, { status: 400 });
    }

    if (profiles.length > 1) {
      return Response.json({ 
        error: 'Multiple active profiles detected',
        error_code: 'INTEGRITY_VIOLATION',
        next_step: 'Contact support - profile integrity issue',
        active_count: profiles.length
      }, { status: 500 });
    }

    const activeProfile = profiles[0];
    const testRunId = request_id || uuidv4();

    // Idempotency check
    const existingRun = await base44.asServiceRole.entities.Trade.filter({
      profile_id: activeProfile.id,
      created_by: user.email,
      test_run_id: testRunId
    }, '-created_date', 1);

    if (existingRun.length > 0) {
      const totalExisting = await base44.asServiceRole.entities.Trade.filter({
        profile_id: activeProfile.id,
        created_by: user.email,
        test_run_id: testRunId
      });

      return Response.json({
        success: true,
        requested_count: count,
        inserted_count: 0,
        deduplicated_count: totalExisting.length,
        message: `Run ${testRunId} already exists (idempotent)`,
        profile_id: activeProfile.id,
        run_id: testRunId
      });
    }

    const rng = seededRandom(seed);

    const coins = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'ADAUSDT', 'DOGEUSDT', 'MATICUSDT'];
    const strategies = ['Breakout', 'Reversal', 'Trend Follow', 'Support/Resistance', 'Momentum'];
    const timeframes = ['scalp', 'day', 'swing', 'mid_term'];

    const trades = [];
    const startBalance = activeProfile.starting_balance || 100000;
    let currentBalance = startBalance;

    for (let i = 0; i < count; i++) {
      const isLong = rng() > 0.5;
      const coin = coins[Math.floor(rng() * coins.length)];
      const strategy = strategies[Math.floor(rng() * strategies.length)];
      const timeframe = timeframes[Math.floor(rng() * timeframes.length)];

      // Base price range
      let basePrice = 0;
      if (coin === 'BTCUSDT') basePrice = 40000 + rng() * 60000;
      else if (coin === 'ETHUSDT') basePrice = 2000 + rng() * 2000;
      else if (coin === 'SOLUSDT') basePrice = 80 + rng() * 120;
      else basePrice = 0.5 + rng() * 10;

      const entryPrice = basePrice;
      const positionSize = currentBalance * (0.01 + rng() * 0.04); // 1-5% of balance

      // Stop/Take calculation
      let stopPrice = null;
      let takePrice = null;
      let originalStopPrice = null;

      if (mode === 'EDGE' && rng() > 0.7) {
        // 30% no stop in EDGE mode
        stopPrice = null;
      } else {
        const stopPercent = 0.01 + rng() * 0.03; // 1-4%
        stopPrice = isLong 
          ? entryPrice * (1 - stopPercent)
          : entryPrice * (1 + stopPercent);
        originalStopPrice = stopPrice;
      }

      if (mode === 'EDGE' && rng() > 0.8) {
        // 20% no take in EDGE mode
        takePrice = null;
      } else {
        const takePercent = 0.02 + rng() * 0.08; // 2-10%
        takePrice = isLong
          ? entryPrice * (1 + takePercent)
          : entryPrice * (1 - takePercent);
      }

      // Risk calculation - null when no stop (undefined risk, not zero)
      let riskUsd = null;
      let riskPercent = null;
      if (stopPrice) {
        const stopDistance = Math.abs(entryPrice - stopPrice);
        riskUsd = stopDistance / entryPrice * positionSize;
        riskPercent = riskUsd / currentBalance * 100;
      }

      // Date generation
      const daysAgo = Math.floor(rng() * (mode === 'LOAD' ? 365 : 90));
      const dateOpen = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);

      let closePrice = null;
      let dateClose = null;
      let pnlUsd = 0;
      let rMultiple = null; // null when undefined, not 0
      let addsHistory = null;
      let partialCloses = null;
      let actualDurationMinutes = null;

      // Determine if closed
      const shouldClose = mode === 'SMOKE' ? rng() > 0.3 : (includeOpen ? rng() > 0.4 : true);

      if (shouldClose) {
        const outcomeRoll = rng();
        let priceMove = 0;

        if (outcomeRoll < 0.55) {
          // Win: price moves in favorable direction
          priceMove = isLong ? (0.02 + rng() * 0.08) : -(0.02 + rng() * 0.08);
        } else {
          // Loss: price moves against position
          priceMove = isLong ? -(0.01 + rng() * 0.03) : (0.01 + rng() * 0.03);
        }

        closePrice = entryPrice * (1 + priceMove);
        
        // CRITICAL FIX: Correct PnL calculation by direction
        // LONG: pnl = position_size * (close/entry - 1)
        // SHORT: pnl = position_size * (1 - close/entry)
        const priceRatio = closePrice / entryPrice;
        pnlUsd = isLong 
          ? positionSize * (priceRatio - 1)
          : positionSize * (1 - priceRatio);

        if (originalStopPrice) {
          const originalStopDistance = Math.abs(entryPrice - originalStopPrice);
          const originalRiskUsd = originalStopDistance / entryPrice * positionSize;
          rMultiple = originalRiskUsd !== 0 ? pnlUsd / originalRiskUsd : null;
        } else {
          // No stop => undefined risk => r_multiple stays null
          rMultiple = null;
        }

        const hoursLater = 1 + Math.floor(rng() * (timeframe === 'scalp' ? 6 : timeframe === 'day' ? 24 : 72));
        dateClose = new Date(dateOpen.getTime() + hoursLater * 60 * 60 * 1000);

        // Calculate actual duration in minutes
        actualDurationMinutes = Math.round((dateClose - dateOpen) / 60000);

        currentBalance += pnlUsd;
      }

      // Add DCA/Partial closes in EDGE mode
      if (mode === 'EDGE' && rng() > 0.7) {
        // Add position
        const addCount = Math.floor(1 + rng() * 2);
        const adds = [];
        for (let j = 0; j < addCount; j++) {
          const addPrice = entryPrice * (1 + (isLong ? -0.01 : 0.01) * (j + 1));
          const addSize = positionSize * (0.3 + rng() * 0.4);
          adds.push({
            price: addPrice,
            size_usd: addSize,
            timestamp: new Date(dateOpen.getTime() + (j + 1) * 60 * 60 * 1000).toISOString()
          });
        }
        addsHistory = JSON.stringify(adds);
      }

      if (mode === 'EDGE' && shouldClose && rng() > 0.6) {
        // Partial closes
        const partialCount = Math.floor(1 + rng() * 2);
        const partials = [];
        for (let j = 0; j < partialCount; j++) {
          const partialPrice = entryPrice * (1 + (isLong ? 0.01 : -0.01) * (j + 1));
          const partialSize = positionSize * (0.2 + rng() * 0.3);
          const partialPnl = (isLong ? (partialPrice - entryPrice) : (entryPrice - partialPrice)) / entryPrice * partialSize;
          partials.push({
            percent: 25 + Math.floor(rng() * 25),
            size_usd: partialSize,
            price: partialPrice,
            pnl_usd: partialPnl,
            timestamp: new Date(dateOpen.getTime() + (j + 1) * 60 * 60 * 1000).toISOString()
          });
        }
        partialCloses = JSON.stringify(partials);
      }

      // Calculate additional fields - null when undefined, not zero
      let rrRatio = null;
      if (stopPrice && takePrice && stopPrice > 0 && takePrice > 0) {
        const risk = Math.abs(entryPrice - stopPrice);
        const reward = Math.abs(takePrice - entryPrice);
        if (risk > 0) {
          rrRatio = reward / risk;
        }
      }

      let pnlPercentOfBalance = null;
      let realizedPnlUsd = null;
      if (closePrice) {
        const balanceAtEntry = currentBalance - pnlUsd;
        pnlPercentOfBalance = balanceAtEntry > 0 ? (pnlUsd / balanceAtEntry) * 100 : null;
        realizedPnlUsd = pnlUsd;
      }

      const trade = {
        id: uuidv4(), // CRITICAL: Generate unique UUID for each trade
        created_by: user.email,
        profile_id: activeProfile.id,
        import_source: 'seed',
        test_run_id: testRunId,
        coin,
        direction: isLong ? 'Long' : 'Short',
        strategy_tag: strategy,
        timeframe,
        date_open: dateOpen.toISOString(),
        date: dateOpen.toISOString(),
        entry_price: entryPrice,
        original_entry_price: entryPrice,
        position_size: positionSize,
        stop_price: stopPrice,
        original_stop_price: originalStopPrice,
        take_price: takePrice,
        close_price: closePrice,
        date_close: dateClose?.toISOString() || null,
        actual_duration_minutes: actualDurationMinutes,
        account_balance_at_entry: currentBalance - (pnlUsd || 0),
        risk_usd: riskUsd,
        risk_percent: riskPercent,
        rr_ratio: rrRatio,
        pnl_usd: pnlUsd,
        pnl_percent_of_balance: pnlPercentOfBalance,
        realized_pnl_usd: realizedPnlUsd,
        r_multiple: rMultiple,
        adds_history: addsHistory,
        partial_closes: partialCloses,
        rule_compliance: rng() > 0.2,
        emotional_state: Math.floor(5 + rng() * 5),
        confidence_level: Math.floor(5 + rng() * 5)
      };

      trades.push(trade);
    }

    const startTime = Date.now();
    
    // Guard: verify we generated exact count
    if (trades.length !== count) {
      console.error(`[generateTestTrades] Generated ${trades.length} but expected ${count}`);
      return Response.json({ 
        error: `Generated ${trades.length} trades but expected ${count}`,
        debug: { generated: trades.length, expected: count }
      }, { status: 500 });
    }

    console.log(`[generateTestTrades] Inserting ${trades.length} trades in batches...`);

    // Batch insert with duplication guard
    const batchSize = 500;
    let insertedCount = 0;
    const insertedIds = new Set();
    
    for (let i = 0; i < trades.length; i += batchSize) {
      const batch = trades.slice(i, i + batchSize);
      
      // CRITICAL: Verify no duplicate IDs in batch
      const batchIds = batch.map(t => t.id).filter(Boolean);
      const uniqueBatchIds = new Set(batchIds);
      if (batchIds.length !== uniqueBatchIds.size) {
        throw new Error(`Duplicate IDs in batch ${Math.floor(i/batchSize) + 1}`);
      }
      
      // Check against already inserted
      const duplicates = batchIds.filter(id => insertedIds.has(id));
      if (duplicates.length > 0) {
        throw new Error(`Attempting to re-insert IDs: ${duplicates.slice(0, 5).join(', ')}...`);
      }
      
      const result = await base44.asServiceRole.entities.Trade.bulkCreate(batch);
      insertedCount += batch.length;
      
      // Track inserted IDs
      batch.forEach(t => {
        if (t.id) insertedIds.add(t.id);
      });
      
      console.log(`[generateTestTrades] Inserted batch ${Math.floor(i/batchSize) + 1}: ${insertedCount}/${trades.length} (unique IDs: ${insertedIds.size})`);
    }

    const duration = Date.now() - startTime;

    // Quick verification using test_run_id filter
    const quickCheck = await base44.asServiceRole.entities.Trade.filter({
      created_by: user.email,
      profile_id: activeProfile.id,
      test_run_id: testRunId
    }, '-created_date', 10);

    console.log(`[generateTestTrades] Quick check: ${quickCheck.length > 0 ? 'data exists' : 'NO DATA'}`);

    // Use backend function for accurate count
    let verifyCount = count; // Assume success unless backend disagrees
    let openCount = 0;
    let closedCount = 0;
    
    try {
      const countResponse = await base44.functions.invoke('getTradeCounts', {
        profile_id: activeProfile.id
      });
      
      if (countResponse.data?.success) {
        const totalInProfile = countResponse.data.total;
        console.log(`[generateTestTrades] Total trades in profile: ${totalInProfile}`);
        
        // Count only this test run
        let runTotal = 0;
        let runOpen = 0;
        let runClosed = 0;
        let skip = 0;
        const batchLimit = 2000;
        
        while (true) {
          const batch = await base44.asServiceRole.entities.Trade.filter({
            test_run_id: testRunId
          }, '-created_date', batchLimit, skip);
          
          if (batch.length === 0) break;
          
          runTotal += batch.length;
          batch.forEach(t => {
            // CRITICAL: Check for actual close, not just null
            // close_price can be 0 (valid number) for closed trades
            if (t.close_price !== null && t.close_price !== undefined) {
              runClosed++;
            } else {
              runOpen++;
            }
          });
          
          skip += batch.length;
          if (batch.length < batchLimit) break;
        }
        
        verifyCount = runTotal;
        openCount = runOpen;
        closedCount = runClosed;
        
        console.log(`[generateTestTrades] Verification: ${runTotal} trades for test_run_id=${testRunId} (${runOpen} open, ${runClosed} closed)`);
        
        if (runTotal !== count) {
          console.error(`[generateTestTrades] ❌ CRITICAL MISMATCH: Expected ${count}, got ${runTotal} in DB`);
        }
      }
    } catch (countError) {
      console.error(`[generateTestTrades] Count verification failed:`, countError.message);
    }

    // Persist test run metadata
    await base44.entities.TestRun.create({
      created_by: user.email,
      profile_id: activeProfile.id,
      test_run_id: testRunId,
      mode,
      count: verifyCount,
      seed: seed || Date.now(),
      timestamp: new Date().toISOString()
    });

    const consistencyCheck = (openCount + closedCount) === verifyCount;
    const countMatch = verifyCount === count;

    return Response.json({
      success: countMatch && consistencyCheck,
      test_run_id: testRunId,
      profile_id: activeProfile.id,
      requested_count: count,
      inserted_count: insertedCount,
      verified_db_total: verifyCount,
      open_count: openCount,
      closed_count: closedCount,
      deduplicated_count: 0,
      consistency_check: consistencyCheck ? 'PASS' : 'FAIL',
      count_match: countMatch ? 'PASS' : 'FAIL',
      run_id: testRunId,
      mode,
      seed: seed || Date.now(),
      duration_ms: duration,
      started_at: new Date(startTime).toISOString(),
      finished_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('[generateTestTrades] Error:', error);
    return Response.json({ 
      error: error.message,
      error_code: 'GENERATION_FAILED',
      next_step: 'Check profile status and retry',
      stack: error.stack
    }, { status: 500 });
  }
});

function seededRandom(seed) {
  let state = seed;
  return function() {
    state = (state * 9301 + 49297) % 233280;
    return state / 233280;
  };
}