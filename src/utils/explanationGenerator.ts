import { GoogleGenAI } from '@google/genai';
import { Alert } from '../types';

let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
}

/**
 * Generates a beautiful, plain-English explanation of the fused risk alert
 * using Gemini 3.5 Flash server-side.
 * It passes actual metrics so that the explanation is exact, truthful, and realistic.
 */
export async function generateAlertExplanation(alert: Alert): Promise<string> {
  const metrics = alert.raw_metrics;
  const c = alert.cyber_score;
  const f = alert.fraud_score;
  const q = alert.quantum_score;
  const fused = alert.fused_score;
  const customerName = alert.customer_name;

  // Let's build a highly-structured, precise text payload with the metrics
  const context = `
Customer Name: ${customerName}
Trident Fusion Risk Score: ${fused}/100 (Severity: ${alert.severity})
Subscores:
- Cyber Telemetry Score: ${c}/100
- Transaction Fraud Score: ${f}/100
- Cryptographic/Quantum Exposure Score: ${q}/100

Trigger Event Type: ${alert.trigger_event_type}
Trigger Details and Raw Metrics:
${metrics.failed_attempts ? `- Failed Login Attempts: ${metrics.failed_attempts}` : ''}
${metrics.amount ? `- Transaction Amount: $${metrics.amount.toLocaleString()}` : ''}
${metrics.is_new_payee !== undefined ? `- Is New/Unrecognized Payee?: ${metrics.is_new_payee}` : ''}
${metrics.time_since_login !== undefined ? `- Time Elapsed Since Login: ${metrics.time_since_login} minutes` : ''}
${metrics.tls_version ? `- TLS Version used: ${metrics.tls_version}` : ''}
${metrics.cipher_suite ? `- Cipher Suite used: ${metrics.cipher_suite}` : ''}
${metrics.bytes_transferred ? `- Data Download Volume: ${(metrics.bytes_transferred / (1024 * 1024)).toFixed(1)} MB` : ''}
${metrics.doc_type ? `- Document Type accessed: ${metrics.doc_type}` : ''}
${metrics.is_new_device !== undefined ? `- Unrecognized Device Fingerprint used?: ${metrics.is_new_device}` : ''}
${metrics.is_new_geo !== undefined ? `- Anomalous Geographic Country?: ${metrics.is_new_geo}` : ''}
- Connected Entity Count: ${alert.linked_accounts_count} accounts share identifiers.
  `;

  const prompt = `
You are the advanced explanation engine of "Trident", a state-of-the-art AI threat fusion platform for retail and corporate banking.
Your task is to write a single, highly professional, scannable, and explanatory paragraph (2 to 3 sentences) that summarizes the exact, real-number alert details.

Guidelines:
1. Explain exactly WHY the alert was triggered based on the data provided.
2. You MUST mention the actual numbers in your explanation (e.g. state the specific transfer amount like "$8,500", the precise failed attempts like "5", the exact TLS version like "TLSv1.0", the cipher like "TLS_RSA_WITH_3DES_EDE_CBC_SHA", the exact minutes elapsed, or downloaded megabytes). Never generalize or make up other numbers.
3. Contrast high-risk fused alerts with uncorroborated alerts, emphasizing the corroboration (e.g. 'Both cyber telemetry and fraud models co-fired' or 'No cyber anomaly was detected to corroborate the transaction, indicating low overall risk').
4. Keep the tone clinical, expert, and authoritative. Do not use fluff or introductory remarks (like "Sure, here is..."). Output ONLY the final plain-English prose.

Alert Context:
${context}
  `;

  const client = getAiClient();
  if (client) {
    try {
      const response = await client.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      if (response.text) {
        return response.text.trim();
      }
    } catch (err) {
      console.error('Error calling Gemini for alert explanation:', err);
    }
  }

  // Fallback engine: generates beautiful and mathematically exact narrative paragraphs
  // when Gemini API key is not present or calls fail.
  return getFallbackExplanation(alert);
}

function getFallbackExplanation(alert: Alert): string {
  const name = alert.customer_name;
  const raw = alert.raw_metrics;

  switch (alert.scenario_type) {
    case 'account_takeover':
      return `Trident detected a Critical risk of Account Takeover for ${name}. Threat fusion triggered when ${raw.failed_attempts} sequential failed login attempts from St. Petersburg, Russia were followed by a success and a high-value transfer of $${raw.amount?.toLocaleString()} to unrecognized payee 'Ivan Drago' within ${raw.time_since_login} minutes. The simultaneous co-firing of cyber anomaly (new device/geo) and transaction fraud models elevated the fused score to ${alert.fused_score}/100.`;
    
    case 'mule_network':
      return `Trident flagged ${name} as part of a coordinated Mule Network ring. Entity-linking graph analysis revealed that ${alert.linked_accounts_count} unrelated customer accounts were accessed within a tight window using the identical device fingerprint ('windows-firefox-mule-station') and IP address ('198.51.100.12'), with each transacting $${raw.amount} to the same high-risk payee 'Acme Laundering Corp'.`;
    
    case 'quantum_exposure':
      return `Trident identified extreme Cryptographic and Quantum Exposure (Harvest Now, Decrypt Later) for ${name}. The user established a session using deprecated protocols (${raw.tls_version}) and a weak cipher suite (${raw.cipher_suite}) to perform bulk exports totaling ${(raw.bytes_transferred! / (1024 * 1024)).toFixed(1)} MB of highly sensitive ${raw.doc_type} documents, with zero transaction outflows.`;
    
    case 'false_positive_control_1':
      return `Trident successfully suppressed this alert as a legitimate customer travel event for ${name}. While login telemetry registered a new device and location (Paris, France), the subsequent payment of $${raw.amount} was directed to a historically known payee and matched the customer's log-normal spending patterns, indicating zero malicious corroboration.`;
    
    case 'false_positive_control_2':
      return `Trident suppressed this transaction alert as a non-malicious false positive for ${name}. Although the tuition payment of $${raw.amount?.toLocaleString()} is exceptionally large compared to baseline, it was initiated from a fully trusted device, standard home IP, and secure TLSv1.3 session with no preceding cyber anomalies.`;
    
    default:
      if (alert.cyber_score > 60 && alert.fraud_score > 60) {
        return `Anomalous activity detected for ${name}. A login with ${raw.failed_attempts || 0} failed attempts on an unrecognized device was immediately followed by an anomalous transaction of $${raw.amount?.toLocaleString()} to payee '${raw.payee || 'unknown'}'. This multi-channel co-firing indicates highly probable compromise.`;
      }
      return `A low-severity baseline event was recorded for ${name}. Minor anomalies in transaction amount or device fingerprint were noted, but lack of multi-vector corroboration confirmed the session pose no material risk.`;
  }
}
