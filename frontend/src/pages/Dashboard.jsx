import { useState, useCallback, useEffect } from 'react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import toast from 'react-hot-toast';
import { scanRepo, scoreColor, scoreToLabel, getScanHistory } from '../services/api';
import ScoreRing from '../components/ScoreRing';
import StatCard  from '../components/StatCard';
import FilePanel from '../components/FilePanel';
import BeforeAfterTab from '../components/BeforeAfterTab'; 

const FONT_MONO = "'JetBrains Mono', monospace";
const TIP_STYLE = {
  backgroundColor:'#0d1527', border:'1px solid #1e293b',
  borderRadius:8, fontFamily:FONT_MONO, fontSize:11,
};

const axisStyle = { fontSize:10, fill:'#94a3b8', fontFamily:FONT_MONO };
const gridStyle = { stroke:'rgba(255,255,255,0.02)' };

function jsonParseSafe(data) {
  try { return JSON.parse(data); } catch { return null; }
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const c = scoreColor(v ?? 50);
  return (
    <div style={{ ...TIP_STYLE, padding:'9px 13px' }}>
      <div style={{ fontSize:10, color:'#94a3b8', marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:16, fontWeight:700, color:c }}>{v}<span style={{ fontSize:10, marginLeft:2, color:'#64748b' }}>/100</span></div>
    </div>
  );
}

function StatusBadge({ score }) {
  const label = score >= 80 ? 'HEALTHY CODEBASE' : score >= 60 ? 'MINOR DEBT' : score >= 30 ? 'MAJOR DEBT' : 'CRITICAL DEBT';
  const color = scoreColor(score);
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:7,
      background:`${color}13`, color,
      border:`1px solid ${color}35`, borderRadius:20,
      padding:'4px 13px', fontSize:10, fontWeight:700,
      fontFamily:FONT_MONO, letterSpacing:'0.12em',
      boxShadow:`0 0 12px ${color}25`,
      whiteSpace: 'nowrap'
    }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:color,
        boxShadow:`0 0 6px ${color}`, display:'inline-block' }}/>
      STATUS: {label}
    </span>
  );
}

const TABS = [
  { id:'overview',     label:'⚡ Overview' },
  { id:'files',        label:'📁 Files'    },
  { id:'before_after', label:'✨ Before / After' }, 
];

