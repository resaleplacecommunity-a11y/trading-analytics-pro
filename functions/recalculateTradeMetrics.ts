import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get active profile
    const profiles = await base44.entities.UserProfile.filter({ created_by: user.email }, '-created_date', 10);
    const activeProfile = profiles.find(p => p.is_active);

    if (!activeProfile) {
      return Response.json({ error: 'No active profile found' }, { status: 400 });
    }

    // Get all trades for active profile
    const allTrades = [];
    let offset = 0;
    const batchSize = 500;
    let hasMore = true;

    while (hasMore) {
      const batch = await base44.entities.Trade.filter({
        created_by: user.email,
        profile_id: activeProfile.id
      }, '-created_date', batchSize);

      allTrades.push(...batch);

      if (batch.length < batchSize) {
        hasMore = false;
      }
    }

    // Recalculate metrics for each trade
    const updates = [];
    let recalculated = 0;

    for (const trade of allTrades) {
      if (!trade.close_price) continue; // Skip open trades

      const isLong = trade.direction === 'Long';
      const entry = trade.entry_price;
      const close = trade.close_price;
      const positionSize = trade.position_size;

      // Recalculate PnL with correct formula
      const priceRatio = close / entry;
      const pnlUsd = isLong
        ? positionSize * (priceRatio - 1)
        : positionSize * (1 - priceRatio);

      // Recalculate R-multiple
      let rMultiple = trade.r_multiple;
      if (trade.original_risk_usd && trade.original_risk_usd > 0) {
        rMultiple = pnlUsd / trade.original_risk_usd;
      } else if (trade.risk_usd && trade.risk_usd > 0) {
        rMultiple = pnlUsd / trade.risk_usd;
      }

      // Recalculate RR ratio
      let rrRatio = null;
      if (trade.stop_price && trade.take_price) {
        const risk = Math.abs(entry - trade.stop_price);
        const reward = Math.abs(trade.take_price - entry);
        if (risk > 0) {
          rrRatio = reward / risk;
        }
      }

      // Recalculate PnL %
      let pnlPercentOfBalance = null;
      if (trade.account_balance_at_entry) {
        pnlPercentOfBalance = (pnlUsd / trade.account_balance_at_entry) * 100;
      }

      // Recalculate realized PnL
      const realizedPnlUsd = pnlUsd;

      // Update if values changed
      const needsUpdate = 
        Math.abs((trade.pnl_usd || 0) - pnlUsd) > 0.01 ||
        (rrRatio !== null && Math.abs((trade.rr_ratio || 0) - rrRatio) > 0.01) ||
        (pnlPercentOfBalance !== null && Math.abs((trade.pnl_percent_of_balance || 0) - pnlPercentOfBalance) > 0.01);

      if (needsUpdate) {
        updates.push({
          id: trade.id,
          pnl_usd: pnlUsd,
          r_multiple: rMultiple,
          rr_ratio: rrRatio,
          pnl_percent_of_balance: pnlPercentOfBalance,
          realized_pnl_usd: realizedPnlUsd
        });
        recalculated++;
      }
    }

    // Apply updates in batches
    for (const update of updates) {
      await base44.asServiceRole.entities.Trade.update(update.id, {
        pnl_usd: update.pnl_usd,
        r_multiple: update.r_multiple,
        rr_ratio: update.rr_ratio,
        pnl_percent_of_balance: update.pnl_percent_of_balance,
        realized_pnl_usd: update.realized_pnl_usd
      });
    }

    return Response.json({
      success: true,
      total_trades: allTrades.length,
      recalculated_trades: recalculated,
      profile_id: activeProfile.id,
      profile_name: activeProfile.profile_name
    });
  } catch (error) {
    console.error('Recalculate metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});