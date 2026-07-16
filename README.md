# Trident: AI Cyber-Fraud Fusion & Threat Intelligence Platform

Trident is an advanced threat analytics platform designed for banking systems that fuses **cybersecurity telemetry**, **transactional behavior**, and **cryptographic/quantum exposure signals** into a unified, explainable risk score. 

This repository serves as the high-fidelity MVP built for the hackathon judging round. It runs end-to-end locally with zero external server dependencies, replaying live synthetic transactions on an accelerated simulation timeline.

---

## ═══════════════════════════════════════════
## THE TWO-LAYER DATA STORYLINE MODEL
## ═══════════════════════════════════════════

To convince judges with real, explanatory detections, Trident rejects uniformly random mock data and implements a rigorous, mathematically modeled **two-layer database**:

### Layer 1: Statistical Baseline (The Normal World)
* **Population**: 350 highly heterogeneous bank customers.
* **Profiles**: Each customer has a fixed behavioral profile defining:
  * **Login Hours**: Distinct daily windows (e.g., morning only, evening workers).
  * **Device & Network Footprint**: Recognized device fingerprints and home city/country geo IP subnets.
  * **Spend Distributions**: Individualized **log-normal transaction profiles** modeled after real public finance datasets like **IEEE-CIS Fraud Detection** and **PaySim** (log-normal location $\mu$ and scale $\sigma$ parameterized individually).
* **Historical Ledger**: 4 weeks of chronological historical ledger pre-loaded on startup, giving the AI models a robust statistical baseline.

### Layer 2: Injected Threat Storylines (The Signals)
During the simulated live demo, exactly 5 pre-authored stories are injected into the baseline timeline on **July 15, 2026** to prove Trident's multi-channel capabilities:

1. **Account Takeover (Flagship Demo - David Vance)**:
   * *The Attack*: 5 sequential failed login attempts from a Russian IP (`45.138.2.19`, St. Petersburg) using a new Android device, followed by a successful login, immediate payee addition (`Ivan Drago`), and a massive, anomalous transfer of **$8,500** (normal customer baseline $\approx \$120$) within 75 minutes.
   * *Outcome*: Cyber anomaly and transaction fraud models co-fire. The fusion score is propelled to **96/100 (Critical)**.
2. **Coordinated Mule Network (Entity Linking)**:
   * *The Attack*: 4 otherwise unrelated accounts log in within a tight window using the identical device fingerprint (`windows-firefox-mule-station`) and IP subnet, each sending money to the identical high-risk payee (`Acme Laundering Corp`).
   * *Outcome*: Only catchable by linking graph nodes. Entity linking links Bob, Alice, Charlie, and Diane to the same terminal.
3. **Quantum Exposure / HNDL (Harvest Now, Decrypt Later)**:
   * *The Attack*: Evelyn Thorne (CLO, high privileges) logs in using a deprecated TLS v1.0 protocol and cryptographically broken cipher (`TLS_RSA_WITH_3DES_EDE_CBC_SHA`) to pull **450 MB** of sensitive KYC PDFs. **No money moves.**
   * *Outcome*: Proves that Trident catches strategic cyber threat exposures that standard financial fraud detection engines never would.
4. **Legitimate Traveler Control (FP Suppression 1 - Gregory Peck)**:
   * *The Event*: Gregory logs in from Paris, France on a new iPhone (triggering a minor cyber geo/device anomaly). He initiates a normal-sized payment ($\$155$) to his historical payee (`Hotel de Crillon`).
   * *Outcome*: Lack of multi-vector corroboration suppresses the score under **35/100 (Low)**, proving Trident prevents high-severity false alarms.
5. **Legitimate Large Payment Control (FP Suppression 2 - Helen Keller)**:
   * *The Event*: Helen submits a massive tuition payment ($\$12,000$, highly anomalous in size) to `Harvard University` from her normal trusted home IP and device.
   * *Outcome*: Because login telemetry and cryptography are 100% clean, the fusion engine discounts the uncorroborated transactional anomaly, keeping the final risk under **38/100 (Medium)**.

---

## ═══════════════════════════════════════════
## MULTI-CHANNEL SCORING ARCHITECTURE
## ═══════════════════════════════════════════

Trident computes risk across three distinct specialized nodes:

### 1. Cyber Telemetry Scorer (Isolation Forest analogue)
Checks login/session logs against individual baseline profiles.
* **Hour of Day**: Computes distance to nearest typical hourly index.
* **Device Match**: Flags unrecognized device fingerprints (+40 points).
* **Geo Subnet**: Flags unrecognized geographic locations and subnets (+35 points).
* **Sequenced Failures**: Scales risk proportionally to failed attempts (up to 100%).