export default function Dashboard() {
  // 🎯 FIX: Changed defaults to empty strings so old repositories don't open up automatically on initialization
  const [repo, setRepo] = useState(() => localStorage.getItem('debtiq_repo') || '');
  const [branch, setBranch] = useState(() => localStorage.getItem('debtiq_branch') || 'main');
  const [token, setToken] = useState(() => localStorage.getItem('debtiq_token') || '');
  
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('overview');
  
  const [scan, setScan] = useState(() => {
    const savedScan = localStorage.getItem('debtiq_last_scan');
    return savedScan ? jsonParseSafe(savedScan) : null;
  });

  const [history, setHistory] = useState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  
  const [diffData, setDiffData] = useState({
    fileName: '', originalCode: '', fixedCode: '', explanation: '', oldScore: 0, newScore: 0
  });

  useEffect(() => {
    localStorage.setItem('debtiq_repo', repo);
    localStorage.setItem('debtiq_branch', branch);
    localStorage.setItem('debtiq_token', token);
  }, [repo, branch, token]);

  useEffect(() => {
    if (scan) {
      localStorage.setItem('debtiq_last_scan', JSON.stringify(scan));
    } else {
      localStorage.removeItem('debtiq_last_scan');
    }
  }, [scan]);

  const fetchHistoryLogs = useCallback(async () => {
    if (!repo || !repo.includes('/')) return;
    const [owner, name] = repo.split('/');
    try {
      const data = await getScanHistory(owner, name);
      if (data && data.history) {
        setHistory(data.history);
      }
    } catch (err) {
      console.warn("Failed fetching historical analytics metadata indices.", err);
    }
  }, [repo]);

  useEffect(() => {
    fetchHistoryLogs();
  }, [fetchHistoryLogs]);

  const handleScan = useCallback(async () => {
    if (!repo.includes('/')) { toast.error('Format: owner/repo'); return; }
    
    setLoading(true);
    setDiffData({ fileName: '', originalCode: '', fixedCode: '', explanation: '', oldScore: 0, newScore: 0 });
    setTab('overview');

    const id = toast.loading('⚡ Scanning repository…');
    try {
      const result = await scanRepo({ repo_full_name:repo, branch, github_token:token||undefined, max_files:50 });
      setScan(result);
      toast.dismiss(id);
      toast.success(`Score: ${result.overall_score}/100 — ${result.files_scanned} files analyzed`);
      fetchHistoryLogs(); 
    } catch (err) {
      toast.dismiss(id);
      const errorMsg = err.response?.data?.detail || err.message || 'Failed to scan repository';
      toast.error(`Error: ${errorMsg}`);
    } finally { setLoading(false); }
  }, [repo, branch, token, fetchHistoryLogs]);

  const emptyData = {
    overall_score: 0, critical_count: 0, major_count: 0, minor_count: 0, healthy_count: 0,
    files_scanned: 0, scan_duration_seconds: 0.0,
    repo_full_name: repo || 'Enter owner/repository', branch: branch || '-', file_scores: []
  };

  const currentData = scan || emptyData; 
  const color = scoreColor(currentData.overall_score);

  const pie = [
    { name:'Critical', value:currentData.critical_count, color:'#ff3860' },
    { name:'Major',    value:currentData.major_count,    color:'#f97316' },
    { name:'Minor',    value:currentData.minor_count,    color:'#ffb800' },
    { name:'Healthy',  value:currentData.healthy_count,  color:'#39ff14' },
  ].filter(d => d.value > 0);

  const worstFiles = [...currentData.file_scores]
    .sort((a,b) => a.score - b.score).slice(0,7)
    .map(f => ({ name:f.file_path.split('/').pop(), score:f.score }));

  const langMap = currentData.file_scores.reduce((a,f) => { a[f.language]=(a[f.language]||0)+1; return a; }, {});
  const langData = Object.entries(langMap).map(([name,count]) => ({ name, count }));

  const trendData = history.length > 0 
    ? [...history].reverse().map(h => ({ date: new Date(h.scanned_at).toLocaleDateString(undefined, {month:'short', day:'numeric'}), score: h.overall_score }))
    : [ {date:'Initial',score:0}, {date:'Current',score:currentData.overall_score} ];

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-void)', fontFamily:'var(--font-ui)', position: 'relative', overflowX: 'hidden' }}>
      
      <header style={{
        background:'rgba(6,11,20,.96)', backdropFilter:'blur(16px)',
        borderBottom:'1px solid var(--line-0)', position:'sticky', top:0, zIndex:50, padding:'0 24px',
      }}>
        <div style={{ maxWidth:1440, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:70, padding: '10px 0', flexWrap:'wrap', gap: 12 }}>
          
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:8, background:'linear-gradient(135deg, #00d4ff, #0080ff)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:19, boxShadow:'0 0 18px rgba(0,212,255,.4)' }}>⚡</div>
            <span style={{ fontSize:22, fontWeight:800, letterSpacing:'-0.02em', background:'linear-gradient(135deg, #00d4ff, #0080ff)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>DebtIQ™</span>
          </div>

          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', width: '100%', maxWidth: 'max-content' }}>
            <button 
              onClick={() => setShowHistoryPanel(!showHistoryPanel)}
              style={{
                background: 'var(--bg-surface)', border: '1px solid var(--line-1)', borderRadius: 8, padding: '9px 14px', fontSize: 12, color: '#22d3ee', fontFamily: FONT_MONO, cursor: 'pointer', display: 'flex', gap: 6, alignItems: 'center', transition: 'all 0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--line-1)'}
            >
              📜 HISTORY ({history.length})
            </button>

            <input value={token} onChange={e=>setToken(e.target.value)} type="password" placeholder="GitHub Token (opt)"
              style={{ background:'var(--bg-input)', border: token ? '1px solid #39ff1450' : '1px solid var(--line-1)', borderRadius:8, padding:'9px 14px', fontSize:12, color:'var(--txt-1)', width:130, flexGrow: 1, outline:'none', fontFamily:FONT_MONO }}/>

            <input value={repo} onChange={e=>setRepo(e.target.value)} onKeyDown={e=>e.key==='Enter'&&handleScan()} placeholder="owner/repository"
              style={{ background:'var(--bg-input)', border:'1px solid var(--line-1)', borderRadius:8, padding:'9px 14px', fontSize:12, color:'var(--txt-0)', width:160, flexGrow: 1, outline:'none', fontFamily:FONT_MONO }}/>

            <input value={branch} onChange={e=>setBranch(e.target.value)} placeholder="main"
              style={{ background:'var(--bg-input)', border:'1px solid var(--line-1)', borderRadius:8, padding:'9px 14px', fontSize:12, color:'var(--txt-1)', width:80, flexGrow: 1, outline:'none', fontFamily:FONT_MONO }}/>

            <button onClick={handleScan} disabled={loading} style={{ background: loading ? 'var(--bg-raised)' : 'linear-gradient(135deg, #00d4ff, #0080ff)', color: loading ? 'var(--txt-2)' : '#000', border:'none', borderRadius:8, padding:'9px 22px', fontSize:12, fontWeight:800, cursor: loading ? 'wait' : 'pointer', display:'flex', alignItems:'center', gap:7, fontFamily:FONT_MONO, width: loading ? 'auto' : '100%', maxWidth: 'max-content', justifyContent: 'center', boxShadow: loading ? 'none' : '0 0 16px rgba(0,212,255,.35)' }}>
              {loading ? 'SCANNING…' : '⚡ SCAN'}
            </button>
          </div>
        </div>
      </header>

      {/* DETAILED SCAN HISTORY PANEL DRAWER */}
      {showHistoryPanel && (
        <div style={{ position: 'fixed', top: 71, right: 0, bottom: 0, width: '100%', maxWidth: 380, background: 'rgba(6, 11, 22, 0.98)', borderLeft: '1px solid var(--line-0)', zIndex: 100, padding: 24, overflowY: 'auto', backdropFilter: 'blur(12px)', boxShadow: '-10px 0 30px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontFamily: FONT_MONO, color: '#fff', margin: 0, letterSpacing: '0.05em' }}>📊 SCAN HISTORY LOGS</h3>
            <button onClick={() => setShowHistoryPanel(false)} style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 16, cursor: 'pointer', fontFamily: FONT_MONO }}>✕</button>
          </div>
          {history.length === 0 ? (
            <div style={{ color: '#4b5563', fontFamily: FONT_MONO, fontSize: 12, textAlign: 'center', marginTop: 40 }}>No previous scans found for this repository.</div>
          ) : (
            history.map((hist) => {
              const hColor = scoreColor(hist.overall_score);
              const label = hist.overall_score >= 80 ? 'HEALTHY' : hist.overall_score >= 60 ? 'MINOR' : hist.overall_score >= 30 ? 'MAJOR' : 'CRITICAL';
              
              return (
                <div 
                  key={hist.id} 
                  onClick={() => { 
                    setScan(hist); 
                    setDiffData({ fileName: '', originalCode: '', fixedCode: '', explanation: '', oldScore: 0, newScore: 0 });
                    setShowHistoryPanel(false); 
                    setTab('files');
                    toast.success(`Restored complete workspace tree from branch: ${hist.branch}`);
                  }}
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid #1e293b', borderRadius: 8, padding: 16, marginBottom: 12, cursor: 'pointer', transition: 'all 0.15s' }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--cyan)'}
                  onMouseLeave={e => e.currentTarget.style.borderColor = '#1e293b'}
                >
                  <div style={{ fontSize: 11, color: 'var(--cyan)', fontFamily: FONT_MONO, marginBottom: 6, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    📦 {hist.repo_full_name || repo}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 16, color: hColor, fontFamily: FONT_MONO, fontWeight: 900 }}>
                        {hist.overall_score} pts
                      </span>
                      <span style={{ fontSize: 10, background: `${hColor}15`, color: hColor, border: `1px solid ${hColor}35`, padding: '2px 6px', borderRadius: 4, fontWeight: 700, fontFamily: FONT_MONO }}>
                        {label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: '#f1f5f9', fontFamily: FONT_MONO, fontWeight: 600 }}>
                      🌿 {hist.branch}
                    </span>
                  </div>

                  <div style={{ fontSize: 10, color: '#64748b', fontFamily: FONT_MONO, display: 'flex', justifyContent: 'space-between' }}>
                    <span>⏱ {new Date(hist.scanned_at).toLocaleDateString()}</span>
                    <span>{new Date(hist.scanned_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <main style={{ maxWidth:1440, margin:'0 auto', padding:'36px 24px' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:32, flexWrap: 'wrap', gap: 16 }}>
          <div style={{ width: '100%' }}>
            {/* 🎯 FIX: Configured flexible constraints to break long continuous repository headers cleanly */}
            <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12, flexWrap: 'wrap', width: '100%' }}>
              <span style={{ fontSize:'calc(16px + 1vw)', fontWeight:800, color:'var(--txt-0)', fontFamily:FONT_MONO, letterSpacing:'-0.02em', wordBreak: 'break-all', display: 'block', lineHeight: 1.2, maxWidth: '100%' }}>
                {currentData.repo_full_name}
              </span>
              {scan && <StatusBadge score={currentData.overall_score}/>}
            </div>
            <div style={{ display:'flex', gap: '12px 24px', fontSize:12.5, color:'var(--txt-2)', fontFamily:FONT_MONO, fontWeight:500, flexWrap: 'wrap' }}>
              <span>📂 {currentData.files_scanned} files analyzed</span>
              <span>🌿 branch: {currentData.branch}</span>
              <span>⏱ runtime: {currentData.scan_duration_seconds}s</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                🔑 Token: {token ? <span style={{color: '#39ff14', fontWeight: 700}}>Loaded</span> : <span style={{color: '#64748b', fontWeight: 700}}>None</span>}
              </span>
            </div>
          </div>
        </div>

        {/* METRICS CARDS */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(220px, 1fr))', gap:20, marginBottom:36 }}>
          <div style={{ background:'linear-gradient(135deg, #0d1527 0%, #060b14 100%)', border:`1px solid ${color}50`, borderRadius:14, padding:'24px 28px', display:'flex', alignItems:'center', gap:22, boxShadow:`0 4px 24px ${color}15`, position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${color},transparent)` }}/>
            <ScoreRing score={currentData.overall_score} size={105}/>
            <div>
              <div style={{ fontSize:11, fontFamily:FONT_MONO, letterSpacing:'0.12em', color:'var(--txt-2)', textTransform:'uppercase', fontWeight:700, marginBottom:4 }}>OVERALL SCORE</div>
              <div style={{ fontSize:24, fontWeight:900, color:'#fff', fontFamily:FONT_MONO }}>
                {currentData.overall_score}<span style={{ fontSize:14, fontWeight:500, color:'#4b5563', marginLeft:2 }}>/100</span>
              </div>
              <div style={{ fontSize:12, color:'var(--txt-2)', fontFamily:FONT_MONO, marginTop:4, fontWeight:500 }}>
                Quality Status: <span style={{ color, fontWeight:700 }}>{scan ? scoreToLabel(currentData.overall_score) : 'AWAITING SCAN'}</span>
              </div>
            </div>
          </div>

          <StatCard label="Critical" value={currentData.critical_count} sub={scan ? (currentData.critical_count===0?'All clear!':'urgent fixes needed') : '-'} color="#ff3860" icon="🔴" delay={40}/>
          <StatCard label="Major"   value={currentData.major_count} sub={scan ? "attention needed" : "-"}  color="#f97316" icon="🟠" delay={80}/>
          <StatCard label="Minor"   value={currentData.minor_count} sub={scan ? "small improvements" : "-"} color="#ffb800" icon="🟡" delay={120}/>
          <StatCard label="Healthy" value={currentData.healthy_count} sub={scan ? "clean code files" : "-"}  color="#39ff14" icon="🟢" delay={160}/>
        </div>

        {/* TABS SELECTOR */}
        <div style={{ display:'flex', gap:6, marginBottom:32, borderBottom:'1px solid #1e293b', paddingBottom:0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ background:'none', border:'none', padding:'12px 24px', fontSize:13.5, fontWeight: tab===t.id ? 800 : 600, color: tab===t.id ? '#22d3ee' : '#64748b', cursor:'pointer', fontFamily:FONT_MONO, borderBottom: tab===t.id ? '2px solid #22d3ee' : '2px solid transparent', marginBottom:-1, transition:'all .15s', whiteSpace: 'nowrap' }}>{t.label}</button>
          ))}
        </div>

        {/* WORKSPACE ELEMENT PANELS */}
        {tab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:24 }}>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-dim)', borderRadius:12, padding:26, minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:24 }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--cyan)', boxShadow:'0 0 8px var(--cyan)' }}/>
                  <span style={{ fontSize:12,fontWeight:700,color:'#cbd5e1', fontFamily:FONT_MONO,letterSpacing:'0.05em' }}>📈 SCORE TREND PROFILE TIMELINE</span>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={trendData} margin={{ left: -15, right: 10 }}>
                    <defs>
                      <linearGradient id="tGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#00d4ff" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#00d4ff" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" {...gridStyle}/>
                    <XAxis dataKey="date" tick={axisStyle} axisLine={false} tickLine={false} dy={8}/>
                    <YAxis domain={[0,100]} tick={axisStyle} axisLine={false} tickLine={false} dx={-4}/>
                    <Tooltip content={<ChartTooltip/>}/>
                    <Area type="monotone" dataKey="score" stroke="#00d4ff" strokeWidth={3} fill="url(#tGrad)" dot={{ fill:'#00d4ff', r:5, strokeWidth:1 }}/>
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-dim)', borderRadius:12, padding:26, minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:20 }}>
                  <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--cyan)', boxShadow:'0 0 8px var(--cyan)' }}/>
                  <span style={{ fontSize:12,fontWeight:700,color:'#cbd5e1', fontFamily:FONT_MONO,letterSpacing:'0.05em' }}>🎯 DEBT DISTRIBUTION</span>
                </div>
                <div style={{ position:'relative', width:'100%', height:180, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pie} cx="50%" cy="50%" innerRadius={58} outerRadius={78} paddingAngle={5} dataKey="value" stroke="none">
                        {pie.map((d,i) => (
                          <Cell key={i} fill={d.color} style={{ filter:`drop-shadow(0 0 5px ${d.color}80)` }}/>
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
                    <span style={{ fontSize:24, fontWeight:900, color:'#fff', fontFamily:FONT_MONO, lineHeight:1 }}>
                      {currentData.critical_count+currentData.major_count+currentData.minor_count}
                    </span>
                    <span style={{ fontSize:9, fontWeight:700, color:'#64748b', fontFamily:FONT_MONO, marginTop:4 }}>TOTAL ISSUES</span>
                  </div>
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:12, justifyContent:'center', marginTop:16 }}>
                  {pie.map((d,i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:9,height:9,borderRadius:'50%', background:d.color, boxShadow:`0 0 5px ${d.color}` }}/>
                      <span style={{ fontSize:11,color:'var(--txt-2)',fontFamily:FONT_MONO, fontWeight:600 }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(320px, 1fr))', gap:24 }}>
              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-dim)', borderRadius:12, padding:26, minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:24 }}>
                  <span style={{ fontSize:14, marginRight:2 }}>⚠️</span>
                  <span style={{ fontSize:12,fontWeight:700,color:'#cbd5e1', fontFamily:FONT_MONO,letterSpacing:'0.05em' }}>WORST FILES BY SCORE</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:11 }}>
                  {worstFiles.length > 0 ? worstFiles.map((f,i) => {
                    const c = scoreColor(f.score);
                    return (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <span style={{ fontSize:11,color:'var(--txt-1)',fontFamily:FONT_MONO, textAlign:'right', minWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flexShrink:0 }}>{f.name}</span>
                        <div style={{ flex:1, height:14, background:'var(--bg-void)', borderRadius:4, overflow:'hidden' }}>
                          <div style={{ width:`${f.score}%`, height:'100%', background:`linear-gradient(90deg,${c}88,${c})`, borderRadius:4, boxShadow:`0 0 6px ${c}50`, transition:'width .9s var(--ease)' }}/>
                        </div>
                        <span style={{ fontSize:10,color:c,fontFamily:FONT_MONO, fontWeight:700, minWidth:36, textAlign:'right' }}>{f.score}</span>
                      </div>
                    );
                  }) : <div style={{ color: 'var(--txt-2)', fontFamily: FONT_MONO, fontSize: 12 }}>No files analyzed yet.</div>}
                </div>
              </div>

              <div style={{ background:'var(--bg-card)', border:'1px solid var(--border-dim)', borderRadius:12, padding:26, minWidth: 0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:24 }}>
                  <span style={{ fontSize:14, marginRight:2 }}>🔧</span>
                  <span style={{ fontSize:12,fontWeight:700,color:'#cbd5e1', fontFamily:FONT_MONO,letterSpacing:'0.05em' }}>LANGUAGES</span>
                </div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={langData}>
                    <CartesianGrid strokeDasharray="3 3" {...gridStyle} vertical={false}/>
                    <XAxis dataKey="name" tick={axisStyle} axisLine={false} tickLine={false} dy={6}/>
                    <YAxis tick={axisStyle} axisLine={false} tickLine={false} dx={-4}/>
                    <Tooltip contentStyle={TIP_STYLE}/>
                    <Bar dataKey="count" fill="#00d4ff" radius={[4,4,0,0]} barSize={35} style={{ filter:'drop-shadow(0 0 4px rgba(0,212,255,.45))' }}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div style={{ animation:'slideUp .35s var(--ease) both' }}>
            <FilePanel files={currentData.file_scores} setDiffData={setDiffData} setActiveTab={setTab} />
          </div>
        )}

        {tab === 'before_after' && (
          <div style={{ animation:'slideUp .35s var(--ease) both' }}>
             <BeforeAfterTab diffData={diffData} repo={repo} branch={branch} token={token} />
          </div>
        )}
      </main>
    </div>
  );
}