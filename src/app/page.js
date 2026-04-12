'use client';
import { useState, useEffect, useCallback } from 'react';

const VERSION = 'v1.0';
const STORE = 'engine_os_v1';
const CATALYSTS = [
  { date: '2026-04-28', ticker: 'META',  desc: 'Q1 Earnings',    engine: 2 },
  { date: '2026-04-28', ticker: 'MSFT',  desc: 'Q3 FY2026',      engine: 2 },
  { date: '2026-04-29', ticker: 'AMD',   desc: 'Q1 Earnings',    engine: 2 },
  { date: '2026-05-05', ticker: 'PLTR',  desc: 'Q1 Earnings',    engine: 2 },
  { date: '2026-05-20', ticker: 'NVDA',  desc: 'Q1 FY2027',      engine: 1 },
  { date: '2026-06-24', ticker: 'MU',    desc: 'Q3 Earnings',    engine: 2 },
];
const MY_TICKERS = ['NVDA','META','MSFT','AVGO','NBIS','AMD','PLTR','MU','MRVL','TSLA','AAPL','GOOGL','AMZN'];
const E = {
  1: { name:'Anchor', color:'#0A7A52', bg:'#ECF8F4', border:'#A8DFC9', light:'#F3FBF8', conf:85, risk:'Low Risk', target:'+50%', stop:'−15%' },
  2: { name:'Swing',  color:'#1455C0', bg:'#EBF1FD', border:'#9DBDEE', light:'#F3F7FD', conf:72, risk:'Med Risk', target:'+8–25%', stop:'−1%' },
  3: { name:'Flip',   color:'#B05A00', bg:'#FDF3E8', border:'#EEC49A', light:'#FEF9F3', conf:60, risk:'High Risk',target:'+3–10%', stop:'Out 2:30PM' },
};

const fmt = n => '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtPct = n => (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const daysAway = d => Math.round((new Date(d) - new Date()) / 86400000);

function loadPositions() {
  try { return JSON.parse(localStorage.getItem(STORE) || '[]'); } catch { return []; }
}
function savePositions(p) {
  try { localStorage.setItem(STORE, JSON.stringify(p)); } catch {}
}

