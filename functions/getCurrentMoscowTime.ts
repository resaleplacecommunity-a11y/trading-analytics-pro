import { createClientFromRequest } from 'npm:@base44/sdk@0.8.4';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const user = await base44.auth.me();

        if (!user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get current time in Moscow timezone (UTC+3)
        const now = new Date();
        const moscowTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));
        
        // Return as ISO string in UTC but representing Moscow time
        const utcEquivalent = new Date(now.getTime());
        
        return Response.json({ 
            moscowTimeISO: utcEquivalent.toISOString(),
            moscowTimeFormatted: moscowTime.toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' }),
            timestamp: now.getTime()
        });
    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});