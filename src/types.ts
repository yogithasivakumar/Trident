export interface Customer {
  id: string;
  name: string;
  home_city: string;
  home_country: string;
  typical_login_hours: number[]; // e.g. [9, 10, 11, 14, 15] (hour of day)
  typical_devices: string[]; // typical device fingerprints
  typical_ips: string[]; // typical IP addresses
  baseline_amount_mu: number; // log-normal location parameter
  baseline_amount_sigma: number; // log-normal scale parameter
  typical_payees: string[];
}

export type EventType = 'login' | 'transaction' | 'doc_access';

export interface BaseEvent {
  id: string;
  customer_id: string;
  timestamp: string; // ISO string
  type: EventType;
}

export interface LoginEvent extends BaseEvent {
  type: 'login';
  success: boolean;
  failed_attempts: number;
  device_fingerprint: string;
  ip_address: string;
  geo_city: string;
  geo_country: string;
  tls_version: string;
  cipher_suite: string;
}

export interface TransactionEvent extends BaseEvent {
  type: 'transaction';
  amount: number;
  payee: string;
  transaction_type: 'transfer' | 'payment' | 'cash_out';
  is_new_payee: boolean;
  time_since_login_minutes: number;
}

export interface DocAccessEvent extends BaseEvent {
  type: 'doc_access';
  document_id: string;
  document_name: string;
  document_type: 'KYC_PDF' | 'bank_statement' | 'tax_form' | 'public_terms';
  data_sensitivity: 'low' | 'medium' | 'high';
  bytes_transferred: number;
  tls_version: string;
  cipher_suite: string;
}

export type AppEvent = LoginEvent | TransactionEvent | DocAccessEvent;

export type ScenarioType = 
  | 'account_takeover'
  | 'mule_network'
  | 'quantum_exposure'
  | 'false_positive_control_1'
  | 'false_positive_control_2'
  | 'normal';

export interface Alert {
  id: string;
  scenario_type: ScenarioType;
  customer_id: string;
  customer_name: string;
  timestamp: string;
  trigger_event_type: EventType;
  trigger_event_id: string;
  cyber_score: number;       // 0-100
  fraud_score: number;       // 0-100
  quantum_score: number;     // 0-100
  fused_score: number;       // 0-100
  severity: 'critical' | 'high' | 'medium' | 'low' | 'none';
  linked_accounts_count: number;
  linked_entities: {
    accounts: string[];      // customer IDs
    devices: string[];
    ips: string[];
  };
  raw_metrics: {
    failed_attempts?: number;
    amount?: number;
    time_since_login?: number;
    cipher_suite?: string;
    tls_version?: string;
    bytes_transferred?: number;
    doc_type?: string;
    is_new_payee?: boolean;
    is_new_device?: boolean;
    is_new_geo?: boolean;
    payee?: string;
  };
  explanation: string;
  user_disposition: 'TP' | 'FP' | 'unresolved';
}

export interface SimState {
  currentSimTime: string;
  isPaused: boolean;
  speedMultiplier: number; // e.g. 1 hour per real second
  totalEventsCount: number;
  totalAlertsCount: number;
}

export interface DashboardStats {
  totalAlerts: number;
  tpCount: number;
  fpCount: number;
  unresolvedCount: number;
  falsePositiveRate: number; // calculated on FP control cases
  scenarioStats: {
    account_takeover: { count: number; detected: boolean };
    mule_network: { count: number; detected: boolean };
    quantum_exposure: { count: number; detected: boolean };
    false_positive_control_1: { count: number; detected_alert: boolean };
    false_positive_control_2: { count: number; detected_alert: boolean };
  };
}
