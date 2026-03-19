# CareMap — Solution Overview

**Smart Health Data Mapping: From Raw Data to Insights**
START Hack 2026 · epaSOLUTIONS Challenge · March 2026

---

## The Challenge

Healthcare institutions generate enormous volumes of data every day across dozens of disconnected systems: hospital information systems, laboratory software, Excel-based care assessments, PDF reports, sensor feeds, and free-text nursing documentation. Each system stores information in its own format, with its own naming conventions, scales, and structures.

The result is a fragmented data landscape where combining information for analytics, quality improvement, or predictive modelling requires extensive manual effort. Data engineers spend weeks mapping columns, reconciling codes, and chasing inconsistencies. Much of the data that could drive better patient outcomes remains locked in silos, unused.

For epaSOLUTIONS, serving over 1,400 care institutions with 630,000 active users, this fragmentation is both a massive challenge and an equally massive opportunity.

---

## The Opportunity

The DACH healthcare market represents roughly €100 billion in annual costs. Even modest efficiency improvements unlock significant value.

| Metric | Value |
|---|---|
| Partner Institutions | 1,400 |
| Active Users | 630,000 |
| DACH Healthcare Market | €100B annually |
| Efficiency Gain Potential | 1–2% = €800M–€1.6B in savings |

When 5% of inpatient cases incur avoidable complications at €3,000–5,000 per case, predictive prevention enabled by harmonized data could reduce these by 10–20%, yielding savings in the hundreds of millions.

The prerequisite for all of this is a unified, high-quality data foundation. That is what CareMap provides.

---

## What Is CareMap

CareMap is an intelligent data harmonization platform purpose-built for healthcare. It combines a visual workflow interface with an AI-powered data analyst to transform fragmented clinical data into a unified, queryable, and trustworthy dataset.

The platform has three interlocking surfaces.

### The Visual Flow Canvas

The canvas is the primary workspace. It is a drag-and-drop interface where users construct data pipelines visually. Each pipeline is composed of nodes connected by edges, representing the journey of data from raw source to harmonized output.

Users start by dragging a source node onto the canvas and uploading a file. The moment a file arrives, CareMap automatically profiles it: inferring column types, detecting the clinical domain it belongs to, suggesting semantic labels for each field, and surfacing quality issues. All of this appears directly in the node's configuration panel, where the user can review and correct anything the system got wrong.

From there, the user connects the source to a mapping node. CareMap's AI proposes how each source field should map to the canonical clinical model, along with a confidence score and a plain-language explanation. High-confidence mappings are accepted automatically; uncertain ones are highlighted for human review. Once confirmed, data flows through to the harmonized store.

### The Chat-Driven Analyst

Once data is harmonized, users can ask questions in natural language. CareMap's built-in data agent understands the clinical data model, explores the available data, builds queries, executes them, and returns answers as text, tables, or charts — with full transparency into how the answer was produced.

This follows the same pattern used by leading data teams internally at companies like OpenAI and Vercel: a semantic layer describes the data model in plain language, and an AI agent explores it dynamically to answer questions. The difference is that CareMap is purpose-built for clinical data, with domain-specific understanding of care assessments, lab values, diagnoses, and operational metrics.

Crucially, every answer includes its provenance: which tables were queried, what joins were used, and where the original data came from. This is not a black box.

### The Living Dashboard

Any chart or table generated through the chat can be pinned to a persistent dashboard. Over time, the dashboard assembles itself from the questions users care about most, supplemented by built-in quality monitoring widgets that are always present.

The result is a dashboard that reflects real analytical needs rather than a static set of pre-built reports.

---

## How It Works

CareMap is designed around a single, intuitive workflow that takes a user from raw data to actionable insight.

### Step 1: Add Your Data Sources

Drag a source node onto the canvas and upload your file. CareMap accepts structured data (CSV, Excel), documents (PDF), and free-text (clinical notes). Each format is handled appropriately: spreadsheets are parsed into rows and columns, PDFs have their content extracted intelligently, and free text is analysed for clinical entities like patient identifiers, assessment scores, and dates.

Within seconds of uploading, the node displays what the system found: a table of detected columns with their inferred types, likely clinical meaning, confidence levels, and sample values. If the system misidentifies something, you can correct it directly in the panel.

### Step 2: Map to the Unified Model

Connect your source to a mapping node. CareMap proposes how each field in your source should correspond to the canonical clinical data model, covering patients, encounters, diagnoses, lab results, vital signs, medications, care assessments, interventions, sensor data, and staffing.

Each suggestion comes with a confidence score. Highly confident mappings are accepted by default and marked as such. Fields where the system is less certain are highlighted for your attention. You can accept, reject, or edit any mapping, and search through standard clinical terminologies to find the correct match.

Once you confirm the mappings, data is transformed and loaded into the harmonized store. The pipeline is saved and can be re-run whenever the source data is updated.

### Step 3: Ask Questions

Open the chat panel and ask questions in plain language. For example:

- "What is the average fall risk score by ward for the last 30 days?"
- "Which data sources have the most missing fields?"
- "Show me patients with declining mobility scores."
- "Compare lab result completeness across our three facilities."

The system responds with a combination of narrative explanation, data visualisations, and a transparent view of the query it ran. If the answer generates a chart worth keeping, pin it to the dashboard.

### Step 4: Monitor Quality

