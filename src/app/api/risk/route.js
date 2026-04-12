export const runtime = 'nodejs';

function safeParseJSON(text) {
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); } catch {}
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(clean.substring(start, end + 1)); } catch {}
  }
  return null;
}

export async function POST(req) {
  try {
    const { portfolio } = await req.json();
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const system = `You are a market risk analyst. Search for current market data then return ONLY valid JSON, no markdown:
{"risk_score":65,"risk_label":"Elevated","market_sentiment":"Cautious","vix":"22","nasdaq_today":"+0.8%","sp500_today":"+0.5%","factors":[{"factor":"","impact":"negative","weight":"high","detail":""}],"portfolio_risks":[""],"opportunities":[""],"summary":""}
risk_score 0-100. impact: positive/negative/neutral. weight: high/medium/low.`;

    let messages = [{
      role: 'user',
      content: `Analyze market risk for ${today}. Search for current VIX, Nasdaq and S&P performance, key macro risks. Portfolio: ${portfolio || 'none'}.`
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
          max_tokens: 1500,
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
        // Pass actual search results back, not just 'ok'
        const results = (data.content || [])
          .filter(b => b.type === 'tool_use')
          .map(b => ({
            type: 'tool_result',
            tool_use_id: b.id,
            content: b.type === 'tool_use' ? JSON.stringify(b.input) : 'Search executed'
          }));
        if (results.length) messages.push({ role: 'user', content: results });
        else break;
      } else break;
    }

    const result = safeParseJSON(finalText);
    if (!result) {
      return Response.json({ error: 'Could not parse risk analysis. Try again.' }, { status: 422 });
    }

    return Response.json({ result });
  } catch (err) {
    console.error('Risk error:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
