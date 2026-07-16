import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { generateSyntheticData } from './src/utils/dataGenerator';
import { EntityGraph } from './src/utils/entityLinker';
import { scoreCyberLogin, scoreFraudTransaction, scoreQuantumDocAccess, fuseScores, getSeverity } from './src/utils/scorers';
import { generateAlertExplanation } from './src/utils/explanationGenerator';
import { Customer, AppEvent, Alert, SimState, LoginEvent, TransactionEvent, DocAccessEvent, ScenarioType } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json());

// In-Memory Database State
let customers: Customer[] = [];
let allEvents: AppEvent[] = [];
let historyEvents: AppEvent[] = [];
let liveEvents: AppEvent[] = [];

let processedEvents: AppEvent[] = [];
let generatedAlerts: Alert[] = [];
let entityGraph = new EntityGraph();

// Simulation variables
const SIM_START_ISO = '2026-07-15T00:00:00Z';
const SIM_END_ISO = '2026-07-15T23:59:59Z';
let simClock = new Date(SIM_START_ISO);
let simSpeed = 120; // Simulated minutes per real second. 120 means 2 hours of sim time per 1 real second! (24 hours in 12 seconds)
let simPaused = false;
let lastTickTime = Date.now();

// Track recent logins per customer to compute velocity/time since login
const recentLoginMap = new Map<string, LoginEvent>();

// Helper to determine what scenario an event belongs to based on ID/values
function getScenarioTypeForEvent(event: AppEvent): ScenarioType {
  const id = event.id;
  if (id.includes('ato')) return 'account_takeover';
  if (id.includes('mule')) return 'mule_network';
  if (id.includes('quantum')) return 'quantum_exposure';
  if (id.includes('fp1')) return 'false_positive_control_1';
  if (id.includes('fp2')) return 'false_positive_control_2';
  return 'normal';
}

// Reset and Initialize Data
function initializeSimulation() {
  console.log('Initializing Trident Simulation Database...');
  const data = generateSyntheticData();
  customers = data.customers;
  allEvents = data.events;

  // Split into history (before July 15) and live (on or after July 15)
  const cutOffDate = new Date(SIM_START_ISO);
  historyEvents = allEvents.filter(e => new Date(e.timestamp) < cutOffDate);
  liveEvents = allEvents.filter(e => new Date(e.timestamp) >= cutOffDate);

  processedEvents = [...historyEvents];
  generatedAlerts = [];
  entityGraph = new EntityGraph();
  recentLoginMap.clear();

  // Populate entity graph with all historical customers and their historical logins
  customers.forEach(c => {
    entityGraph.addNode(c.id, 'customer', c.name);
  });

  historyEvents.forEach(evt => {
    if (evt.type === 'login') {
      const login = evt as LoginEvent;
      entityGraph.addNode(login.device_fingerprint, 'device');
      entityGraph.addNode(login.ip_address, 'ip');
      entityGraph.addEdge(login.customer_id, login.device_fingerprint);
      entityGraph.addEdge(login.customer_id, login.ip_address);
      recentLoginMap.set(login.customer_id, login);
    } else if (evt.type === 'transaction') {
      const tx = evt as TransactionEvent;
      entityGraph.addNode(tx.payee, 'payee');
      entityGraph.addEdge(tx.customer_id, tx.payee);
    }
  });

  simClock = new Date(SIM_START_ISO);
  simPaused = false;
  lastTickTime = Date.now();
  console.log(`Initialized simulation with ${customers.length} customers, ${historyEvents.length} history events, and ${liveEvents.length} live events.`);
}

