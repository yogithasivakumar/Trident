import { Customer, AppEvent, LoginEvent, TransactionEvent, DocAccessEvent, ScenarioType } from '../types';

// Simple seedable random number generator to ensure deterministic data across demo runs
class SeededRandom {
  private seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  // Returns 0 to 1
  next(): number {
    const x = Math.sin(this.seed++) * 10000;
    return x - Math.floor(x);
  }

  // Box-Muller transform for standard normal distribution N(0,1)
  nextNormal(): number {
    let u = 0, v = 0;
    while(u === 0) u = this.next(); 
    while(v === 0) v = this.next();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  // Log-normal distribution
  nextLognormal(mu: number, sigma: number): number {
    return Math.exp(mu + sigma * this.nextNormal());
  }

  // Pick random element from array
  choice<T>(arr: T[]): T {
    const idx = Math.floor(this.next() * arr.length);
    return arr[idx];
  }

  // Integer in range [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }
}

const FIRST_NAMES = ['John', 'Mary', 'Robert', 'Patricia', 'Michael', 'Linda', 'William', 'Elizabeth', 'David', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica', 'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa', 'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley'];
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson', 'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson', 'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson'];
const CITIES = [
  { city: 'New York', country: 'USA', ips: ['192.168.1.', '73.14.99.', '108.45.12.'] },
  { city: 'London', country: 'UK', ips: ['81.149.20.', '185.12.33.', '62.24.110.'] },
  { city: 'San Francisco', country: 'USA', ips: ['50.18.230.', '162.210.192.', '208.54.4.'] },
  { city: 'Tokyo', country: 'Japan', ips: ['118.156.99.', '210.140.10.', '122.211.5.'] },
  { city: 'Frankfurt', country: 'Germany', ips: ['46.112.5.', '87.123.44.', '193.196.2.'] },
  { city: 'Singapore', country: 'Singapore', ips: ['116.88.50.', '175.156.12.', '202.166.4.'] },
  { city: 'Sydney', country: 'Australia', ips: ['1.120.100.', '101.160.20.', '203.111.45.'] }
];
const DEVICES = ['macbook-chrome', 'macbook-safari', 'windows-chrome', 'windows-edge', 'iphone-safari', 'android-chrome', 'ipad-safari'];

export function generateSyntheticData() {
  const rng = new SeededRandom(42); // Seeded to be completely deterministic

  const customers: Customer[] = [];
  const events: AppEvent[] = [];

  // Generate 350 baseline customers
  for (let i = 0; i < 350; i++) {
    const id = `cust-${1000 + i}`;
    const name = `${rng.choice(FIRST_NAMES)} ${rng.choice(LAST_NAMES)}`;
    const homeLoc = rng.choice(CITIES);
    
    // Custom daily hours: normally logs in morning (8-11) or afternoon (13-17) or evening (19-22)
    const patternType = rng.nextInt(1, 3);
    let typicalHours: number[] = [];
    if (patternType === 1) {
      typicalHours = [8, 9, 10, 11, 13, 14, 15, 16];
    } else if (patternType === 2) {
      typicalHours = [9, 10, 11, 14, 15, 16, 17, 19, 20];
    } else {
      typicalHours = [10, 11, 12, 14, 15, 18, 19, 20, 21, 22];
    }

    const deviceName = `${rng.choice(DEVICES)}-${rng.nextInt(1, 5)}`;
    const typicalDevices = [deviceName];
    if (rng.next() < 0.2) {
      typicalDevices.push(`${rng.choice(DEVICES)}-${rng.nextInt(6, 10)}`);
    }

    const baseIpPrefix = rng.choice(homeLoc.ips);
    const typicalIps = [
      `${baseIpPrefix}${rng.nextInt(2, 254)}`,
      `${baseIpPrefix}${rng.nextInt(2, 254)}`
    ];

    // Log-normal baseline amounts based on typical customer profiles (some are high-worth, some are budget)
    // PaySim statistical distribution shape: mean log amount ~ 4.5 to 6.5, sigma ~ 0.5 to 1.2
    const isHighWorth = rng.next() < 0.08;
    const baseline_amount_mu = isHighWorth ? rng.nextNormal() * 0.4 + 7.5 : rng.nextNormal() * 0.3 + 4.8;
    const baseline_amount_sigma = rng.next() * 0.3 + 0.5; // variance

    const typical_payees = [
      `${rng.choice(FIRST_NAMES)} ${rng.choice(LAST_NAMES)}`,
      `${rng.choice(FIRST_NAMES)} ${rng.choice(LAST_NAMES)}`,
      rng.choice(['Electricity Utility', 'City Water Board', 'MegaMart Superstore', 'Corner Gas Station', 'Netflix Inc', 'Amazon Retail'])
    ];

    customers.push({
      id,
      name,
      home_city: homeLoc.city,
      home_country: homeLoc.country,
      typical_login_hours: typicalHours,
      typical_devices: typicalDevices,
      typical_ips: typicalIps,
      baseline_amount_mu,
      baseline_amount_sigma,
      typical_payees
    });
  }

  // Map of customer by ID for quick lookup
  const custMap = new Map<string, Customer>();
  customers.forEach(c => custMap.set(c.id, c));

  // Date range: 2026-06-15 to 2026-07-15 (30 days of baseline history)
  // Let's generate a realistic schedule of historical events.
  const baseStartDate = new Date('2026-06-15T00:00:00Z');
  const simulationEndDate = new Date('2026-07-15T00:00:00Z');

  // Let's generate historical baseline events for each customer
  customers.forEach(cust => {
    // Each customer has a login roughly every 1-2 days, followed by some actions (doc accesses, transactions)
    let curTime = new Date(baseStartDate.getTime() + rng.next() * 2 * 24 * 3600 * 1000); // random offset
    
    while (curTime < simulationEndDate) {
      // 1. Choose login hour
      const hour = rng.choice(cust.typical_login_hours);
      curTime.setUTCHours(hour);
      curTime.setUTCMinutes(rng.nextInt(0, 59));
      curTime.setUTCSeconds(rng.nextInt(0, 59));

      const loginId = `evt-${rng.nextInt(1000000, 9999999)}`;
      const device = rng.choice(cust.typical_devices);
      const ip = rng.choice(cust.typical_ips);
      
      // Cyber baseline login (CIC-IDS2017 compliant cipher suites and TLS 1.2 / 1.3)
      events.push({
        id: loginId,
        customer_id: cust.id,
        timestamp: curTime.toISOString(),
        type: 'login',
        success: true,
        failed_attempts: 0,
        device_fingerprint: device,
        ip_address: ip,
        geo_city: cust.home_city,
        geo_country: cust.home_country,
        tls_version: 'TLSv1.3',
        cipher_suite: 'TLS_AES_256_GCM_SHA384'
      } as LoginEvent);

      // 2. Decide if they make a transaction or look at some document after login (within 5-30 mins)
      let offsetMinutes = rng.nextInt(3, 25);
      const actionTime = new Date(curTime.getTime() + offsetMinutes * 60 * 1000);

      const actionRoll = rng.next();
      if (actionRoll < 0.4) {
        // Transaction
        const amt = rng.nextLognormal(cust.baseline_amount_mu, cust.baseline_amount_sigma);
        const payee = rng.choice(cust.typical_payees);
        events.push({
          id: `evt-${rng.nextInt(1000000, 9999999)}`,
          customer_id: cust.id,
          timestamp: actionTime.toISOString(),
          type: 'transaction',
          amount: Math.round(amt * 100) / 100,
          payee,
          transaction_type: rng.choice(['transfer', 'payment']),
          is_new_payee: false,
          time_since_login_minutes: offsetMinutes
        } as TransactionEvent);
      } else if (actionRoll < 0.75) {
        // Document read
        const bytes = rng.nextInt(500000, 12000000); // 500kb to 12MB
        const docName = rng.choice(['monthly_statement_june.pdf', 'user_terms_v4.pdf', 'privacy_policy.pdf']);
        events.push({
          id: `evt-${rng.nextInt(1000000, 9999999)}`,
          customer_id: cust.id,
          timestamp: actionTime.toISOString(),
          type: 'doc_access',
          document_id: `doc-${rng.nextInt(1000, 9999)}`,
          document_name: docName,
          document_type: docName.includes('statement') ? 'bank_statement' : 'public_terms',
          data_sensitivity: docName.includes('statement') ? 'medium' : 'low',
          bytes_transferred: bytes,
          tls_version: 'TLSv1.3',
          cipher_suite: 'TLS_AES_256_GCM_SHA384'
        } as DocAccessEvent);
      }

      // Move forward by 1-3 days
      curTime = new Date(curTime.getTime() + rng.nextInt(1, 3) * 24 * 3600 * 1000 + rng.next() * 12 * 3600 * 1000);
    }
  });

  // Now, inject the 5 SPECIFIC ATTACK STORYLINES at the end of the simulation timeline
  // All scenarios take place during 2026-07-15 (Simulated Clock Demo Day)
  const demoDate = '2026-07-15';

  // ════════════════════════════════════════════════════════════════
  // STORYLINE 1: Account Takeover (Flagship Demo)
  // ════════════════════════════════════════════════════════════════
  // Customer A: 'cust-1001' (let's pick cust-1001 or modify if not there)
  // We'll create specialized customers for our 5 scenarios so we are 100% sure of their ids and profiles.
  
  const customerA: Customer = {
    id: 'cust-scenario-A',
    name: 'David Vance',
    home_city: 'New York',
    home_country: 'USA',
    typical_login_hours: [9, 10, 11, 14, 15, 16],
    typical_devices: ['macbook-safari-david'],
    typical_ips: ['73.14.99.45'],
    baseline_amount_mu: 4.8, // typical trans ~ $120
    baseline_amount_sigma: 0.4,
    typical_payees: ['Con Edison', 'David Vance (Self)', 'Rent Corp']
  };
  customers.push(customerA);

  // Injected events for ATO:
  // Failed logins
  for (let failedCount = 1; failedCount <= 5; failedCount++) {
    const minStr = String(failedCount * 2).padStart(2, '0');
    const failedTime = new Date(`${demoDate}T10:${minStr}:00Z`);
    events.push({
      id: `evt-ato-fail-${failedCount}`,
      customer_id: customerA.id,
      timestamp: failedTime.toISOString(),
      type: 'login',
      success: false,
      failed_attempts: failedCount,
      device_fingerprint: 'android-chrome-attacker',
      ip_address: '45.138.2.19', // Attacker Russian IP
      geo_city: 'St. Petersburg',
      geo_country: 'Russia',
      tls_version: 'TLSv1.2',
      cipher_suite: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384'
    } as LoginEvent);
  }

  // Successful login
  const successLoginTime = new Date(`${demoDate}T10:14:00Z`);
  const successLoginId = 'evt-ato-success-login';
  events.push({
    id: successLoginId,
    customer_id: customerA.id,
    timestamp: successLoginTime.toISOString(),
    type: 'login',
    success: true,
    failed_attempts: 0,
    device_fingerprint: 'android-chrome-attacker',
    ip_address: '45.138.2.19',
    geo_city: 'St. Petersburg',
    geo_country: 'Russia',
    tls_version: 'TLSv1.2',
    cipher_suite: 'TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384'
  } as LoginEvent);

  // High value transaction to new payee within 60-90 minutes (e.g. 70 minutes later)
  const transferTime = new Date(`${demoDate}T11:24:00Z`);
  events.push({
    id: 'evt-ato-fraud-transfer',
    customer_id: customerA.id,
    timestamp: transferTime.toISOString(),
    type: 'transaction',
    amount: 8500.00, // David's normal baseline is ~$120. This is massive!
    payee: 'Ivan Drago', // New payee
    transaction_type: 'transfer',
    is_new_payee: true,
    time_since_login_minutes: 70
  } as TransactionEvent);


  // ════════════════════════════════════════════════════════════════
  // STORYLINE 2: Mule Network (Entity Linking)
  // ════════════════════════════════════════════════════════════════
  // 4 unrelated customers all transacting from the same device / IP within a short window,
  // each sending money to the same new payee ("Acme Laundering Corp").
  const muleCustomers: Customer[] = [
    {
      id: 'cust-mule-1',
      name: 'Alice Johnson',
      home_city: 'London',
      home_country: 'UK',
      typical_login_hours: [9, 12, 17],
      typical_devices: ['iphone-safari-alice'],
      typical_ips: ['81.149.20.12'],
      baseline_amount_mu: 4.5,
      baseline_amount_sigma: 0.5,
      typical_payees: ['London Water', 'Alice Savings']
    },
    {
      id: 'cust-mule-2',
      name: 'Bob Smith',
      home_city: 'Frankfurt',
      home_country: 'Germany',
      typical_login_hours: [8, 14, 20],
      typical_devices: ['windows-chrome-bob'],
      typical_ips: ['46.112.5.99'],
      baseline_amount_mu: 4.6,
      baseline_amount_sigma: 0.4,
      typical_payees: ['Deutsche Bahn', 'E.ON Energy']
    },
    {
      id: 'cust-mule-3',
      name: 'Charlie Brown',
      home_city: 'San Francisco',
      home_country: 'USA',
      typical_login_hours: [10, 15, 21],
      typical_devices: ['macbook-chrome-charlie'],
      typical_ips: ['50.18.230.14'],
      baseline_amount_mu: 4.9,
      baseline_amount_sigma: 0.5,
      typical_payees: ['PG&E', 'Charlie Savings']
    },
    {
      id: 'cust-mule-4',
      name: 'Diane Prince',
      home_city: 'Sydney',
      home_country: 'Australia',
      typical_login_hours: [9, 13, 18],
      typical_devices: ['iphone-chrome-diane'],
      typical_ips: ['1.120.100.80'],
      baseline_amount_mu: 4.7,
      baseline_amount_sigma: 0.6,
      typical_payees: ['Sydney Water', 'Coles Super']
    }
  ];

  muleCustomers.forEach(c => customers.push(c));

  // Within short window (e.g., between 14:00 and 15:30)
  muleCustomers.forEach((cust, index) => {
    const baseDate = new Date(`${demoDate}T14:00:00Z`);
    const loginTime = new Date(baseDate.getTime() + (10 + index * 15) * 60 * 1000);
    const transTime = new Date(baseDate.getTime() + (15 + index * 15) * 60 * 1000);

    // Login event from shared mule station
    events.push({
      id: `evt-mule-login-${cust.id}`,
      customer_id: cust.id,
      timestamp: loginTime.toISOString(),
      type: 'login',
      success: true,
      failed_attempts: 0,
      device_fingerprint: 'windows-firefox-mule-station', // SHARED
      ip_address: '198.51.100.12',                       // SHARED
      geo_city: 'Panama City',                           // Unusual geo
      geo_country: 'Panama',
      tls_version: 'TLSv1.3',
      cipher_suite: 'TLS_AES_128_GCM_SHA256'
    } as LoginEvent);

    // Transaction event to same payee
    events.push({
      id: `evt-mule-trans-${cust.id}`,
      customer_id: cust.id,
      timestamp: transTime.toISOString(),
      type: 'transaction',
      amount: 480.00, // typical, not overly large to avoid normal fraud filter alerts, but identical!
      payee: 'Acme Laundering Corp', // SHARED payee
      transaction_type: 'transfer',
      is_new_payee: true,
      time_since_login_minutes: 5
    } as TransactionEvent);
  });


  // ════════════════════════════════════════════════════════════════
  // STORYLINE 3: HNDL / Quantum Exposure (No money moves)
  // ════════════════════════════════════════════════════════════════
  // Evelyn Thorne (chief legal officer, high privileges).
  // Outdated TLS 1.0, weak cipher suite (TLS_RSA_WITH_3DES_EDE_CBC_SHA).
  // Repeatedly reads or pulls huge volumes of long-retention high-sensitivity documents (KYC PDFs, bank statements).
  
  const customerC: Customer = {
    id: 'cust-scenario-C',
    name: 'Evelyn Thorne',
    home_city: 'London',
    home_country: 'UK',
    typical_login_hours: [8, 9, 10, 11, 14, 15, 16, 17],
    typical_devices: ['macbook-safari-evelyn'],
    typical_ips: ['81.149.20.180'],
    baseline_amount_mu: 5.2,
    baseline_amount_sigma: 0.4,
    typical_payees: ['Her Majesty Courts', 'Evelyn Savings', 'London Club']
  };
  customers.push(customerC);

  // Historical data accesses for Evelyn are small
  for (let d = 1; d <= 5; d++) {
    events.push({
      id: `evt-evelyn-hist-doc-${d}`,
      customer_id: customerC.id,
      timestamp: new Date(`2026-07-10T10:00:00Z`).toISOString(),
      type: 'doc_access',
      document_id: `doc-normal-${d}`,
      document_name: 'public_bylaws.pdf',
      document_type: 'public_terms',
      data_sensitivity: 'low',
      bytes_transferred: 120000, // 120 KB
      tls_version: 'TLSv1.3',
      cipher_suite: 'TLS_AES_256_GCM_SHA384'
    } as DocAccessEvent);
  }

  // Attack events (16:30): Outdated TLS and weak cipher
  const loginC = new Date(`${demoDate}T16:30:00Z`);
  events.push({
    id: 'evt-quantum-login',
    customer_id: customerC.id,
    timestamp: loginC.toISOString(),
    type: 'login',
    success: true,
    failed_attempts: 0,
    device_fingerprint: 'macbook-safari-evelyn', // Same device (so no simple cyber alert)
    ip_address: '81.149.20.180',
    geo_city: 'London',
    geo_country: 'UK',
    tls_version: 'TLSv1.0', // OUTDATED!
    cipher_suite: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA' // CRYPTOGRAPHICALLY WEAK!
  } as LoginEvent);

  // Bulk sensitive downloads
  const docAccessTime1 = new Date(`${demoDate}T16:35:00Z`);
  events.push({
    id: 'evt-quantum-doc-1',
    customer_id: customerC.id,
    timestamp: docAccessTime1.toISOString(),
    type: 'doc_access',
    document_id: 'doc-sensitive-99',
    document_name: 'KYC_COMPLIANCE_MASTER_LIST.pdf',
    document_type: 'KYC_PDF',
    data_sensitivity: 'high', // SENSITIVE
    bytes_transferred: 280000000, // 280 MB (massive!)
    tls_version: 'TLSv1.0',
    cipher_suite: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA'
  } as DocAccessEvent);

  const docAccessTime2 = new Date(`${demoDate}T16:42:00Z`);
  events.push({
    id: 'evt-quantum-doc-2',
    customer_id: customerC.id,
    timestamp: docAccessTime2.toISOString(),
    type: 'doc_access',
    document_id: 'doc-sensitive-100',
    document_name: 'BOARD_DIRECTIVES_Q2_STRATEGY.pdf',
    document_type: 'bank_statement', // classified as statement
    data_sensitivity: 'high', // SENSITIVE
    bytes_transferred: 170000000, // 170 MB (total 450 MB!)
    tls_version: 'TLSv1.0',
    cipher_suite: 'TLS_RSA_WITH_3DES_EDE_CBC_SHA'
  } as DocAccessEvent);


  // ════════════════════════════════════════════════════════════════
  // STORYLINE 4: False-Positive Control 1 (Legitimate Traveler)
  // ════════════════════════════════════════════════════════════════
  // Gregory Peck (travels to Paris, new device/geo/IP, normal sized txn, known payee, success).
  const customerD: Customer = {
    id: 'cust-scenario-D',
    name: 'Gregory Peck',
    home_city: 'San Francisco',
    home_country: 'USA',
    typical_login_hours: [9, 10, 11, 14, 15, 16],
    typical_devices: ['macbook-chrome-gregory'],
    typical_ips: ['162.210.192.88'],
    baseline_amount_mu: 5.1, // normal transaction ~$160
    baseline_amount_sigma: 0.3,
    typical_payees: ['Hotel de Crillon', 'Gregory Peck (Self)', 'SF Landlords']
  };
  customers.push(customerD);

  const loginDTime = new Date(`${demoDate}T18:00:00Z`);
  events.push({
    id: 'evt-fp1-login',
    customer_id: customerD.id,
    timestamp: loginDTime.toISOString(),
    type: 'login',
    success: true,
    failed_attempts: 0,
    device_fingerprint: 'iphone-safari-gregory', // New device but reasonable
    ip_address: '82.120.35.4', // Paris IP
    geo_city: 'Paris',
    geo_country: 'France',
    tls_version: 'TLSv1.3',
    cipher_suite: 'TLS_AES_256_GCM_SHA384'
  } as LoginEvent);

  const transDTime = new Date(`${demoDate}T18:15:00Z`);
  events.push({
    id: 'evt-fp1-trans',
    customer_id: customerD.id,
    timestamp: transDTime.toISOString(),
    type: 'transaction',
    amount: 155.00, // matches baseline perfectly
    payee: 'Hotel de Crillon', // typical payee!
    transaction_type: 'payment',
    is_new_payee: false,
    time_since_login_minutes: 15
  } as TransactionEvent);


  // ════════════════════════════════════════════════════════════════
  // STORYLINE 5: False-Positive Control 2 (Legitimate Large One-off)
  // ════════════════════════════════════════════════════════════════
  // Helen Keller, completely normal login details, large payment to "Harvard University" (legit).
  const customerE: Customer = {
    id: 'cust-scenario-E',
    name: 'Helen Keller',
    home_city: 'Boston',
    home_country: 'USA',
    typical_login_hours: [8, 9, 12, 14, 15, 20],
    typical_devices: ['macbook-chrome-helen'],
    typical_ips: ['73.14.99.200'],
    baseline_amount_mu: 4.6, // normal transaction ~$100
    baseline_amount_sigma: 0.4,
    typical_payees: ['Eversource', 'Starbucks', 'Helen Savings']
  };
  customers.push(customerE);

  const loginETime = new Date(`${demoDate}T20:00:00Z`);
  events.push({
    id: 'evt-fp2-login',
    customer_id: customerE.id,
    timestamp: loginETime.toISOString(),
    type: 'login',
    success: true,
    failed_attempts: 0,
    device_fingerprint: 'macbook-chrome-helen', // Normal device
    ip_address: '73.14.99.200', // Normal IP
    geo_city: 'Boston',
    geo_country: 'USA',
    tls_version: 'TLSv1.3',
    cipher_suite: 'TLS_AES_256_GCM_SHA384'
  } as LoginEvent);

  const transETime = new Date(`${demoDate}T20:20:00Z`);
  events.push({
    id: 'evt-fp2-trans',
    customer_id: customerE.id,
    timestamp: transETime.toISOString(),
    type: 'transaction',
    amount: 12000.00, // Massive amount ( tuition )
    payee: 'Harvard University', // Tuition / legit payee
    transaction_type: 'payment',
    is_new_payee: true, // New payee, but legit
    time_since_login_minutes: 20
  } as TransactionEvent);

  // Sort ALL events chronologically
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return {
    customers,
    events
  };
}
