import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get all open trades (no close_price)
    const openTrades = await base44.entities.Trade.filter({ close_price: null }, '-date_open', 5000);

    let updatedCount = 0;
    
    for (const trade of openTrades) {
      if (trade.realized_pnl_usd && trade.realized_pnl_usd !== 0) {
        await base44.entities.Trade.update(trade.id, {
          realized_pnl_usd: 0
        });
        updatedCount++;
      }
    }

    return Response.json({ 
      success: true, 
      message: `Cleared PNL from ${updatedCount} open trades`,
      updatedCount
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});