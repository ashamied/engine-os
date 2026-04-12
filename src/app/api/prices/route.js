export const runtime = 'nodejs';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const tickers = searchParams.get('tickers') || 'NVDA,META,MSFT,AVGO,NBIS,AMD,PLTR,MU,MRVL';

    // API key passed in header, not query param
    const url = `https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=${tickers}`;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${process.env.MASSIVE_API_KEY}` }
    });

    // Fallback: try query param if header auth fails
    let data = await res.json();
    if (!data.tickers) {
      const res2 = await fetch(`${url}&apiKey=${process.env.MASSIVE_API_KEY}`);
      data = await res2.json();
    }

    const prices = {};
    (data.tickers || []).forEach(t => {
      prices[t.ticker] = {
        price: t.day?.c || t.lastTrade?.p || t.prevDay?.c || 0,
        change: t.todaysChangePerc || 0,
        volume: t.day?.v || 0,
        avgVol: t.prevDay?.v || 1,
      };
    });

    return Response.json({ prices });
  } catch (err) {
    console.error('Prices error:', err);
    return Response.json({ error: err.message, prices: {} }, { status: 500 });
  }
}