export default function TradingOS() {
  const [tab, setTab] = useState('dashboard');
  const [positions, setPositions] = useState([]);
  const [prices, setPrices] = useState({});
  const [liveStatus, setLiveStatus] = useState('connecting');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ ticker:'', shares:'', cost:'', notes:'' });
  const [fetchedPrice, setFetchedPrice] = useState(null);
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [caps, setCaps] = useState({ 1: 40000, 2: 28000, 3: 12000 });
  // Scorer
  const [scorerTicker, setScorerTicker] = useState('');
  const [scoring, setScoring] = useState(false);
  const [scoreResult, setScoreResult] = useState(null);
  // Intel
  const [news, setNews] = useState([]);
  const [newsFilter, setNewsFilter] = useState('all');
  const [loadingNews, setLoadingNews] = useState(false);
  const [riskData, setRiskData] = useState(null);
  const [loadingRisk, setLoadingRisk] = useState(false);
  const [intelUpdated, setIntelUpdated] = useState('');

  useEffect(() => { setPositions(loadPositions()); }, []);

  // ── Prices ──────────────────────────────────────
  const syncPrices = useCallback(async () => {
    const tickers = [...new Set([...positions.map(p => p.ticker), ...MY_TICKERS])].join(',');
    setLiveStatus('syncing');
    try {
      const res = await fetch(`/api/prices?tickers=${tickers}`);
      const data = await res.json();
      if (data.prices) { setPrices(data.prices); setLiveStatus('live'); }
      else setLiveStatus('offline');
    } catch { setLiveStatus('offline'); }
  }, [positions]);

  const lp = ticker => prices[ticker]?.price || null;

  // ── Fetch modal price ────────────────────────────
  const fetchModalPrice = async () => {
    if (!form.ticker) return;
    setFetchingPrice(true); setFetchedPrice(null);
    try {
      const res = await fetch(`/api/prices?tickers=${form.ticker.toUpperCase()}`);
      const data = await res.json();
      const p = data.prices?.[form.ticker.toUpperCase()];
      if (p?.price) setFetchedPrice(p);
      else setFetchedPrice({ error: 'Not found' });
    } catch { setFetchedPrice({ error: 'Error' }); }
    setFetchingPrice(false);
  };

  // ── Positions ────────────────────────────────────
  const savePos = () => {
    const ticker = form.ticker.trim().toUpperCase();
    const shares = parseFloat(form.shares);
    const cost = parseFloat(form.cost);
    if (!ticker || !shares || !cost) { alert('Fill in ticker, shares and avg cost'); return; }
    const price = fetchedPrice?.price || cost;
    const next = [...positions, { ticker, shares, cost, price, notes: form.notes, engine: modal, added: Date.now() }];
    setPositions(next); savePositions(next);
    setModal(null); setForm({ ticker:'', shares:'', cost:'', notes:'' }); setFetchedPrice(null);
  };

  const removePos = i => {
    if (!confirm('Remove this position?')) return;
    const next = positions.filter((_, idx) => idx !== i);
    setPositions(next); savePositions(next);
  };

  // ── Engine calcs ─────────────────────────────────
  const engCalc = eng => {
    const pos = positions.filter(p => p.engine === eng);
    const cur = pos.reduce((a, p) => a + (lp(p.ticker) || p.price) * p.shares, 0);
    const inv = pos.reduce((a, p) => a + p.cost * p.shares, 0);
    const pnl = cur - inv;
    const pct = inv > 0 ? pnl / inv * 100 : 0;
    return { cur, inv, pnl, pct, count: pos.length };
  };

  // ── Scorer ───────────────────────────────────────
  const runScore = async (ticker) => {
    const t = (ticker || scorerTicker).toUpperCase();
    if (!t) return;
    setScorerTicker(t); setScoring(true); setScoreResult(null);
    try {
      const liveData = prices[t] || null;
      const res = await fetch('/api/score', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ticker: t, liveData }) });
      const data = await res.json();
      setScoreResult(data.result);
    } catch { setScoreResult({ error: true }); }
    setScoring(false);
  };

  // ── News ─────────────────────────────────────────
  const fetchNews = async (filter = newsFilter) => {
    setLoadingNews(true); setNews([]);
    try {
      const res = await fetch('/api/news', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ filter }) });
      const data = await res.json();
      setNews(data.news || []);
      setIntelUpdated('Updated ' + new Date().toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' }));
    } catch {}
    setLoadingNews(false);
  };

  // ── Risk ─────────────────────────────────────────
  const fetchRisk = async () => {
    setLoadingRisk(true); setRiskData(null);
    const portfolio = positions.length
      ? positions.map(p => `${p.ticker}(E${p.engine},${fmtPct(((lp(p.ticker)||p.price)-p.cost)/p.cost*100)})`).join(', ')
      : 'No positions';
    try {
      const res = await fetch('/api/risk', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ portfolio }) });
      const data = await res.json();
      setRiskData(data.result);
    } catch {}
    setLoadingRisk(false);
  };

  // ── Summary totals ───────────────────────────────
  const totalCur = positions.reduce((a, p) => a + (lp(p.ticker) || p.price) * p.shares, 0);
  const totalInv = positions.reduce((a, p) => a + p.cost * p.shares, 0);
  const totalPnl = totalCur - totalInv;
  const totalPct = totalInv > 0 ? totalPnl / totalInv * 100 : 0;
  const totalCap = caps[1] + caps[2] + caps[3];
  const wins = positions.filter(p => (lp(p.ticker) || p.price) > p.cost).length;
  const wr = positions.length ? Math.round(wins / positions.length * 100) : 0;

  // ── Portfolio risks ──────────────────────────────
  const portRisks = () => {
    const risks = [];
    const tot = totalCur || 1;
    positions.forEach(p => {
      const pv = (lp(p.ticker) || p.price) * p.shares;
      if (pv / tot > 0.3) risks.push(`⚠ ${p.ticker} is ${(pv/tot*100).toFixed(0)}% of portfolio — concentrated`);
      const pct = ((lp(p.ticker)||p.price) - p.cost) / p.cost * 100;
      const stop = p.engine === 1 ? -15 : p.engine === 2 ? -10 : -5;
      if (pct < stop + 3 && pct > stop - 10) risks.push(`🔴 ${p.ticker} near stop loss (${pct.toFixed(1)}%)`);
    });
    const e2v = positions.filter(p => p.engine === 2).reduce((a, p) => a + (lp(p.ticker)||p.price)*p.shares, 0);
    if (tot > 0 && e2v / tot > 0.4) risks.push(`⚠ Engine 2 at ${(e2v/tot*100).toFixed(0)}% — above 40% threshold`);
    if (!risks.length) risks.push('✓ No major flags — portfolio looks balanced');
    return risks;
  };

  // ── Styles ───────────────────────────────────────
  const s = {
    body: { fontFamily:"'IBM Plex Sans',sans-serif", background:'#F7F8FA', color:'#17202E', fontSize:13, minHeight:'100vh' },
    topbar: { background:'#fff', borderBottom:'1px solid #E3E7EF', padding:'0 28px', height:52, display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:100 },
    brand: { fontSize:13, fontWeight:600 },
    vBadge: { fontSize:10, fontWeight:600, background:'#EBF1FD', color:'#1455C0', border:'1px solid #9DBDEE', borderRadius:4, padding:'2px 7px', marginLeft:8, fontFamily:"'IBM Plex Mono',monospace" },
    navTabs: { display:'flex', gap:2 },
    navTab: (active) => ({ padding:'6px 16px', borderRadius:6, fontSize:13, cursor:'pointer', color: active?'#17202E':'#6B7898', background: active?'#F7F8FA':'transparent', border:'none', fontFamily:"'IBM Plex Sans',sans-serif", fontWeight: active?500:400 }),
    liveInd: { display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#6B7898' },
    liveDot: (status) => ({ width:6, height:6, borderRadius:'50%', background: status==='live'?'#22C55E':status==='syncing'?'#EF9F27':'#E24B4A' }),
    syncBtn: { background:'#F7F8FA', border:'1px solid #E3E7EF', borderRadius:6, padding:'5px 12px', fontSize:12, cursor:'pointer', color:'#6B7898', fontFamily:"'IBM Plex Sans',sans-serif" },
    page: { padding:'24px 28px' },
    // Summary
    sumStrip: { display:'flex', background:'#fff', border:'1px solid #E3E7EF', borderRadius:10, marginBottom:20, overflow:'hidden' },
    sumCell: { flex:1, padding:'14px 18px', borderRight:'1px solid #E3E7EF' },
    sumLabel: { fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:'#A0ABBC', fontWeight:500, marginBottom:5 },
    sumVal: (pos) => ({ fontSize:18, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace", color: pos===null?'#17202E':pos?'#0A7A52':'#C0302A' }),
    // Engine panel
    panel: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:10, overflow:'hidden' },
    engGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:20 },
    engTop: (eng) => ({ borderTop:`3px solid ${E[eng].color}`, padding:'16px 16px 12px' }),
    badge: (eng) => ({ display:'inline-block', fontSize:10, fontWeight:600, letterSpacing:'.08em', textTransform:'uppercase', padding:'2px 8px', borderRadius:4, marginBottom:8, background:E[eng].bg, color:E[eng].color, border:`1px solid ${E[eng].border}` }),
    capBlock: { background:'#F7F8FA', borderTop:'1px solid #E3E7EF', borderBottom:'1px solid #E3E7EF', padding:'12px 16px' },
    capRow: { display:'flex', gap:8, marginBottom:8 },
    capGrp: { flex:1 },
    capLbl: { fontSize:10, textTransform:'uppercase', letterSpacing:'.07em', color:'#A0ABBC', fontWeight:500, marginBottom:4 },
    capInp: { width:'100%', background:'#fff', border:'1px solid #E3E7EF', borderRadius:6, padding:'7px 10px', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, color:'#17202E', outline:'none' },
    capOut: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:6, padding:'7px 10px', fontSize:13, fontFamily:"'IBM Plex Mono',monospace", fontWeight:600, minHeight:34 },
    pnlBox: (pnl) => ({ textAlign:'center', padding:'5px 8px', borderRadius:5, fontSize:11, fontWeight:500, fontFamily:"'IBM Plex Mono',monospace", background: pnl>0?'#ECF8F4':pnl<0?'#FDEEEE':'#F7F8FA', color: pnl>0?'#0A7A52':pnl<0?'#C0302A':'#6B7898' }),
    confRow: { display:'flex', alignItems:'center', gap:8, marginTop:8 },
    pill: (type) => ({ fontSize:10, padding:'2px 7px', borderRadius:4, fontWeight:500, background: type==='low'?'#ECF8F4':type==='med'?'#FDF3E8':'#FDEEEE', color: type==='low'?'#0A7A52':type==='med'?'#B05A00':'#C0302A' }),
    posBlock: { padding:'12px 16px', borderBottom:'1px solid #E3E7EF' },
    posHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 },
    posTitle: { fontSize:10, textTransform:'uppercase', letterSpacing:'.08em', color:'#A0ABBC', fontWeight:500 },
    addBtn: { background:'none', border:'1px solid #E3E7EF', borderRadius:5, padding:'2px 8px', fontSize:11, cursor:'pointer', color:'#6B7898', fontFamily:"'IBM Plex Sans',sans-serif" },
    posItem: { display:'flex', alignItems:'center', gap:6, padding:'6px 0', borderBottom:'.5px solid #E3E7EF', fontSize:12 },
    rulesBlock: { padding:'12px 16px' },
    rulesCols: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 },
    doCol: { borderRadius:6, padding:'10px', background:'#F3FBF8', border:'1px solid #A8DFC9' },
    dontCol: { borderRadius:6, padding:'10px', background:'#FEF4F4', border:'1px solid #F3C0C0' },
    // Cal
    calItem: (soon) => ({ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', borderRadius:6, marginBottom:5, border:`1px solid ${soon?'#9DBDEE':'#E3E7EF'}`, background: soon?'#F3F7FD':'#fff', fontSize:12 }),
    calAct: (type) => ({ fontSize:10, padding:'2px 7px', borderRadius:4, fontWeight:600, background: type==='enter'?'#EBF1FD':type==='hold'?'#ECF8F4':'#FDEEEE', color: type==='enter'?'#1455C0':type==='hold'?'#0A7A52':'#C0302A' }),
    // Guide
    guideRow: { display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 },
    // Scorecard
    scoreGrid: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:20 },
    scoreCard: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:10, padding:14 },
    engScoreGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 },
    engScoreCard: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:10, padding:16, textAlign:'center' },
    gradeColor: g => g==='A'?'#0A7A52':g==='B'?'#5A9E60':g==='C'?'#B05A00':'#C0302A',
    // Scorer
    scorerLayout: { display:'grid', gridTemplateColumns:'280px 1fr', gap:16 },
    scorerRight: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:10, padding:20, minHeight:400 },
    // Intel
    intelGrid: { display:'grid', gridTemplateColumns:'300px 1fr', gap:16 },
    newsCard: { background:'#fff', border:'1px solid #E3E7EF', borderRadius:8, padding:'12px 14px', marginBottom:8, cursor:'pointer' },
    sentBadge: (s) => ({ fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:4, background: s==='positive'?'#ECF8F4':s==='negative'?'#FDEEEE':'#F7F8FA', color: s==='positive'?'#0A7A52':s==='negative'?'#C0302A':'#6B7898' }),
    riskCircle: (score) => ({ width:80, height:80, borderRadius:'50%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0, border:`3px solid ${score>=70?'#C0302A':score>=40?'#B05A00':'#0A7A52'}`, background: score>=70?'#FDEEEE':score>=40?'#FDF3E8':'#ECF8F4' }),
    // Modal
    modalBg: { position:'fixed', inset:0, background:'rgba(0,0,0,.3)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center' },
    modal: { background:'#fff', border:'1px solid #C8CFDD', borderRadius:12, padding:24, width:400, maxWidth:'95vw' },
    formGrp: { display:'flex', flexDirection:'column', gap:5, flex:1 },
    formLbl: { fontSize:10, textTransform:'uppercase', letterSpacing:'.07em', color:'#A0ABBC', fontWeight:500 },
    formInp: { background:'#F7F8FA', border:'1px solid #E3E7EF', borderRadius:6, padding:'8px 10px', fontSize:13, color:'#17202E', fontFamily:"'IBM Plex Sans',sans-serif", outline:'none' },
    btnPrimary: { padding:'8px 18px', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', border:'none', fontFamily:"'IBM Plex Sans',sans-serif", background:'#1455C0', color:'#fff' },
    btnGhost: { padding:'8px 18px', borderRadius:7, fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif", background:'#F7F8FA', border:'1px solid #E3E7EF', color:'#6B7898' },
    fetchBtn: { background:'#EBF1FD', border:'1px solid #9DBDEE', borderRadius:6, padding:'7px 12px', fontSize:12, fontWeight:500, color:'#1455C0', cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif", whiteSpace:'nowrap' },
    intelBtn: { background:'#1455C0', color:'#fff', border:'none', borderRadius:6, padding:'6px 14px', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif" },
    filterBtn: (active) => ({ background: active?'#EBF1FD':'#F7F8FA', border:`1px solid ${active?'#9DBDEE':'#E3E7EF'}`, borderRadius:5, padding:'3px 10px', fontSize:11, cursor:'pointer', color: active?'#1455C0':'#6B7898', fontFamily:"'IBM Plex Sans',sans-serif" }),
    qBtn: { background:'#F7F8FA', border:'1px solid #E3E7EF', borderRadius:5, padding:'4px 10px', fontSize:12, fontFamily:"'IBM Plex Mono',monospace", fontWeight:500, cursor:'pointer', color:'#17202E' },
    scoreGoBtn: { background:'#1455C0', color:'#fff', border:'none', borderRadius:6, padding:'8px 16px', fontSize:13, fontWeight:500, cursor:'pointer', fontFamily:"'IBM Plex Sans',sans-serif" },
  };

  const QUICK_TICKERS = ['NVDA','META','MSFT','AVGO','NBIS','AMD','PLTR','MU','MRVL','CRWV'];

  const engCalcs = { 1: engCalc(1), 2: engCalc(2), 3: engCalc(3) };

  const e3Max = Math.round(totalCap * 0.01);

  // ── Scorecard grades ─────────────────────────────
  const engGrades = [1,2,3].map(n => {
    const { pct } = engCalcs[n];
    const target = n===1?50:n===2?25:10;
    const ratio = pct / target;
    const grade = ratio>=0.8?'A':ratio>=0.5?'B':ratio>=0.2?'C':'D';
    return { n, grade, pct };
  });

  return (
    <div style={s.body}>
      {/* Topbar */}
      <div style={s.topbar}>
        <div style={s.brand}>
          Trading OS <span style={{color:'#6B7898',fontWeight:400}}>/ Sap</span>
          <span style={s.vBadge}>{VERSION}</span>
        </div>
        <div style={s.navTabs}>
          {['dashboard','scorecard','scorer','intel','protocol'].map(t => (
            <button key={t} style={s.navTab(tab===t)} onClick={() => setTab(t)}>
              {t==='dashboard'?'Dashboard':t==='scorecard'?'Scorecard':t==='scorer'?'Stock Scorer':t==='intel'?'Market Intel':'Protocol'}
            </button>
          ))}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={s.liveInd}>
            <div style={s.liveDot(liveStatus)}></div>
            <span>{liveStatus==='live'?'Live — Massive':liveStatus==='syncing'?'Syncing...':'Offline'}</span>
          </div>
          <button style={s.syncBtn} onClick={syncPrices}>↻ Sync All</button>
        </div>
      </div>

      {/* ══ DASHBOARD ══ */}
      {tab === 'dashboard' && (
        <div style={s.page}>
          {/* Summary */}
          <div style={s.sumStrip}>
            {[
              { label:'Total Capital', val: fmt(totalCap), color: null },
              { label:'Current Value', val: positions.length ? fmt(totalCur) : '—', color: null },
              { label:'Total P&L', val: positions.length ? (totalPnl>=0?'+':'')+fmt(totalPnl)+' ('+fmtPct(totalPct)+')' : '—', color: positions.length ? totalPnl>=0 : null },
              { label:'Win Rate', val: positions.length ? wr+'%' : '—', color: positions.length ? wr>=50 : null },
            ].map((c,i) => (
              <div key={i} style={{...s.sumCell, borderRight: i<3?'1px solid #E3E7EF':'none'}}>
                <div style={s.sumLabel}>{c.label}</div>
                <div style={s.sumVal(c.color)}>{c.val}</div>
              </div>
            ))}
            <div style={{flex:1.4, padding:'14px 18px'}}>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#6B7898',marginBottom:5}}>
                <span>2X Progress</span><span>{fmtPct(totalPct)}</span>
              </div>
              <div style={{height:5,background:'#E3E7EF',borderRadius:3,overflow:'hidden',marginBottom:4}}>
                <div style={{height:'100%',width:`${Math.min(100,Math.max(0,totalPct))}%`,background:'linear-gradient(90deg,#0A7A52,#1455C0)',borderRadius:3,transition:'width .8s'}}></div>
              </div>
              <div style={{fontSize:10,color:'#A0ABBC'}}>Need ~8%/mo to reach $160K</div>
            </div>
          </div>

          {/* Engine grid */}
          <div style={s.engGrid}>
            {[1,2,3].map(eng => {
              const calc = engCalcs[eng];
              const e = E[eng];
              const pos = positions.filter(p => p.engine === eng);
              return (
                <div key={eng} style={s.panel}>
                  <div style={s.engTop(eng)}>
                    <div style={s.badge(eng)}>Engine {eng}</div>
                    <div style={{fontSize:15,fontWeight:600,marginBottom:2}}>{e.name}</div>
                    <div style={{fontSize:11,color:'#6B7898'}}>{eng===1?'Buy & hold · 12 months':eng===2?'Pre-earnings · 3–6 week holds':'Same-day catalyst · Never overnight'}</div>
                  </div>

                  {/* Capital */}
                  <div style={s.capBlock}>
                    <div style={s.capRow}>
                      <div style={s.capGrp}>
                        <div style={s.capLbl}>Allocated</div>
                        <input style={s.capInp} type="number" value={caps[eng]} onChange={ev => setCaps(c => ({...c,[eng]:parseFloat(ev.target.value)||0}))} />
                      </div>
                      <div style={s.capGrp}>
                        <div style={s.capLbl}>Current Value</div>
                        <div style={s.capOut}>{pos.length ? fmt(calc.cur) : '—'}</div>
                      </div>
                    </div>
                    <div style={s.pnlBox(pos.length ? calc.pnl : 0)}>
                      {pos.length ? `${calc.pnl>=0?'+':''}${fmt(calc.pnl)} (${fmtPct(calc.pct)}) · Target ${e.target}` : 'Add positions to calculate'}
                    </div>
                    <div style={s.confRow}>
                      <span style={{fontSize:11,color:'#6B7898',flexShrink:0}}>Confidence</span>
                      <div style={{flex:1,height:4,background:'#E3E7EF',borderRadius:2,overflow:'hidden'}}>
                        <div style={{height:'100%',width:`${e.conf}%`,background:e.color,borderRadius:2}}></div>
                      </div>
                      <span style={{fontSize:11,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace",color:e.color}}>{e.conf}%</span>
                    </div>
                    <div style={{display:'flex',gap:5,marginTop:6,flexWrap:'wrap'}}>
                      <span style={s.pill(eng===1?'low':eng===2?'med':'hi')}>{e.risk}</span>
                      <span style={s.pill(eng===1?'low':eng===2?'med':'hi')}>{e.target}</span>
                      <span style={s.pill('hi')}>{e.stop}</span>
                    </div>
                  </div>

                  {/* Engine 3 guide */}
                  {eng===3 && (
                    <div style={{padding:'12px 16px',borderBottom:'1px solid #E3E7EF'}}>
                      <div style={{...s.posTitle,marginBottom:8}}>Capital Usage Guide</div>
                      <div style={{background:'#F7F8FA',border:'1px solid #E3E7EF',borderRadius:6,padding:'10px 12px'}}>
                        {[
                          ['Max per trade (1%)', fmt(e3Max)],
                          ['Max simultaneous', '2 trades'],
                          ['Stop loss per trade', fmt(Math.round(e3Max*0.15))],
                          ['Target per session', fmt(Math.round(caps[3]*0.03))+'–'+fmt(Math.round(caps[3]*0.10))],
                          ['Daily circuit breaker', '−'+fmt(e3Max*2)],
                        ].map(([k,v]) => (
                          <div key={k} style={s.guideRow}><span style={{color:'#6B7898'}}>{k}</span><span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:600}}>{v}</span></div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Positions */}
                  <div style={s.posBlock}>
                    <div style={s.posHeader}>
                      <div style={s.posTitle}>{eng===3?'Today\'s Flips':'Positions'}</div>
                      <button style={s.addBtn} onClick={() => { setModal(eng); setFetchedPrice(null); setForm({ticker:'',shares:'',cost:'',notes:''}); }}>+ Add</button>
                    </div>
                    {pos.length === 0 ? (
                      <div style={{fontSize:11,color:'#A0ABBC',textAlign:'center',padding:'10px 0'}}>Add your {e.name.toLowerCase()} positions</div>
                    ) : pos.map((p, i) => {
                      const price = lp(p.ticker) || p.price;
                      const pnl = (price - p.cost) * p.shares;
                      const pct = (price - p.cost) / p.cost * 100;
                      const chg = prices[p.ticker];
                      const idx = positions.indexOf(p);
                      return (
                        <div key={i} style={s.posItem}>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,width:42}}>{p.ticker}</span>
                          <span style={{color:'#6B7898',flex:1,fontSize:11}}>{p.shares}sh · ${p.cost.toFixed(0)}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>${price.toFixed(2)} {chg && <span style={{color:chg.change>=0?'#0A7A52':'#C0302A',fontSize:10}}>{chg.change>=0?'+':''}{chg.change.toFixed(1)}%</span>}</span>
                          <span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:500,fontSize:11,color:pnl>=0?'#0A7A52':'#C0302A'}}>{pnl>=0?'+':''}{fmt(pnl)} ({fmtPct(pct)})</span>
                          <button style={{background:'none',border:'none',cursor:'pointer',color:'#A0ABBC',fontSize:11,padding:'2px 4px'}} onClick={() => removePos(idx)}>✕</button>
                        </div>
                      );
                    })}
                  </div>

                  {/* Engine 2 calendar */}
                  {eng===2 && (
                    <div style={{padding:'12px 16px',borderBottom:'1px solid #E3E7EF'}}>
                      <div style={{...s.posTitle,marginBottom:8}}>Earnings Calendar</div>
                      {CATALYSTS.filter(c=>c.engine===2).sort((a,b)=>new Date(a.date)-new Date(b.date)).map(c => {
                        const days = daysAway(c.date);
                        const soon = days >= 0 && days <= 21;
                        const d = new Date(c.date).toLocaleDateString('en-US',{month:'short',day:'numeric'});
                        const act = days<=0?'exit':days<=14?'enter':'hold';
                        return (
                          <div key={c.ticker+c.date} style={s.calItem(soon)}>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:'#6B7898',width:44}}>{d}</span>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,width:38,color:'#1455C0'}}>{c.ticker}</span>
                            <span style={{color:'#6B7898',flex:1}}>{c.desc}</span>
                            <span style={s.calAct(act)}>{act==='enter'?'Enter now':act==='exit'?'Exit now':'Watch'}</span>
                            <span style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:10,color:'#A0ABBC'}}>{days>=0?days+'d':Math.abs(days)+'d ago'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* DO / DON'T */}
                  <div style={s.rulesBlock}>
                    <div style={s.rulesCols}>
                      <div style={s.doCol}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#0A7A52',marginBottom:6}}>✓ Do</div>
                        {(eng===1?['DCA on 10%+ pullbacks','Trail stop 15% from high','Take 20% profit at +40%','Max 4 names only']:
                          eng===2?['Enter 2–3 weeks pre-earnings','Take 50% at target always','Exit 1 day before print']:
                          ['Enter 9:45–10:30 AM EST','150%+ volume to enter','Out by 2:30 PM EST']).map(r=>(
                          <div key={r} style={{display:'flex',gap:5,marginBottom:4,fontSize:11,color:'#17202E'}}>
                            <span>•</span><span>{r}</span>
                          </div>
                        ))}
                      </div>
                      <div style={s.dontCol}>
                        <div style={{fontSize:10,fontWeight:700,letterSpacing:'.07em',textTransform:'uppercase',color:'#C0302A',marginBottom:6}}>✕ Don't</div>
                        {(eng===1?['Panic sell on red days','Average down losers','Add after 20%+ run-up','Trade on emotion']:
                          eng===2?['Hold through earnings night','Add after 15%+ run-up','Average down a swing']:
                          ['Never hold overnight','No trades on Fridays','No revenge after loss']).map(r=>(
                          <div key={r} style={{display:'flex',gap:5,marginBottom:4,fontSize:11,color:'#17202E'}}>
                            <span>•</span><span>{r}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ══ SCORECARD ══ */}
      {tab === 'scorecard' && (
        <div style={s.page}>
          <div style={s.scoreGrid}>
            {[
              { label:'Total P&L', val: positions.length?(totalPnl>=0?'+':'')+fmt(totalPnl):  '—', sub: fmtPct(totalPct), good: totalPnl>=0 },
              { label:'Win Rate', val: positions.length?wr+'%':'—', sub:`${wins}/${positions.length} green`, good: wr>=60 },
              { label:'2X Pace', val: fmtPct(totalPct), sub:'Need ~8%/mo', good: totalPct>=8 },
              { label:'Positions', val: positions.length, sub: `${[1,2,3].map(n=>positions.filter(p=>p.engine===n).length).join(' / ')} by engine`, good: null },
            ].map((c,i) => (
              <div key={i} style={s.scoreCard}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:6}}>{c.label}</div>
                <div style={{fontSize:20,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace",color:c.good===null?'#17202E':c.good?'#0A7A52':'#C0302A'}}>{c.val}</div>
                <div style={{fontSize:11,color:'#6B7898',marginTop:3}}>{c.sub}</div>
              </div>
            ))}
          </div>
          <div style={s.engScoreGrid}>
            {engGrades.map(g => (
              <div key={g.n} style={s.engScoreCard}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600,marginBottom:8,color:E[g.n].color}}>Engine {g.n} — {E[g.n].name}</div>
                <div style={{fontSize:32,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace",color:s.gradeColor(g.grade)}}>{g.grade}</div>
                <div style={{fontSize:11,color:'#6B7898',marginTop:4}}>{g.pct.toFixed(1)}% · {g.grade==='A'?'On track':g.grade==='B'?'Progressing':g.grade==='C'?'Below pace':'Needs review'}</div>
              </div>
            ))}
          </div>
          <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:16}}>
            <div style={{fontSize:13,fontWeight:600,marginBottom:12}}>Weekly insights</div>
            {portRisks().map((r,i) => (
              <div key={i} style={{display:'flex',gap:10,padding:'8px 0',borderBottom:'.5px solid #E3E7EF',fontSize:12,color:'#6B7898'}}>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ SCORER ══ */}
      {tab === 'scorer' && (
        <div style={s.page}>
          <div style={s.scorerLayout}>
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:16}}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:8}}>Score a stock</div>
                <div style={{display:'flex',gap:8,marginBottom:12}}>
                  <input
                    style={{...s.capInp,flex:1,fontSize:15,fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,letterSpacing:'.04em'}}
                    placeholder="NVDA" value={scorerTicker}
                    onChange={e => setScorerTicker(e.target.value.toUpperCase())}
                    onKeyDown={e => e.key==='Enter' && runScore()}
                  />
                  <button style={s.scoreGoBtn} onClick={() => runScore()} disabled={scoring}>
                    {scoring ? '...' : 'Score ↗'}
                  </button>
                </div>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:6}}>Quick score</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:5}}>
                  {QUICK_TICKERS.map(t => <button key={t} style={s.qBtn} onClick={() => runScore(t)}>{t}</button>)}
                </div>
              </div>
              <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:14}}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:10}}>Migration rules</div>
                {[['E1→E2','Up 25%+ from entry → harvest volatility'],['E2→E1','Catalyst fired, thesis deepened structurally'],['E2→E3','Earnings day → flip the gap'],['→Sell','Thesis broke (not price) or stop hit']].map(([arr,txt])=>(
                  <div key={arr} style={{display:'flex',gap:8,marginBottom:7,fontSize:11}}>
                    <span style={{color:'#A0ABBC',fontFamily:"'IBM Plex Mono',monospace",fontSize:10,fontWeight:500,flexShrink:0,marginTop:1}}>{arr}</span>
                    <span style={{color:'#6B7898'}}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div style={s.scorerRight}>
              {!scoreResult && !scoring && <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:300,color:'#A0ABBC',textAlign:'center',gap:8}}><div style={{fontSize:14,fontWeight:500,color:'#6B7898'}}>Enter a ticker to score</div><div style={{fontSize:12,maxWidth:240,lineHeight:1.6}}>Claude analyzes against all 3 engine criteria and tells you exactly where it belongs</div></div>}
              {scoring && <div style={{textAlign:'center',padding:48,color:'#6B7898',fontSize:13}}><div style={{fontSize:20,letterSpacing:3,marginBottom:8}}>···</div>Analyzing {scorerTicker}...</div>}
              {scoreResult && !scoreResult.error && (() => {
                const s2 = scoreResult;
                const vn = s2.verdict==='ENGINE_1'?1:s2.verdict==='ENGINE_2'?2:3;
                const barCol = n => n===1?'#0A7A52':n===2?'#1455C0':'#B05A00';
                const fitStyle = sc => ({ fontSize:11,fontWeight:500,padding:'2px 7px',borderRadius:4,background:sc>=7?'#ECF8F4':sc>=5?'#FDF3E8':'#FDEEEE',color:sc>=7?'#0A7A52':sc>=5?'#B05A00':'#C0302A' });
                return (
                  <div>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:16,paddingBottom:14,borderBottom:'1px solid #E3E7EF'}}>
                      <div>
                        <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:24,fontWeight:600}}>{s2.ticker}</div>
                        {prices[s2.ticker] && <div style={{fontSize:11,color:'#6B7898',marginTop:3}}>Live: ${prices[s2.ticker].price?.toFixed(2)} · {prices[s2.ticker].change>=0?'+':''}{prices[s2.ticker].change?.toFixed(2)}%</div>}
                        <div style={{fontSize:11,color:'#A0ABBC',marginTop:2}}>Confidence: {s2.confidence}%</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',marginBottom:5}}>Recommended</div>
                        <div style={{fontSize:13,fontWeight:600,padding:'6px 16px',borderRadius:6,background:E[vn].bg,color:E[vn].color,border:`1px solid ${E[vn].border}`}}>{s2.verdict_label}</div>
                      </div>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:16}}>
                      {[{n:1,sc:s2.e1},{n:2,sc:s2.e2},{n:3,sc:s2.e3}].map(({n,sc})=>(
                        <div key={n} style={{background:'#F7F8FA',borderRadius:8,padding:12,border:n===vn?`2px solid ${barCol(n)}`:'none'}}>
                          <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.08em',fontWeight:600,color:barCol(n),marginBottom:6}}>Engine {n}</div>
                          <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:6}}><span style={{fontSize:24,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{sc}</span><span style={{color:'#A0ABBC',fontSize:12}}>/10</span></div>
                          <div style={{height:3,background:'#E3E7EF',borderRadius:2,marginBottom:6,overflow:'hidden'}}><div style={{height:'100%',width:`${sc*10}%`,background:barCol(n),borderRadius:2}}></div></div>
                          <span style={fitStyle(sc)}>{sc>=7?'Fits':sc>=5?'Partial':'Weak'}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{fontSize:13,color:'#6B7898',lineHeight:1.65,marginBottom:14,padding:'12px 14px',background:'#F7F8FA',borderRadius:8}}>{s2.summary}</div>
                    <div style={{display:'flex',gap:14,marginBottom:14,padding:'10px 14px',background:'#F7F8FA',borderRadius:8,flexWrap:'wrap'}}>
                      <div style={{fontSize:12}}><span style={{color:'#6B7898'}}>Stop loss: </span><strong style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>{s2.stop_loss}</strong></div>
                      <div style={{fontSize:12}}><span style={{color:'#6B7898'}}>Entry: </span><strong style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11}}>{s2.entry}</strong></div>
                    </div>
                    <div style={{fontSize:12,color:'#6B7898',lineHeight:1.55,padding:'10px 14px',background:'#EBF1FD',border:'1px solid #9DBDEE',borderRadius:8,marginBottom:14}}><strong>Migration trigger:</strong> {s2.migration}</div>
                    {[{title:'Engine 1 Criteria',items:s2.e1_criteria,col:'#0A7A52'},{title:'Engine 2 Criteria',items:s2.e2_criteria,col:'#1455C0'},{title:'Engine 3 Criteria',items:s2.e3_criteria,col:'#B05A00'}].map(({title,items,col})=>(
                      <div key={title} style={{marginBottom:12}}>
                        <div style={{fontSize:12,fontWeight:500,color:col,marginBottom:8}}>{title}</div>
                        {(items||[]).map((c,i)=>(
                          <div key={i} style={{display:'flex',gap:8,padding:'6px 0',borderBottom:'.5px solid #E3E7EF',alignItems:'flex-start',fontSize:12}}>
                            <div style={{width:17,height:17,borderRadius:4,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,flexShrink:0,background:c.pass?'#ECF8F4':'#FDEEEE',color:c.pass?'#0A7A52':'#C0302A'}}>{c.pass?'✓':'✕'}</div>
                            <div style={{flex:1}}><div style={{fontWeight:500}}>{c.name}</div><div style={{fontSize:11,color:'#6B7898'}}>{c.detail}</div></div>
                            <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:500,color:c.pts>0?'#0A7A52':'#A0ABBC'}}>+{c.pts}/{c.max}</div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ══ MARKET INTEL ══ */}
      {tab === 'intel' && (
        <div style={s.page}>
          <div style={s.intelGrid}>
            {/* Left */}
            <div>
              <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:18,marginBottom:12}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                  <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500}}>Risk Score</div>
                  <button style={s.intelBtn} onClick={fetchRisk} disabled={loadingRisk}>{loadingRisk?'Analyzing...':'Analyze Market ↗'}</button>
                </div>
                {!riskData && !loadingRisk && <div style={{textAlign:'center',padding:'24px 0',color:'#A0ABBC',fontSize:12}}>Click Analyze Market to get live risk score</div>}
                {loadingRisk && <div style={{textAlign:'center',padding:'24px 0',color:'#6B7898',fontSize:13}}><div style={{fontSize:18,letterSpacing:3,marginBottom:8}}>···</div>Claude is searching market data...</div>}
                {riskData && (
                  <div>
                    <div style={{display:'flex',gap:14,alignItems:'flex-start',marginBottom:14}}>
                      <div style={s.riskCircle(riskData.risk_score||50)}>
                        <div style={{fontSize:26,fontWeight:700,fontFamily:"'IBM Plex Mono',monospace",lineHeight:1.1,color:riskData.risk_score>=70?'#C0302A':riskData.risk_score>=40?'#B05A00':'#0A7A52'}}>{riskData.risk_score}</div>
                        <div style={{fontSize:9,fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',color:riskData.risk_score>=70?'#C0302A':riskData.risk_score>=40?'#B05A00':'#0A7A52'}}>{riskData.risk_label}</div>
                      </div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:14,fontWeight:600,marginBottom:3}}>{riskData.market_sentiment}</div>
                        <div style={{fontSize:11,color:'#6B7898'}}>VIX: {riskData.vix} · Nasdaq: {riskData.nasdaq_today} · S&P: {riskData.sp500_today}</div>
                        <div style={{fontSize:12,color:'#6B7898',marginTop:6,lineHeight:1.55}}>{riskData.summary}</div>
                      </div>
                    </div>
                    {(riskData.factors||[]).map((f,i)=>(
                      <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,padding:'7px 0',borderBottom:'.5px solid #E3E7EF',fontSize:12}}>
                        <div style={{width:7,height:7,borderRadius:'50%',flexShrink:0,marginTop:4,background:f.impact==='negative'?'#C0302A':f.impact==='positive'?'#0A7A52':'#A0ABBC'}}></div>
                        <div style={{flex:1,color:'#6B7898',lineHeight:1.45}}><strong style={{color:'#17202E'}}>{f.factor}</strong>{f.detail?' — '+f.detail:''}</div>
                        <div style={{fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:3,background:f.weight==='high'?'#FDEEEE':f.weight==='medium'?'#FDF3E8':'#ECF8F4',color:f.weight==='high'?'#C0302A':f.weight==='medium'?'#B05A00':'#0A7A52',flexShrink:0}}>{f.weight}</div>
                      </div>
                    ))}
                    {riskData.opportunities?.length>0 && (
                      <div style={{background:'#F3FBF8',border:'1px solid #A8DFC9',borderRadius:7,padding:'10px 12px',marginTop:10}}>
                        <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:'#0A7A52',fontWeight:600,marginBottom:5}}>Opportunities</div>
                        {riskData.opportunities.map((o,i)=><div key={i} style={{fontSize:12,color:'#0A7A52',padding:'2px 0'}}>+ {o}</div>)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Market indicators */}
              <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:14,marginBottom:12}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:10}}>Live Indicators</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
                  {['NVDA','META','MSFT'].map(t=>(
                    <div key={t} style={{background:'#F7F8FA',border:'1px solid #E3E7EF',borderRadius:7,padding:10}}>
                      <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.07em',color:'#A0ABBC',fontWeight:500,marginBottom:3}}>{t}</div>
                      <div style={{fontSize:15,fontWeight:600,fontFamily:"'IBM Plex Mono',monospace"}}>{prices[t]?'$'+prices[t].price.toFixed(2):'—'}</div>
                      {prices[t] && <div style={{fontSize:11,fontFamily:"'IBM Plex Mono',monospace",color:prices[t].change>=0?'#0A7A52':'#C0302A'}}>{prices[t].change>=0?'+':''}{prices[t].change.toFixed(2)}%</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Portfolio risks */}
              <div style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:14}}>
                <div style={{fontSize:11,textTransform:'uppercase',letterSpacing:'.08em',color:'#A0ABBC',fontWeight:500,marginBottom:10}}>Portfolio Risk Flags</div>
                {portRisks().map((r,i)=>(
                  <div key={i} style={{fontSize:12,color:'#6B7898',padding:'6px 0',borderBottom:'.5px solid #E3E7EF'}}>{r}</div>
                ))}
              </div>
            </div>

            {/* Right - News */}
            <div>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
                <div style={{fontSize:13,fontWeight:600}}>Market News</div>
                <div style={{display:'flex',gap:8,alignItems:'center'}}>
                  <span style={{fontSize:11,color:'#A0ABBC'}}>{intelUpdated}</span>
                  <button style={s.intelBtn} onClick={() => fetchNews(newsFilter)} disabled={loadingNews}>{loadingNews?'Loading...':'↻ Refresh News'}</button>
                </div>
              </div>
              <div style={{display:'flex',gap:5,marginBottom:12}}>
                {['all','positive','negative'].map(f=>(
                  <button key={f} style={s.filterBtn(newsFilter===f)} onClick={()=>{setNewsFilter(f);fetchNews(f);}}>
                    {f==='all'?'All':f==='positive'?'Bullish':'Risk'}
                  </button>
                ))}
              </div>
              {loadingNews && <div style={{textAlign:'center',padding:32,color:'#6B7898',fontSize:13}}><div style={{fontSize:18,letterSpacing:3,marginBottom:8}}>···</div>Claude is searching for latest news...</div>}
              {!loadingNews && news.length===0 && <div style={{textAlign:'center',padding:32,color:'#A0ABBC',fontSize:12}}>Click "Refresh News" to load latest market news</div>}
              {news.map((n,i)=>(
                <div key={i} style={s.newsCard} onClick={()=>n.url&&window.open(n.url,'_blank')}>
                  <div style={{display:'flex',justifyContent:'space-between',gap:10,marginBottom:5,alignItems:'flex-start'}}>
                    <div style={{fontSize:13,fontWeight:500,lineHeight:1.4,flex:1}}>{n.title}</div>
                    <span style={s.sentBadge(n.sentiment)}>{n.sentiment==='positive'?'Bullish':n.sentiment==='negative'?'Risk':'Neutral'}</span>
                  </div>
                  <div style={{fontSize:11,color:'#A0ABBC'}}>{n.source}</div>
                  {n.summary && <div style={{fontSize:11,color:'#A0ABBC',marginTop:4,lineHeight:1.45}}>{n.summary}</div>}
                  {n.tickers?.length>0 && (
                    <div style={{display:'flex',gap:4,marginTop:6,flexWrap:'wrap'}}>
                      {n.tickers.filter(t=>MY_TICKERS.includes(t)).map(t=><span key={t} style={{fontSize:10,fontFamily:"'IBM Plex Mono',monospace",fontWeight:600,padding:'1px 6px',borderRadius:3,background:'#EBF1FD',color:'#1455C0'}}>{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══ PROTOCOL ══ */}
      {tab === 'protocol' && (
        <div style={s.page}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
            {[
              { badge:'Daily — 5 min', badgeBg:'#ECF8F4', badgeColor:'#0A7A52', title:'Session flow',
                steps:[['01','Open SAXO, note any price changes'],['02','Click Sync All — Massive updates live prices'],['03','Check engine P&L vs target — circuit breakers?'],['04','Check earnings calendar — entries due this week?']] },
              { badge:'Weekly — Sunday', badgeBg:'#EBF1FD', badgeColor:'#1455C0', title:'Review flow',
                steps:[['01','Share SAXO screenshot in Claude → I pull Massive'],['02','Claude scores each engine A/B/C/D'],['03','Identify 3 moves for the coming week'],['04','Score new candidates in Stock Scorer'],['05','Check macro anchor — did thesis break?']] },
              { badge:'Circuit Breakers', badgeBg:'#FDEEEE', badgeColor:'#C0302A', title:'Non-negotiable',
                steps:[['🔴','Portfolio hits $68K (−15%) → 50% cash, stop E3'],['🔴','2 E3 losses in a row → pause E3 for 1 week'],['🔴','Single trade −1% total → exit immediately'],['🟡','E2 above 40% → rebalance before adding']] },
            ].map((card,i)=>(
              <div key={i} style={{background:'#fff',border:'1px solid #E3E7EF',borderRadius:10,padding:18}}>
                <div style={{display:'inline-block',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'.08em',padding:'2px 8px',borderRadius:4,marginBottom:10,background:card.badgeBg,color:card.badgeColor}}>{card.badge}</div>
                <div style={{fontSize:14,fontWeight:600,marginBottom:12}}>{card.title}</div>
                {card.steps.map(([n,t])=>(
                  <div key={n} style={{display:'flex',gap:8,marginBottom:8,fontSize:12}}>
                    <div style={{fontFamily:"'IBM Plex Mono',monospace",fontSize:11,fontWeight:600,color:'#6B7898',flexShrink:0,width:16}}>{n}</div>
                    <div style={{color:'#6B7898',lineHeight:1.45}}>{t}</div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══ ADD POSITION MODAL ══ */}
      {modal && (
        <div style={s.modalBg} onClick={e => e.target===e.currentTarget&&setModal(null)}>
          <div style={s.modal}>
            <div style={{fontSize:15,fontWeight:600,marginBottom:18}}>Add Position — Engine {modal} ({E[modal].name})</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={s.formGrp}><label style={s.formLbl}>Ticker</label><input style={s.formInp} placeholder="NVDA" value={form.ticker} onChange={e=>setForm(f=>({...f,ticker:e.target.value.toUpperCase()}))} /></div>
              <div style={s.formGrp}><label style={s.formLbl}>Shares</label><input style={s.formInp} type="number" placeholder="40" value={form.shares} onChange={e=>setForm(f=>({...f,shares:e.target.value}))} /></div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
              <div style={s.formGrp}><label style={s.formLbl}>Avg Cost (USD)</label><input style={s.formInp} type="number" step="0.01" placeholder="175.00" value={form.cost} onChange={e=>setForm(f=>({...f,cost:e.target.value}))} /></div>
              <div style={s.formGrp}>
                <label style={s.formLbl}>Live Price</label>
                <div style={{display:'flex',gap:6,alignItems:'center'}}>
                  <div style={{...s.formInp,flex:1,color:fetchedPrice?.error?'#C0302A':fetchedPrice?'#0A7A52':'#A0ABBC',fontFamily:"'IBM Plex Mono',monospace"}}>
                    {fetchingPrice?'Fetching...':fetchedPrice?.error?'Not found':fetchedPrice?'$'+fetchedPrice.price.toFixed(2)+'  '+( fetchedPrice.change>=0?'+':'')+fetchedPrice.change.toFixed(1)+'%':'—'}
                  </div>
                  <button style={s.fetchBtn} onClick={fetchModalPrice} disabled={fetchingPrice}>Fetch ↓</button>
                </div>
              </div>
            </div>
            <div style={{marginBottom:10}}>
              <div style={s.formGrp}><label style={s.formLbl}>Notes (optional)</label><input style={s.formInp} placeholder="Pre-earnings entry" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} /></div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:16}}>
              <button style={s.btnGhost} onClick={()=>setModal(null)}>Cancel</button>
              <button style={s.btnPrimary} onClick={savePos}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
