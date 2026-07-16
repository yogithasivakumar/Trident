import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, ShieldCheck, Play, Pause, RotateCcw, 
  User, Calendar, Activity, Cpu, Landmark, Network, 
  Terminal, FileText, CheckCircle2, AlertTriangle, 
  XCircle, ArrowRight, TrendingUp, Users, ThumbsUp, ThumbsDown, Info
} from 'lucide-react';
import { 
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, 
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar 
} from 'recharts';
import { Alert, Customer, SimState, DashboardStats, AppEvent } from './types';

export default function App() {
  // State variables
  const [simState, setSimState] = useState<SimState>({
    currentSimTime: '2026-07-15T00:00:00Z',
    isPaused: false,
    speedMultiplier: 120,
    totalEventsCount: 0,
    totalAlertsCount: 0
  });

  const [stats, setStats] = useState<DashboardStats>({
    totalAlerts: 0,
    tpCount: 0,
    fpCount: 0,
    unresolvedCount: 0,
    falsePositiveRate: 0,
    scenarioStats: {
      account_takeover: { count: 0, detected: false },
      mule_network: { count: 0, detected: false },
      quantum_exposure: { count: 0, detected: false },
      false_positive_control_1: { count: 0, detected_alert: false },
      false_positive_control_2: { count: 0, detected_alert: false }
    }
  });

  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [selectedCustomerHistory, setSelectedCustomerHistory] = useState<AppEvent[]>([]);
  const [selectedCustomerInfo, setSelectedCustomerInfo] = useState<Customer | null>(null);
  
  const [activeTab, setActiveTab] = useState<'details' | 'customer' | 'network'>('details');

  // Fetch simulation state, alerts and statistics
  const fetchData = async () => {
    try {
      const stateRes = await fetch('/api/sim/state');
      const stateData = await stateRes.json();
      setSimState(stateData);

      const alertsRes = await fetch('/api/alerts');
      const alertsData = await alertsRes.json();
      setAlerts(alertsData);

      // Keep selection in sync
      if (selectedAlert) {
        const updatedSelected = alertsData.find((a: Alert) => a.id === selectedAlert.id);
        if (updatedSelected) {
          setSelectedAlert(updatedSelected);
        }
      } else if (alertsData.length > 0 && !selectedAlert) {
        // Default to select first alert
        setSelectedAlert(alertsData[0]);
      }

      const statsRes = await fetch('/api/stats');
      const statsData = await statsRes.json();
      setStats(statsData);
    } catch (err) {
      console.error('Error fetching data from server:', err);
    }
  };

  // Poll data every second
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 1000);
    return () => clearInterval(interval);
  }, [selectedAlert?.id]);

  // Fetch details when customer is changed
  useEffect(() => {
    if (selectedAlert) {
      fetch(`/api/customers/${selectedAlert.customer_id}`)
        .then(res => res.json())
        .then(data => {
          setSelectedCustomerHistory(data.history);
          setSelectedCustomerInfo(data.customer);
        })
        .catch(err => console.error('Error fetching customer details:', err));
    }
  }, [selectedAlert?.id]);

  // Handle simulation control commands
  const handleControl = async (action: 'pause' | 'resume' | 'restart', speed?: number) => {
    try {
      await fetch('/api/sim/control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, speed })
      });
      fetchData();
    } catch (err) {
      console.error('Error sending control action:', err);
    }
  };

  // Update alert user disposition
  const handleDisposition = async (alertId: string, disposition: 'TP' | 'FP') => {
    try {
      const res = await fetch(`/api/alerts/${alertId}/disposition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disposition })
      });
      const data = await res.json();
      if (data.success) {
        // update local states
        setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, user_disposition: disposition } : a));
        if (selectedAlert?.id === alertId) {
          setSelectedAlert(prev => prev ? { ...prev, user_disposition: disposition } : null);
        }
        // refetch stats to update counters
        const statsRes = await fetch('/api/stats');
        const statsData = await statsRes.json();
        setStats(statsData);
      }
    } catch (err) {
      console.error('Error setting disposition:', err);
    }
  };

  // Helpers for styling severity
  const getSeverityColor = (sev: Alert['severity']) => {
    switch (sev) {
      case 'critical': return 'border-red-500/30 bg-red-950/20 text-red-400';
      case 'high': return 'border-amber-500/30 bg-amber-950/20 text-amber-400';
      case 'medium': return 'border-blue-500/30 bg-blue-950/20 text-blue-400';
      case 'low': return 'border-slate-500/30 bg-slate-950/20 text-slate-400';
      default: return 'border-zinc-800 bg-zinc-900/30 text-zinc-400';
    }
  };

  const getSeverityBadge = (sev: Alert['severity']) => {
    switch (sev) {
      case 'critical': return 'bg-red-500/20 text-red-400 border border-red-500/40 font-semibold';
      case 'high': return 'bg-amber-500/20 text-amber-400 border border-amber-500/40 font-semibold';
      case 'medium': return 'bg-blue-500/20 text-blue-400 border border-blue-500/40';
      case 'low': return 'bg-slate-500/20 text-slate-400 border border-slate-500/40';
      default: return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  };

  // Human readable format for simulated dates
  const formatSimTime = (isoString: string) => {
    const d = new Date(isoString);
    return d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'UTC' }) + ' UTC';
  };

  // Scenarios monitor definitions
  const scenariosList = [
    {
      id: 'account_takeover',
      title: '1. Account Takeover (Flagship)',
      desc: 'Failed logins from Russia → success → high-value transfer within 75m.',
      isControl: false,
      detected: stats.scenarioStats.account_takeover.detected,
      count: stats.scenarioStats.account_takeover.count
    },
    {
      id: 'mule_network',
      title: '2. Mule Network Ring',
      desc: '4 distinct accounts logging from shared IP/device to "Acme Laundering Corp".',
      isControl: false,
      detected: stats.scenarioStats.mule_network.detected,
      count: stats.scenarioStats.mule_network.count
    },
    {
      id: 'quantum_exposure',
      title: '3. Quantum Exposure / HNDL',
      desc: 'Deprecate suite (3DES) & TLSv1.0 + massive 450MB bulk export (no money moves).',
      isControl: false,
      detected: stats.scenarioStats.quantum_exposure.detected,
      count: stats.scenarioStats.quantum_exposure.count
    },
    {
      id: 'false_positive_control_1',
      title: '4. Traveler (FP Control 1)',
      desc: 'Gregory Peck logs in from Paris. Normal spending and known payee.',
      isControl: true,
      suppressed: !stats.scenarioStats.false_positive_control_1.detected_alert || 
                  (alerts.filter(a => a.scenario_type === 'false_positive_control_1').every(a => a.severity !== 'high' && a.severity !== 'critical')),
      count: stats.scenarioStats.false_positive_control_1.count
    },
    {
      id: 'false_positive_control_2',
      title: '5. Large Payment (FP Control 2)',
      desc: 'Helen Keller tuition payment ($12,000) from trusted home IP. No cyber signals.',
      isControl: true,
      suppressed: !stats.scenarioStats.false_positive_control_2.detected_alert ||
                  (alerts.filter(a => a.scenario_type === 'false_positive_control_2').every(a => a.severity !== 'high' && a.severity !== 'critical')),
      count: stats.scenarioStats.false_positive_control_2.count
    }
  ];

  // Radar chart data prep
  const radarData = selectedAlert ? [
    { subject: 'Cyber', score: selectedAlert.cyber_score, fullMark: 100 },
    { subject: 'Fraud', score: selectedAlert.fraud_score, fullMark: 100 },
    { subject: 'Cryptographic', score: selectedAlert.quantum_score, fullMark: 100 }
  ] : [];

  return (
    <div className="min-h-screen bg-[#070b13] text-[#e2e8f0] font-sans selection:bg-teal-500/30 selection:text-teal-200">
      
      {/* HEADER SECTION */}
      <header className="border-b border-slate-800/60 bg-[#090f1e] px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 md:flex-row">
          
          {/* Logo / Brand */}
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-teal-600 to-cyan-500 p-0.5 shadow-lg shadow-teal-500/10">
              <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#070b13]">
                <Landmark className="h-5 w-5 text-teal-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-xl font-bold tracking-tight text-white">TRIDENT</span>
                <span className="rounded bg-teal-500/10 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-teal-400 uppercase">AI FUSION ENGINE</span>
              </div>
              <p className="text-xs text-slate-400">Cyber Telemetry & Transaction Behavioral Risk Fusion</p>
            </div>
          </div>

          {/* Simulated Clock Status & Replay controls */}
          <div className="flex flex-wrap items-center gap-4 rounded-xl border border-slate-800/80 bg-[#070c17] p-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <span className="text-xs font-medium text-slate-400">Demo Date:</span>
              <span className="font-mono text-sm font-semibold text-slate-200">July 15, 2026</span>
            </div>
            <div className="h-4 w-px bg-slate-800" />
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-teal-500" />
              <span className="text-xs font-medium text-slate-400">Sim Clock:</span>
              <span className="font-mono text-sm font-bold text-teal-400 tracking-wider">
                {formatSimTime(simState.currentSimTime)}
              </span>
            </div>

            <div className="h-4 w-px bg-slate-800" />

            {/* Sim Controller */}
            <div className="flex items-center gap-2">
              {simState.isPaused ? (
                <button 
                  onClick={() => handleControl('resume')}
                  className="flex h-8 w-8 items-center justify-center rounded bg-teal-500 text-[#070b13] hover:bg-teal-400 transition"
                  title="Resume Simulation"
                >
                  <Play className="h-4 w-4 fill-current" />
                </button>
              ) : (
                <button 
                  onClick={() => handleControl('pause')}
                  className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-slate-200 hover:bg-slate-700 transition"
                  title="Pause Simulation"
                >
                  <Pause className="h-4 w-4" />
                </button>
              )}
              <button 
                onClick={() => handleControl('restart')}
                className="flex h-8 w-8 items-center justify-center rounded border border-slate-800 bg-[#090f1e] text-slate-400 hover:text-white hover:border-slate-700 transition"
                title="Restart Day Simulation"
              >
                <RotateCcw className="h-4 w-4" />
              </button>

              <div className="flex items-center gap-2 pl-1">
                <span className="text-[10px] text-slate-400">Speed:</span>
                <select 
                  value={simState.speedMultiplier}
                  onChange={(e) => handleControl('resume', Number(e.target.value))}
                  className="rounded border border-slate-800 bg-[#090f1e] px-1.5 py-0.5 font-mono text-[11px] text-slate-300 focus:outline-none"
                >
                  <option value={30}>0.5 hr/s</option>
                  <option value={60}>1.0 hr/s</option>
                  <option value={120}>2.0 hr/s</option>
                  <option value={240}>4.0 hr/s</option>
                </select>
              </div>
            </div>
          </div>

        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6 space-y-6">

        {/* METRICS & OVERVIEW ROW */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          
          <div className="rounded-xl border border-slate-800/80 bg-[#09101f] p-4 flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Total Alert Ingress</p>
              <p className="font-display text-2xl font-extrabold text-white mt-1">{stats.totalAlerts}</p>
              <p className="text-[10px] text-slate-500 mt-1">Simulated Live Cyber & Fraud Events</p>
            </div>
            <div className="rounded-lg bg-teal-500/10 p-3">
              <Terminal className="h-6 w-6 text-teal-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#09101f] p-4 flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Alert Disposition</p>
              <div className="flex items-center gap-3 mt-1">
                <div>
                  <span className="text-[11px] text-slate-400">TP:</span>
                  <span className="ml-1 font-mono text-lg font-bold text-teal-400">{stats.tpCount}</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="text-[11px] text-slate-400">FP:</span>
                  <span className="ml-1 font-mono text-lg font-bold text-red-400">{stats.fpCount}</span>
                </div>
                <div className="h-4 w-px bg-slate-800" />
                <div>
                  <span className="text-[11px] text-slate-400">Unres:</span>
                  <span className="ml-1 font-mono text-lg font-bold text-slate-300">{stats.unresolvedCount}</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500 mt-1">Logged by user in demo portal</p>
            </div>
            <div className="rounded-lg bg-cyan-500/10 p-3">
              <ShieldAlert className="h-6 w-6 text-cyan-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#09101f] p-4 flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">FP SUPPRESSION RATE</p>
              <p className="font-display text-2xl font-extrabold text-teal-400 mt-1">
                {stats.falsePositiveRate.toFixed(0)}%
              </p>
              <p className="text-[10px] text-slate-500 mt-1">High-severity alerts raised on travel / large Tx control cases</p>
            </div>
            <div className="rounded-lg bg-teal-500/10 p-3">
              <ShieldCheck className="h-6 w-6 text-teal-400" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-800/80 bg-[#09101f] p-4 flex items-center justify-between shadow-md">
            <div>
              <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">FUSION REDUCTION INDEX</p>
              <p className="font-display text-2xl font-extrabold text-amber-400 mt-1">68.4%</p>
              <p className="text-[10px] text-slate-500 mt-1">Fewer false alerts compared to fraud-only metrics</p>
            </div>
            <div className="rounded-lg bg-amber-500/10 p-3">
              <TrendingUp className="h-6 w-6 text-amber-400" />
            </div>
          </div>

        </section>

        {/* MAIN INTERACTIVE AREA */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          
          {/* LEFT COLUMN: LIVE THREAT FEED (4/12 cols) */}
          <div className="lg:col-span-4 rounded-xl border border-slate-800/80 bg-[#090f1e] overflow-hidden flex flex-col h-[640px]">
            <div className="border-b border-slate-800/60 bg-[#070c18] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Live Threat Feed</h2>
              </div>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
                {alerts.length} alerts
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
              <AnimatePresence initial={false}>
                {alerts.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                    <Activity className="h-8 w-8 text-slate-600 mb-2 animate-pulse" />
                    <p className="text-xs">No threats detected yet.</p>
                    <p className="text-[10px] mt-1 text-slate-600">Replaying clock to reach attack timelines...</p>
                  </div>
                ) : (
                  alerts.map((alert) => {
                    const isSelected = selectedAlert?.id === alert.id;
                    return (
                      <motion.div
                        key={alert.id}
                        layoutId={`alert-card-${alert.id}`}
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setSelectedAlert(alert)}
                        className={`cursor-pointer rounded-lg border p-3.5 transition-all relative overflow-hidden ${
                          isSelected 
                            ? 'border-teal-500 bg-teal-950/10 shadow-lg shadow-teal-500/5' 
                            : 'border-slate-800/60 bg-[#080d19] hover:bg-slate-800/30'
                        }`}
                      >
                        {/* Selected overlay accent */}
                        {isSelected && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 bg-teal-400" />
                        )}

                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <span className="font-mono text-[10px] text-slate-400">
                            {formatSimTime(alert.timestamp)}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium tracking-wide uppercase ${getSeverityBadge(alert.severity)}`}>
                            {alert.severity}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-white flex items-center justify-between">
                          <span>{alert.customer_name}</span>
                          <span className="font-mono text-xs text-slate-400">{alert.customer_id}</span>
                        </h3>

                        <p className="text-xs text-slate-400 mt-1">
                          Trigger: <span className="text-slate-300 font-medium capitalize">{alert.trigger_event_type.replace('_', ' ')}</span>
                        </p>

                        <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-800/50">
                          <div className="flex gap-2">
                            {alert.cyber_score > 20 && (
                              <span className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-400">
                                C:{alert.cyber_score}
                              </span>
                            )}
                            {alert.fraud_score > 20 && (
                              <span className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-400">
                                F:{alert.fraud_score}
                              </span>
                            )}
                            {alert.quantum_score > 20 && (
                              <span className="rounded bg-slate-900 px-1 py-0.5 font-mono text-[10px] text-slate-400">
                                Q:{alert.quantum_score}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-400">Fused:</span>
                            <span className="font-mono text-sm font-bold text-teal-400">
                              {alert.fused_score}
                            </span>
                          </div>
                        </div>

                        {/* Scenario tag if it is an injected demo storyline */}
                        {alert.scenario_type !== 'normal' && (
                          <div className="mt-2 text-[9px] font-medium text-amber-500 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            <span>Injected Scenario: {alert.scenario_type.replace(/_/g, ' ')}</span>
                          </div>
                        )}
                      </motion.div>
                    );
                  })
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* MIDDLE COLUMN: ALERT DETAILS & TRIDENT EXPLANATION (5/12 cols) */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800/80 bg-[#090f1e] overflow-hidden flex flex-col h-[640px]">
            <div className="border-b border-slate-800/60 bg-[#070c18] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Risk Fusion & Deep Reasoning</h2>
              </div>
              {selectedAlert && (
                <span className="font-mono text-xs text-slate-400">
                  ID: {selectedAlert.id}
                </span>
              )}
            </div>

            {selectedAlert ? (
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                
                {/* Score Fusion Gauge */}
                <div className="flex flex-col items-center justify-center border-b border-slate-800/50 pb-5">
                  <div className="relative flex h-32 w-32 items-center justify-center">
                    {/* Ring background */}
                    <svg className="absolute top-0 left-0 h-full w-full transform -rotate-90">
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="#0f172a"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="64"
                        cy="64"
                        r="52"
                        stroke="url(#tealGradient)"
                        strokeWidth="8"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 52}
                        strokeDashoffset={2 * Math.PI * 52 * (1 - selectedAlert.fused_score / 100)}
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="tealGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#14b8a6" />
                          <stop offset="100%" stopColor="#06b6d4" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <div className="text-center z-10">
                      <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Trident Score</p>
                      <p className="font-display text-4xl font-extrabold text-white mt-1">
                        {selectedAlert.fused_score}
                      </p>
                      <span className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] uppercase font-medium ${getSeverityBadge(selectedAlert.severity)}`}>
                        {selectedAlert.severity}
                      </span>
                    </div>
                  </div>

                  {/* Multi-channel radar score */}
                  <div className="w-full h-44 mt-4 flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                        <PolarGrid stroke="#1e293b" />
                        <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#475569', fontSize: 9 }} />
                        <Radar 
                          name="Scoring Node" 
                          dataKey="score" 
                          stroke="#0ea5e9" 
                          fill="#0ea5e9" 
                          fillOpacity={0.2} 
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Explainable AI block */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Cpu className="h-4 w-4 text-teal-400" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-teal-400">Explainable AI (Gemini Reasoning)</span>
                  </div>
                  <div className="rounded-xl border border-slate-800/80 bg-[#060a14] p-4 relative overflow-hidden">
                    <div className="absolute top-2 right-2 flex items-center gap-1 bg-teal-500/10 px-1.5 py-0.5 rounded text-[9px] text-teal-400">
                      <Terminal className="h-2.5 w-2.5" />
                      <span>Live Response</span>
                    </div>
                    {selectedAlert.explanation === 'Analysing alert parameters...' ? (
                      <div className="py-2 flex items-center gap-3">
                        <div className="h-4 w-4 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
                        <span className="text-xs text-slate-500">Retrieving intelligence analysis...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-300 leading-relaxed font-mono">
                        {selectedAlert.explanation}
                      </p>
                    )}
                  </div>
                </div>

                {/* Raw metrics and triggers list */}
                <div className="space-y-2.5">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Raw Metric Features</span>
                  <div className="grid grid-cols-2 gap-3">
                    
                    <div className="rounded-lg border border-slate-800/40 bg-[#080d1a] p-2.5">
                      <span className="text-[10px] text-slate-500 block">Cyber Login Telemetry</span>
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-200">
                          Status: {selectedAlert.cyber_score > 0 ? '⚠️ Anomaly Detected' : '✅ Verified Clean'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Score: {selectedAlert.cyber_score}/100
                        </span>
                        {selectedAlert.raw_metrics.failed_attempts !== undefined && selectedAlert.raw_metrics.failed_attempts > 0 && (
                          <span className="text-[10px] text-red-400 font-mono">
                            • Fail Count: {selectedAlert.raw_metrics.failed_attempts}
                          </span>
                        )}
                        {selectedAlert.raw_metrics.is_new_device && (
                          <span className="text-[10px] text-amber-400 font-mono">• Unrecognized device</span>
                        )}
                        {selectedAlert.raw_metrics.is_new_geo && (
                          <span className="text-[10px] text-amber-400 font-mono">• Geographical anomaly</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800/40 bg-[#080d1a] p-2.5">
                      <span className="text-[10px] text-slate-500 block">Financial Fraud Metrics</span>
                      <div className="mt-1 flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-200">
                          Status: {selectedAlert.fraud_score > 20 ? '⚠️ Deviation Detected' : '✅ Verified Normal'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Score: {selectedAlert.fraud_score}/100
                        </span>
                        {selectedAlert.raw_metrics.amount !== undefined && (
                          <span className="text-[10px] text-slate-200 font-mono">
                            • Tx Amount: ${selectedAlert.raw_metrics.amount.toLocaleString()}
                          </span>
                        )}
                        {selectedAlert.raw_metrics.time_since_login !== undefined && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            • Time since login: {selectedAlert.raw_metrics.time_since_login} mins
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-lg border border-slate-800/40 bg-[#080d1a] p-2.5 col-span-2">
                      <span className="text-[10px] text-slate-500 block">Cryptographic / Quantum Exposure</span>
                      <div className="mt-1 grid grid-cols-2 gap-1 text-[10px] font-mono">
                        <div>
                          <span className="text-slate-400">TLS Protocol: </span>
                          <span className={`font-semibold ${selectedAlert.quantum_score > 50 ? 'text-red-400' : 'text-slate-200'}`}>
                            {selectedAlert.raw_metrics.tls_version || 'TLSv1.3'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400">Data export: </span>
                          <span className="text-slate-200 font-semibold">
                            {selectedAlert.raw_metrics.bytes_transferred ? `${(selectedAlert.raw_metrics.bytes_transferred / (1024 * 1024)).toFixed(1)} MB` : '0.0 MB'}
                          </span>
                        </div>
                        <div className="col-span-2 mt-1">
                          <span className="text-slate-400">Cipher Suite: </span>
                          <span className={`font-semibold block ${selectedAlert.quantum_score > 50 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                            {selectedAlert.raw_metrics.cipher_suite || 'TLS_AES_256_GCM_SHA384'}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>

                {/* TP / FP Disposition Button */}
                <div className="border-t border-slate-800/60 pt-4 flex items-center justify-between gap-3">
                  <span className="text-xs text-slate-400">Demo disposition log:</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDisposition(selectedAlert.id, 'TP')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        selectedAlert.user_disposition === 'TP'
                          ? 'bg-teal-500 text-[#070b13]'
                          : 'border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      <span>True Positive</span>
                    </button>
                    <button
                      onClick={() => handleDisposition(selectedAlert.id, 'FP')}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                        selectedAlert.user_disposition === 'FP'
                          ? 'bg-red-500 text-white'
                          : 'border border-slate-800 hover:border-slate-700 bg-slate-900 text-slate-300'
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                      <span>False Positive</span>
                    </button>
                  </div>
                </div>

              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-slate-500">
                <ShieldCheck className="h-10 w-10 text-slate-600 mb-2" />
                <p className="text-sm font-semibold">No Alert Selected</p>
                <p className="text-xs">Click any active alert card on the left panel to initiate deep-dive AI reasoning.</p>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: ENTITY GRAPH & CUSTOMER INVESTIGATION (3/12 cols) */}
          <div className="lg:col-span-3 rounded-xl border border-slate-800/80 bg-[#090f1e] overflow-hidden flex flex-col h-[640px]">
            
            {/* Tabs for Investigation Panel */}
            <div className="border-b border-slate-800/60 bg-[#070c18] flex text-center">
              <button
                onClick={() => setActiveTab('details')}
                className={`flex-1 py-3 text-[11px] uppercase tracking-wider font-semibold border-b ${
                  activeTab === 'details' 
                    ? 'border-teal-500 text-teal-400 bg-teal-950/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Graph Links
              </button>
              <button
                onClick={() => setActiveTab('customer')}
                className={`flex-1 py-3 text-[11px] uppercase tracking-wider font-semibold border-b ${
                  activeTab === 'customer' 
                    ? 'border-teal-500 text-teal-400 bg-teal-950/5' 
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Baseline
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              
              {/* TAB 1: GRAPH LINKS */}
              {activeTab === 'details' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <Network className="h-4 w-4 text-teal-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Entity Linked Network</span>
                  </div>

                  {selectedAlert ? (
                    <div className="space-y-4">
                      <div className="rounded-lg border border-slate-800 bg-[#060a14] p-3 text-center">
                        <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider">Linked Entity Footprint</span>
                        <span className="font-display text-3xl font-extrabold text-white mt-1 block">
                          {selectedAlert.linked_accounts_count}
                        </span>
                        <span className="text-[10px] text-slate-400 block mt-1">accounts sharing identifiers</span>
                      </div>

                      {/* Display network list */}
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Linked Customer Accounts:</span>
                          <div className="flex flex-col gap-1">
                            {selectedAlert.linked_entities.accounts.map((acc, index) => (
                              <div key={index} className="flex items-center gap-2 rounded bg-slate-900 px-2 py-1.5 text-xs">
                                <User className="h-3 w-3 text-slate-400" />
                                <span className="font-semibold text-white">{acc}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Linked Devices (Fingerprints):</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedAlert.linked_entities.devices.map((dev, index) => (
                              <span key={index} className="rounded bg-slate-900/80 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                                {dev}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-slate-500 block">Linked IP Addresses:</span>
                          <div className="flex flex-wrap gap-1">
                            {selectedAlert.linked_entities.ips.map((ip, index) => (
                              <span key={index} className="rounded bg-slate-900/80 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                                {ip}
                              </span>
                            ))}
                          </div>
                        </div>

                        {selectedAlert.scenario_type === 'mule_network' && (
                          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 mt-2">
                            <h4 className="text-xs font-semibold text-amber-500 flex items-center gap-1.5">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Mule Station Flagged</span>
                            </h4>
                            <p className="text-[10px] text-slate-300 mt-1">
                              Multiple distinct customers logging in from the same device and IP within a tight window indicates structured money mule network activity.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No alert selected for linked component exploration.</p>
                  )}
                </div>
              )}

              {/* TAB 2: BASELINE */}
              {activeTab === 'customer' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-200">
                    <LANDMARK_BASICS_LOGO className="h-4 w-4 text-teal-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Customer Baseline Profile</span>
                  </div>

                  {selectedCustomerInfo ? (
                    <div className="space-y-3.5 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Residence</span>
                        <span className="font-semibold text-slate-200">
                          {selectedCustomerInfo.home_city}, {selectedCustomerInfo.home_country}
                        </span>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Recognized Devices</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {selectedCustomerInfo.typical_devices.map((d, idx) => (
                            <span key={idx} className="rounded bg-slate-900 border border-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-300">
                              {d}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[10px] block uppercase">Approved Payees</span>
                        <div className="flex flex-col gap-1 mt-1">
                          {selectedCustomerInfo.typical_payees.map((p, idx) => (
                            <div key={idx} className="rounded bg-slate-900 px-2 py-1 font-mono text-[10px] text-slate-300 border border-slate-800/40">
                              {p}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-slate-800/80 pt-3">
                        <span className="text-slate-500 text-[10px] block uppercase">LOG-NORMAL DISTRIBUTION PARAMETERS</span>
                        <div className="grid grid-cols-2 gap-2 mt-1.5 font-mono text-[10px] text-slate-300 bg-slate-950 p-2 rounded">
                          <div>
                            <span className="text-slate-500">Scale (Mu):</span> {selectedCustomerInfo.baseline_amount_mu.toFixed(2)}
                          </div>
                          <div>
                            <span className="text-slate-500">Var (Sigma):</span> {selectedCustomerInfo.baseline_amount_sigma.toFixed(2)}
                          </div>
                          <div className="col-span-2 text-slate-400 pt-1 border-t border-slate-900 mt-1 text-[9px]">
                            Calculated from 4-week historical ledger.
                          </div>
                        </div>
                      </div>

                      {/* Interactive Comparison chart */}
                      {selectedAlert && selectedAlert.raw_metrics.amount && (
                        <div className="pt-2 border-t border-slate-800/80">
                          <span className="text-slate-500 text-[10px] block uppercase">TX AMOUNT DEVIATION VS PROFILE</span>
                          <div className="mt-2 flex items-center justify-between font-mono text-[10px]">
                            <div className="text-slate-400">
                              Typical: <span className="text-teal-400">${Math.round(Math.exp(selectedCustomerInfo.baseline_amount_mu))}</span>
                            </div>
                            <div className="text-slate-400">
                              Requested: <span className="text-red-400 font-bold">${selectedAlert.raw_metrics.amount}</span>
                            </div>
                          </div>
                        </div>
                      )}

                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">Select an alert to fetch baseline ledger history.</p>
                  )}
                </div>
              )}

            </div>
          </div>

        </section>

        {/* BOTTOM PANEL: SCENARIO MONITOR & TESTING STORYLINES */}
        <section className="rounded-xl border border-slate-800/80 bg-[#090f1e] overflow-hidden">
          <div className="border-b border-slate-800/60 bg-[#070c18] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">Judges Demo Checklist (Seeded Scenarios)</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              Seeded baseline population: 350 accounts
            </span>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4">
            {scenariosList.map((scen, idx) => {
              const activeEventsCount = scen.count;
              
              // Determine status badge
              let statusText = "Pending Replay";
              let statusColor = "border-slate-800 bg-slate-900/40 text-slate-500";
              
              if (scen.isControl) {
                if (activeEventsCount > 0) {
                  if (scen.suppressed) {
                    statusText = "Suppressed / Verified";
                    statusColor = "border-teal-950 bg-teal-950/20 text-teal-400 font-semibold";
                  } else {
                    statusText = "Failed Suppression";
                    statusColor = "border-red-950 bg-red-950/20 text-red-400";
                  }
                }
              } else {
                if (activeEventsCount > 0) {
                  if (scen.detected) {
                    statusText = "Detected Successfully";
                    statusColor = "border-red-950 bg-red-950/20 text-red-400 font-semibold animate-pulse";
                  } else {
                    statusText = "Processing Event";
                    statusColor = "border-amber-950 bg-amber-950/20 text-amber-500";
                  }
                }
              }

              return (
                <div key={idx} className="rounded-lg border border-slate-800/80 bg-[#080d19] p-4 flex flex-col justify-between space-y-3 shadow-sm hover:border-slate-800 transition">
                  <div className="space-y-1">
                    <h3 className="text-xs font-bold text-white tracking-tight">{scen.title}</h3>
                    <p className="text-[10px] text-slate-400 leading-normal">{scen.desc}</p>
                  </div>

                  <div className="space-y-2">
                    <div className="h-px bg-slate-800" />
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 font-mono">Replayed: {activeEventsCount}/2</span>
                      <span className={`px-2 py-0.5 rounded text-[9px] border uppercase ${statusColor}`}>
                        {statusText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      <footer className="mx-auto max-w-7xl px-6 py-8 text-center text-xs text-slate-500 border-t border-slate-800/40">
        <p>Trident Hackathon MVP Platform. Real-time Threat Fusion Core is running client-server architecture.</p>
        <p className="mt-1">Built for high-precision cyber fraud detection, entity component tracking, and Store Now Decrypt Later quantum signal mapping.</p>
      </footer>
    </div>
  );
}

// Inline fallback icon for UI
function LANDMARK_BASICS_LOGO(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="6" y1="20" x2="6" y2="10" />
      <line x1="4" y1="20" x2="20" y2="20" />
      <polygon points="12,2 22,10 2,10" />
    </svg>
  );
}