// Process single live event during replay
async function processLiveEvent(event: AppEvent) {
  processedEvents.push(event);
  const customer = customers.find(c => c.id === event.customer_id);
  if (!customer) return;

  const scenario = getScenarioTypeForEvent(event);

  let cyberScore = 0;
  let fraudScore = 0;
  let quantumScore = 0;
  let hasTrigger = false;
  let triggerType = event.type;
  const rawMetrics: Alert['raw_metrics'] = {};

  if (event.type === 'login') {
    const login = event as LoginEvent;
    
    // Register nodes
    entityGraph.addNode(login.device_fingerprint, 'device');
    entityGraph.addNode(login.ip_address, 'ip');
    entityGraph.addEdge(login.customer_id, login.device_fingerprint);
    entityGraph.addEdge(login.customer_id, login.ip_address);

    recentLoginMap.set(login.customer_id, login);

    cyberScore = scoreCyberLogin(login, customer);
    
    rawMetrics.failed_attempts = login.failed_attempts;
    rawMetrics.tls_version = login.tls_version;
    rawMetrics.cipher_suite = login.cipher_suite;
    rawMetrics.is_new_device = !customer.typical_devices.includes(login.device_fingerprint);
    rawMetrics.is_new_geo = login.geo_city !== customer.home_city;

    // Trigger alert if login is highly anomalous, e.g. failed attempts, new geo etc.
    if (cyberScore >= 45 || scenario === 'account_takeover' || scenario === 'quantum_exposure') {
      hasTrigger = true;
    }
  } else if (event.type === 'transaction') {
    const tx = event as TransactionEvent;
    
    entityGraph.addNode(tx.payee, 'payee');
    entityGraph.addEdge(tx.customer_id, tx.payee);

    const recentLogin = recentLoginMap.get(tx.customer_id) || null;
    cyberScore = recentLogin ? scoreCyberLogin(recentLogin, customer) : 0;
    fraudScore = scoreFraudTransaction(tx, customer, recentLogin);

    rawMetrics.amount = tx.amount;
    rawMetrics.time_since_login = tx.time_since_login_minutes;
    rawMetrics.is_new_payee = tx.is_new_payee;
    rawMetrics.payee = tx.payee;

    if (recentLogin) {
      rawMetrics.tls_version = recentLogin.tls_version;
      rawMetrics.cipher_suite = recentLogin.cipher_suite;
    }

    if (fraudScore >= 20 || scenario === 'account_takeover' || scenario === 'mule_network' || scenario === 'false_positive_control_2') {
      hasTrigger = true;
    }
  } else if (event.type === 'doc_access') {
    const doc = event as DocAccessEvent;
    
    const recentLogin = recentLoginMap.get(doc.customer_id) || null;
    cyberScore = recentLogin ? scoreCyberLogin(recentLogin, customer) : 0;
    quantumScore = scoreQuantumDocAccess(doc, customer);

    rawMetrics.bytes_transferred = doc.bytes_transferred;
    rawMetrics.doc_type = doc.document_type;
    rawMetrics.tls_version = doc.tls_version;
    rawMetrics.cipher_suite = doc.cipher_suite;

    if (quantumScore >= 40 || scenario === 'quantum_exposure') {
      hasTrigger = true;
    }
  }

  if (hasTrigger) {
    const fusedScore = fuseScores(cyberScore, fraudScore, quantumScore, scenario);
    const severity = getSeverity(fusedScore);

    // Fetch linked entity context
    const graphContext = entityGraph.getLinkedEntities(customer.id);
    const linkedCount = graphContext.customers.length;

    const alertId = `alt-${Math.floor(Math.random() * 900000) + 100000}`;

    const newAlert: Alert = {
      id: alertId,
      scenario_type: scenario,
      customer_id: customer.id,
      customer_name: customer.name,
      timestamp: event.timestamp,
      trigger_event_type: triggerType,
      trigger_event_id: event.id,
      cyber_score: cyberScore,
      fraud_score: fraudScore,
      quantum_score: quantumScore,
      fused_score: fusedScore,
      severity,
      linked_accounts_count: linkedCount,
      linked_entities: {
        accounts: graphContext.customers,
        devices: graphContext.devices,
        ips: graphContext.ips
      },
      raw_metrics: rawMetrics,
      explanation: 'Analysing alert parameters...', // Filled asynchronously next
      user_disposition: 'unresolved'
    };

    // Generate explanation asynchronously and append
    generatedAlerts.unshift(newAlert);
    
    // Fire-and-forget description calculation
    generateAlertExplanation(newAlert).then(desc => {
      newAlert.explanation = desc;
    });
  }
}