### 2. Transaction Fraud Scorer (XGBoost analogue)
Evaluates financial actions against the customer's ledger distribution.
* **Log-Normal Z-Score**: Computes exact standard deviations: $Z = \frac{\ln(x) - \mu}{\sigma}$. Scores climb exponentially as transaction sizes breach 1.5 standard deviations.
* **Payee Velocity**: Flags unrecognized payee additions (+30 points) combined with time elapsed since login.

### 3. Cryptographic/Quantum Exposure Scorer (Rule Engine)
Defends against *Harvest Now, Decrypt Later* document exfiltration risks.
* **Cipher Weakness**: Multiplier of **1.5x** for deprecated TLS versions (v1.0/v1.1) or outdated ciphers lacking forward secrecy (3DES, RC4).
* **Sensitivity Class**: Weights high-retention legal/compliance documents.
* **Export Rate**: Measures bulk transfer volumes (e.g., transfers exceeding 100MB).

---

## ═══════════════════════════════════════════
## THE CO-FIRING FUSION & SUPPRESSION ENGINE
## ═══════════════════════════════════════════

A simple weighted average is insufficient for risk management. Trident implements a custom **corroboration copula**:

1. **Multi-Channel Synergy Boost**:
   If two or more specialized subscores are elevated ($>25$), they act as corroborating evidence. The fused score is boosted towards 100 using a synergistic formula:
   $$\text{FusedScore} = \text{MaxScore} + (100 - \text{MaxScore}) \times \frac{\text{SecondScore}}{100} \times 0.8$$
   This ensures co-firing signals (like ATO's Cyber + Fraud) escalate into critical, severe alerts.

2. **Uncorroborated Suppression**:
   If only a single isolated channel fires (e.g. Helen Keller's large tuition payment), it is treated as a potential false positive. The engine applies a heavy **uncorroborated discount**:
   $$\text{FusedScore} = \text{MaxScore} \times 0.35$$
   This suppresses false alarms, verifying Trident's claim of **drastically reducing operational alerts**.

---

## ═══════════════════════════════════════════
## IN-MEMORY ENTITY LINKING GRAPH
## ═══════════════════════════════════════════

To spot mule accounts and coordinated fraud, Trident maintains an in-memory adjacency list graph (`EntityGraph`). 
Edges are added incrementally on live and historical events linking:
* **`Customer` $\longleftrightarrow$ `Device Fingerprint`**
* **`Customer` $\longleftrightarrow$ `IP Subnet`**
* **`Customer` $\longleftrightarrow$ `Payee`**

When an alert is clicked, Trident performs a **Breadth-First Search (BFS)** across the linked nodes to display the exact shared identifiers (e.g., "Linked accounts: 4, shared device: windows-firefox-mule-station"), proving the mule network instantly to judges.

---

## ═══════════════════════════════════════════
## EXPLAINABLE AI REASONING (GEMINI 3.5 FLASH)
## ═══════════════════════════════════════════

For every triggered alert, Trident calls the **Gemini 3.5 Flash** model (via `@google/genai` TypeScript SDK on the server-side) to generate a plain-English explanatory summary. 

To ensure **architectural honesty** and prevent LLM hallucinations:
1. The raw features (precise failed attempts, exact transaction dollars, exact TLS versions, cipher names, and download MBs) are extracted as structured telemetry from the scorers.
2. These precise metrics are injected into a tight system instruction context.
3. The LLM is strictly prohibited from inventing or rounding numbers, outputting a precise, authoritative clinical reasoning.
4. *Graceful Fallback*: If the Gemini API key is missing or calls are rate-limited, Trident's fallback engine generates a highly precise mathematical narrative containing the exact raw numbers, ensuring zero app crashes or visual failures.

---

## ═══════════════════════════════════════════
## SCOPE OF MVP VS. FUTURE ROADMAP
## ═══════════════════════════════════════════

### Included in MVP Scope (Fully Built):
- Seeded Data Generator (Layer 1 baseline + Layer 2 scenarios).
- Real-Time Simulated Clock with playback speed controls.
- Cyber Anomaly, Transaction Fraud, and Quantum Risk Scorers.
- Entity-Linking Adjacency Graph with connected component traversal.
- Corroborating Risk Fusion & suppression mathematics.
- Server-Side Gemini 3.5 Flash explanation generator.
- Gorgeous, high-fidelity dark Cyber Dashboard (Single Page).
- TP/FP Disposition buttons.

### Explicitly Out of Scope (Future Roadmap):
- Distributed streaming pipelines (Kafka, Apache Flink).
- Distributed Graph Database server clusters (Neo4j).
- Real Bank core API integration.
- Automated SOAR actions (blocking cards, locking accounts).
- Post-Quantum TLS on live app traffic.
