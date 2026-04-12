export const runtime = 'nodejs';

function safeParseNewsJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf('[');
  const end = clean.lastIndexOf(']');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.substring(start, end + 1)); } catch {}
  }
  return [];
}

export async function POST(req) {
  try {
    const body = await req.json();
    const filter = body.filter || 'all';
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const system = `You are a financial news aggregator. Search multiple sources and return the latest 15 financial market headlines from today ${today}.
Return ONLY a valid JSON array, no markdown, no explanation:
[{"title":"...","source":"Reuters","url":"https://...","sentiment":"positive","tickers":["NVDA"],"summary":"one sentence max"}]
sentiment: exactly positive, negative, or neutral.
tickers: only from: NVDA META MSFT AVGO NBIS AMD PLTR MU MRVL TSLA AAPL GOOGL AMZN CRWV`;

    let messages = [{
      role: 'user',
      content: `Search for and return 15 latest financial market news headlines for today ${today}. Check Reuters, CNBC, Bloomberg, Yahoo Finance, MarketWatch.`
    }];

    let finalText = '';
    for (let i = 0; i < 8; i++) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'anthropic-beta': 'web-search-2025-03-05',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages,
        }),
      });

      const data = await res.json();

      if (data.stop_reason === 'end_turn') {
        finalText = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
        break;
      }

      if (data.stop_reason === 'tool_use') {
        messages.push({ role: 'assistant', content: data.content });
        const results = (data.content || [])
          .filter(b => b.type === 'tool_use')
          .map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: JSON.stringify(b.input)
          }));
        if (results.length) messages.push({ role: 'user', content: results });
        else break;
      } else break;
    }

    let news = safeParseNewsJSON(finalText);
    if (filter !== 'all') {
      news = news.filter(n => n.sentiment === filter);
    }

    return Response.json({ news });
  } catch (err) {
    console.error('News error:', err);
    return Response.json({ error: err.message, news: [] }, { status: 500 });
  }
}
