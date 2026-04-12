// Engine OS Config — update this file to change tickers and catalysts

export const MY_TICKERS = [
  'NVDA', 'META', 'MSFT', 'AVGO', 'NBIS',
  'AMD', 'PLTR', 'MU', 'MRVL', 'TSLA',
  'AAPL', 'GOOGL', 'AMZN', 'CRWV'
];

export const QUICK_SCORE_TICKERS = [
  'NVDA', 'META', 'MSFT', 'AVGO', 'NBIS',
  'AMD', 'PLTR', 'MU', 'MRVL', 'CRWV'
];

export const CATALYSTS = [
  { date: '2026-04-28', ticker: 'META',  desc: 'Q1 Earnings',   engine: 2 },
  { date: '2026-04-28', ticker: 'MSFT',  desc: 'Q3 FY2026',     engine: 2 },
  { date: '2026-04-29', ticker: 'AMD',   desc: 'Q1 Earnings',   engine: 2 },
  { date: '2026-05-05', ticker: 'PLTR',  desc: 'Q1 Earnings',   engine: 2 },
  { date: '2026-05-20', ticker: 'NVDA',  desc: 'Q1 FY2027',     engine: 1 },
  { date: '2026-06-24', ticker: 'MU',    desc: 'Q3 Earnings',   engine: 2 },
];

export const ENGINE_CONFIG = {
  1: { name: 'Anchor', alloc: 40000, targetPct: 50, stopPct: 15, conf: 85, risk: 'Low'  },
  2: { name: 'Swing',  alloc: 28000, targetPct: 25, stopPct: 10, conf: 72, risk: 'Med'  },
  3: { name: 'Flip',   alloc: 12000, targetPct: 10, stopPct: 5,  conf: 60, risk: 'High' },
};