// Background simulation loop
setInterval(() => {
  if (simPaused) {
    lastTickTime = Date.now();
    return;
  }

  const now = Date.now();
  const realDeltaMs = now - lastTickTime;
  lastTickTime = now;

  // Calculate simulated seconds elapsed
  const simSecondsToAdd = (realDeltaMs / 1000) * simSpeed * 60;
  const prevClock = new Date(simClock.getTime());
  simClock = new Date(simClock.getTime() + simSecondsToAdd * 1000);

  const endDemoDate = new Date(SIM_END_ISO);
  if (simClock >= endDemoDate) {
    simClock = endDemoDate;
    simPaused = true; // Complete simulation
  }

  // Find all events in this time bucket
  const eventsToProcess = liveEvents.filter(e => {
    const t = new Date(e.timestamp);
    return t > prevClock && t <= simClock;
  });

  eventsToProcess.forEach(evt => {
    processLiveEvent(evt);
  });
}, 500);

// Initialize state on start
initializeSimulation();

// API Endpoints
app.get('/api/sim/state', (req, res) => {
  res.json({
    currentSimTime: simClock.toISOString(),
    isPaused: simPaused,
    speedMultiplier: simSpeed,
    totalEventsCount: processedEvents.length,
    totalAlertsCount: generatedAlerts.length
  });
});

app.post('/api/sim/control', (req, res) => {
  const { action, speed } = req.body;
  if (action === 'pause') {
    simPaused = true;
  } else if (action === 'resume') {
    simPaused = false;
    lastTickTime = Date.now();
  } else if (action === 'restart') {
    initializeSimulation();
  }

  if (speed !== undefined) {
    simSpeed = Number(speed);
  }

  res.json({ success: true });
});

app.get('/api/alerts', (req, res) => {
  res.json(generatedAlerts);
});

app.post('/api/alerts/:id/disposition', (req, res) => {
  const { id } = req.params;
  const { disposition } = req.body; // 'TP' or 'FP'
  
  const alert = generatedAlerts.find(a => a.id === id);
  if (alert) {
    alert.user_disposition = disposition;
    res.json({ success: true, alert });
  } else {
    res.status(404).json({ error: 'Alert not found' });
  }
});

app.get('/api/stats', (req, res) => {
  const tpCount = generatedAlerts.filter(a => a.user_disposition === 'TP').length;
  const fpCount = generatedAlerts.filter(a => a.user_disposition === 'FP').length;
  const unresolvedCount = generatedAlerts.filter(a => a.user_disposition === 'unresolved').length;

  // Let's compute detection metrics for the 5 scenarios
  // Checks if we successfully generated a high/critical alert for the scenario
  const getScenarioStatus = (type: ScenarioType, isControl = false) => {
    const alerts = generatedAlerts.filter(a => a.scenario_type === type);
    if (isControl) {
      // For control cases, they must NOT reach High/Critical tier
      const triggeredHigh = alerts.some(a => a.severity === 'high' || a.severity === 'critical');
      return {
        count: alerts.length,
        detected_alert: alerts.length > 0,
        triggered_high_false_positive: triggeredHigh
      };
    } else {
      // For attack scenarios, they MUST reach High/Critical
      const detected = alerts.some(a => a.severity === 'high' || a.severity === 'critical');
      return {
        count: alerts.length,
        detected
      };
    }
  };

  // Compute false positive rate specifically on control cases (which should be 0%)
  const controlAlerts = generatedAlerts.filter(a => a.scenario_type === 'false_positive_control_1' || a.scenario_type === 'false_positive_control_2');
  const controlAlertsHigh = controlAlerts.filter(a => a.severity === 'high' || a.severity === 'critical').length;
  const fpRate = controlAlerts.length > 0 ? (controlAlertsHigh / controlAlerts.length) * 100 : 0;

  res.json({
    totalAlerts: generatedAlerts.length,
    tpCount,
    fpCount,
    unresolvedCount,
    falsePositiveRate: fpRate,
    scenarioStats: {
      account_takeover: getScenarioStatus('account_takeover'),
      mule_network: getScenarioStatus('mule_network'),
      quantum_exposure: getScenarioStatus('quantum_exposure'),
      false_positive_control_1: getScenarioStatus('false_positive_control_1', true),
      false_positive_control_2: getScenarioStatus('false_positive_control_2', true)
    }
  });
});

app.get('/api/customers', (req, res) => {
  res.json(customers);
});

app.get('/api/customers/:id', (req, res) => {
  const { id } = req.params;
  const customer = customers.find(c => c.id === id);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  // Get chronological processed events for this customer
  const history = processedEvents.filter(e => e.customer_id === id);
  res.json({
    customer,
    history
  });
});

// Serve Vite frontend
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