The dashboard provides ongoing visibility into data health. Built-in widgets show completeness rates per field and ward, timeliness of data ingestion, and anomalies that need attention. An alert feed surfaces issues as they arise: new unmapped fields appearing in a source, lab values outside expected ranges, or sudden drops in data completeness.

Each alert links back to the affected records and the relevant point in the pipeline, making investigation fast and traceable.

### Step 5: Correct and Improve

When something is wrong — whether a mapping error, a data quality issue, or an unexpected format change — CareMap provides a direct path to resolution. Open the affected node, see what went wrong, make the correction, and re-run the pipeline. Corrections are versioned and auditable.

Over time, the system learns from these corrections, improving its suggestions for future data sources and reducing the need for manual intervention.

---

## Key Capabilities

| Capability | Description |
|---|---|
| **Multi-Format Ingestion** | Accepts CSV, Excel, PDF, and free-text files. Each format is parsed and profiled automatically upon upload. |
| **AI-Powered Schema Inference** | On every file upload, the system infers column types, detects clinical domains, suggests semantic labels, and identifies quality issues. |
| **Intelligent Mapping** | Proposes field-level mappings to a canonical clinical data model with confidence scores and plain-language reasoning. |
| **Conversational Analytics** | A natural-language query interface that builds and executes queries against the harmonized data, returning charts, tables, and explanations with full provenance. |
| **Composable Dashboard** | Pin any chat-generated visualisation to a persistent dashboard. Built-in quality widgets provide always-on monitoring. |
| **Full Data Lineage** | Trace any harmonized field back to its original source file, column, and transformation. |
| **Anomaly Detection & Alerts** | Automatic detection of out-of-range values, missing data spikes, format inconsistencies, and mapping conflicts. |
| **On-Premise Ready** | Designed to run entirely within a hospital's network. The AI model can be swapped between cloud and self-hosted options. |

---

## Clinical Data Domains Covered

| Domain | What It Includes |
|---|---|
| Care Assessments | Mobility, fall risk, nutrition, pain, and pressure ulcer scores with their associated scales and assessment dates. |
| Care Interventions | Planned and executed care actions, including type, duration, and current status. |
| Diagnoses | Medical diagnoses coded in ICD-10, with descriptions and dates. |
| Lab Results | Laboratory parameters with values, units, reference ranges, and measurement timestamps. |
| Vital Signs | Heart rate, blood pressure, temperature, oxygen saturation, and other bedside measurements. |
| Medications | Prescribed drugs with dosages, frequencies, and active periods. |
| Sensor Data | Continuous readings from monitoring devices and IoT sensors. |
| Staff Scheduling | Shift plans, ward assignments, and role information for workforce analytics. |

---

## Data Security and On-Premise Deployment

Healthcare data is among the most sensitive information that exists. CareMap is designed with a clear principle: no patient data needs to leave the institution's network.

The platform's AI capabilities are powered by interchangeable language models. During development and demonstration, cloud-hosted models provide the fastest path to results. For production deployment in a hospital environment, the same system can be pointed at a locally hosted model running on the institution's own servers.

The settings interface includes a model configuration panel where administrators can select between pre-configured cloud models and a custom endpoint, entering the address of their own local model server. The application behaviour remains identical regardless of which model is used.

All data processing, storage, and querying happens within the deployment environment. Telemetry is disabled by default. The platform is designed to be compatible with GDPR requirements and DACH-region healthcare data handling expectations.

---

## Value Proposition

### Immediate Value

- Dramatically reduce the manual effort required to harmonize data from heterogeneous clinical systems.
- Provide data teams with a visual, auditable tool for building and managing data pipelines.
- Democratise data access: clinicians, analysts, and managers can query harmonized data in natural language.
- Surface data quality issues proactively rather than discovering them during reporting.

### Strategic Value

- Create the unified data foundation required for predictive analytics, risk stratification, and digital twin capabilities across the entire institutional network.
- Accelerate internal product development by providing a consistent, high-quality dataset for model training and feature engineering.
- Improve comparability across institutions: standardised data enables benchmarking, best practice identification, and network-wide insights.

### For Patients

Better data leads to better care. When fall risk scores, lab trends, and medication interactions are visible in a single unified view, clinicians can intervene earlier. When quality issues are caught automatically, care gaps close faster.

---

## What Makes CareMap Different

**It starts with the visual flow.** Most data platforms hide the pipeline behind code or configuration files. CareMap makes the data flow visible and manipulable.

**AI meets human judgement.** Every AI suggestion comes with a confidence score and an explanation. The human always has the final word on clinically sensitive decisions.

**The dashboard builds itself.** Rather than requiring upfront dashboard design, CareMap lets the dashboard emerge from actual use through pinned chat visualisations.

**Explainability is not an afterthought.** Every query result shows its provenance. Every mapped field can be traced back to its source. In a domain where trust in data is essential, transparency is built into every interaction.

---

## Looking Ahead

Beyond the initial implementation, natural extensions include:

- Live system connectors for real-time data ingestion from hospital information systems, lab interfaces, and sensor feeds.
- Cross-institutional analytics that leverage the standardised data model to enable benchmarking and best-practice sharing.
- Predictive models for fall risk, readmission probability, and resource demand, trained on the harmonized dataset.
- A self-improving mapping engine that learns from corrections across all institutions.
- Integration with epaSOLUTIONS' existing product ecosystem, embedding harmonized data capabilities directly into the tools care teams already use.
