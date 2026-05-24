# Product Intelligence Dashboard (Quantacus PRO)

An end-to-end, production-grade Product Intelligence Dashboard built for e-commerce sellers on Flipkart. It automatically ingests and parses product attributes from video frames or fallback CSV feeds, audits listing quality against Flipkart indexing standards (calculating a 0-100 Quality Score), suggests AI-enhanced SEO titles, visualizes competitor pricing movements across major platform nodes, and delivers real-time notifications for critical alert signals.

---

## 1. Project Overview

Flipkart sellers frequently battle dirty catalog data, weak title copy, out-of-stock search ranking penalties, and aggressive competitor repricing across platforms like Amazon, Myntra, and Ajio. Today, sellers coordinate three separate tools (media storage, repricers, and catalog checklists) to manage a single SKU. 

**Quantacus PRO** bridges this operational gap by compiling media, repricing logs, audits, and Slack/Telegram webhook notifications into a singular, dynamic console.

---

## 2. Architecture Diagram

```mermaid
graph TD
    User([Flipkart Seller]) -->|Upload Video / Preset| UI[Next.js App Router UI]
    User -->|Upload Feed CSV| UI
    
    UI -->|Async POST| VideoAPI[/api/upload-video/]
    UI -->|POST| CsvAPI[/api/upload-csv/]
    
    VideoAPI -->|Create Pending Run| DB[(PostgreSQL Database)]
    VideoAPI -->|Schedule Background Task| Simulator[Ingestion Simulation Engine]
    
    Simulator -->|Step 1: 25%| Log1[Extract Video Keyframes via FFmpeg]
    Simulator -->|Step 2: 50%| Log2[OCR Text Recognition via Vision API]
    Simulator -->|Step 3: 75%| Log3[Extract Structured Attributes via Gemini AI]
    Simulator -->|Step 4: 100%| Cache[Cache JSON Draft inside Job.metadata]
    
    Log1 & Log2 & Log3 & Cache -->|Write Logs| DB
    
    UI -->|SWR Poll 1000ms| JobAPI[/api/jobs/jobId/]
    JobAPI <--> DB
    
    UI -->|Completed & Redirect| ReviewPage[/review/jobId/]
    ReviewPage -->|Edit Draft & Publish| PublishAPI[/api/review/publish/]
    
    PublishAPI -->|Run Auditing| Validator[Listing Validation Engine]
    Validator -->|Deduct Penalties| Score[Quality Score 0-100]
    Validator -->|Create Issues| IssuesTable[ProductIssues Table]
    
    PublishAPI -->|Seed Platform Matches| Repricer[Competitor Pricing Engine]
    Repricer --> DB
    
    PublishAPI -->|Audit Price Gaps| AlertEngine[Alert & Notification Center]
    AlertEngine -->|Raise Alert if Gap > 10%| DB
    AlertEngine -.->|Outgoing Payloads| WebhooksPage[/webhooks/ Log Viewer]
```

---

## 3. Tech Stack

| Layer | Technology | Purpose |
| --- | --- | --- |
| **Frontend** | **Next.js 16 (App Router)** | Client interfaces, route structures, and SSR rendering. |
| **Language** | **TypeScript** | Strict compile-time safety and route config enforcement. |
| **Styling** | **Tailwind CSS v4** | frosted glass elements (glassmorphism), grids, HSL badges. |
| **Charts** | **Recharts** | Interactive SVG Area/Line charts for historical pricing trends. |
| **ORM** | **Prisma ORM (v5.21.1)** | Database schemas, type-safe queries, migration and seed script. |
| **Database** | **PostgreSQL (Local)** | Relational storage hosting schemas, histories, and logs. |
| **State & Poll**| **SWR** | Real-time data caching, fetching, and 1000ms state updates. |
| **Icons** | **Lucide React** | Sleek vectors for metrics and status Pills. |

---

## 4. Database Design

Optimized relational schema structured inside `prisma/schema.prisma`:

*   **`Product`**: Primary portfolio listing SKU (Title, category, color, mrp, Flipkart price, and overall numerical Quality Score).
*   **`ProductIssue`**: registered quality fails (HIGH, MEDIUM, LOW severity) linked to Flipkart audit checklist rules.
*   **`CompetitorPrice`**: Platform comparison node (Amazon, Myntra, Ajio, Nykaa, Tata Cliq, Meesho) for dynamic comparison.
*   **`CompetitorPriceHistory`**: Compiles platform price fluctuations to build Recharts timeline trends.
*   **`TitleEnhancement`**: AI optimization cache storing SEO titles, target keywords, and rationale.
*   **`Alert`**: Active notification alarms for pricing gaps or listing audit rejections.
*   **`ProcessingJob`**: Async pipeline worker (PENDING, RUNNING, COMPLETED, FAILED, PARTIALLY_COMPLETED). Stores extraction draft JSON.
*   **`JobLog`**: Detailed chronological pipeline steps for worker terminals.

---

## 5. Background Job Flow

1.  **Job Initialization**: Uploading a video clip pushes a `VIDEO_EXTRACTION` job into PostgreSQL as `PENDING`.
2.  **Async Hand-off**: The route launches `runVideoJobSimulation(jobId, fileName)` asynchronously, returning `{ success: true, jobId }` in `10ms` to avoid browser timeout.
3.  **Step-by-step Log Telemetry**: The background worker updates progress (`5% -> 25% -> 50% -> 75% -> 100%`) and writes chronological logs directly to `JobLog`.
4.  **SWR Client Polling**: The client polls `/api/jobs/${jobId}` at `1000ms` intervals. As logs are written, the user watches frame extraction progress.
5.  **Draft Review Staging**: Upon `COMPLETED`, the SWR poller detects the status and routes the seller directly to `/review/[jobId]`.

---

## 6. OCR + AI Pipeline

*   **FFmpeg Frame Capture**: Background simulation isolates frames from the uploaded video (e.g. `nike_air_max_blue.mp4`).
*   **Google Vision OCR**: Analyzes text bounding boxes on labels (brand logos, SKU codes like NIKE882).
*   **Gemini AI Parsing**: Structures unstructured text blocks into parsed JSON containing color, size, and category fields.
*   **Draft Review Cache**: Saves structured specifications within the `metadata` JSON field inside `ProcessingJob`.
*   **Manual Override**: Staging the draft inside `metadata` prevents dirty data from polluting primary catalog tables. Sellers review, refine prices, and publish live.

---

## 7. Validation Engine

Quality Score calculations are governed by strict penalty deductions starting from **100**:

$$\text{Quality Score} = \text{Clamp}(100 - \sum \text{Penalties}, 0, 100)$$

### Penalty Deductions Checklist:

| Violation Rule | Severity | Penalty Points | Actionable Suggested Fix |
| --- | --- | --- | --- |
| **Missing Title** | HIGH | **-40** | Add a clear, keyword-rich product title immediately. |
| **Very Short Title** (< 15 chars) | MEDIUM | **-15** | Incorporate brand, category, and sizing into the title. |
| **Missing Brand Name** | MEDIUM | **-10** | Add brand if known, or mark explicitly as unbranded. |
| **Invalid Price** (<= 0 or non-numeric)| HIGH | **-30** | Set a positive numeric value for the Flipkart selling price. |
| **MRP Lower than Price** | HIGH | **-30** | Correct the MRP or reduce the Flipkart selling price. |
| **Missing Image URL** | HIGH | **-25** | Upload a high-resolution image showing the item. |
| **Malformed Image URL** | MEDIUM | **-10** | Provide a valid absolute link (starts with http/https). |
| **Weak Description** (< 50 chars) | LOW | **-10** | Expand detailed specifications (care instructions, materials). |
| **Missing Attributes** (color, size, material, gender) | MEDIUM | **-15** | Provide details for search Discoverability filters. |
| **Product Out of Stock** | LOW | **-5** | Update inventory levels to toggle status to in-stock. |

---

## 8. Competitor Pricing Logic

Comparing Flipkart selling price ($P_{\text{Flipkart}}$) against lowest platform competitor price ($P_{\text{LowestCompetitor}}$):

$$\text{Price Gap} = P_{\text{Flipkart}} - P_{\text{LowestCompetitor}}$$

$$\text{Price Gap \%} = \left(\frac{P_{\text{Flipkart}} - P_{\text{LowestCompetitor}}}{P_{\text{LowestCompetitor}}}\right) \times 100$$

### Actionable Recommendation Rules:

*   **`COMPETITIVE PRICING`** ($P_{\text{Flipkart}} \le P_{\text{LowestCompetitor}}$): "Flipkart listing price is competitive!"
*   **`SLIGHTLY OVERPRICED`** ($0 < \text{Gap \%} \le 10\%$): "Price is slightly uncompetitive (< 10% gap). Consider matching lowest competitor."
*   **`URGENT PRICE CORRECTION NEEDED`** ($\text{Gap \%} > 10\%$): "Flipkart listing is overpriced by > 10%. Flipkart algorithm will decrease discoverability."

---

## 9. Alerting System

Alarms are generated dynamically in the PostgreSQL `Alert` table based on structural catalog updates:

*   **`HIGH` Severity (`LISTING_VALIDATION_ERROR`)**: Raised when a published product score falls below 60%.
*   **`HIGH` Severity (`PRICE_GAP_EXCEEDED`)**: Raised when our Flipkart price is $> 10\%$ higher than the lowest competitor.
*   **`MEDIUM` Severity (`COMPETITOR_PRICE_DROP`)**: Raised when a platform competitor slashes pricing by $> 15\%$ during a pricing check.
*   **`LOW` Severity**: Triggered by out-of-stock listings or weak descriptions.

---

## 10. Local Setup

Follow these steps to deploy and run the app locally:

1.  **Clone the Repository** and navigate to the directory:
    ```bash
    cd Quantacus
    ```
2.  **Install Node.js Dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    Create a `.env` file in the root directory (refer to Section 11).
4.  **Database Migration & Schema Sync**:
    Ensure local PostgreSQL is running and port 5432 is open. Synced tables instantly using:
    ```bash
    npx prisma db push
    ```
5.  **Seed Developer Portfolio Data**:
    ```bash
    npx prisma db seed
    ```
6.  **Run Development Server**:
    ```bash
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 11. Environment Variables

Create a `.env` file in your root workspace:

```env
# Relational Database Connection (Default local pgsql credentials)
DATABASE_URL="postgresql://postgres@localhost:5432/quantacus_db?schema=public"

# Next.js Environment
NODE_ENV="development"
```

---

## 12. Deployment Links

*   **Frontend Client**: [https://quantacus-intelligence.vercel.app](https://quantacus-intelligence.vercel.app) *(Simulated Vercel URL placeholder)*
*   **Backend REST APIs**: [https://quantacus-intelligence.vercel.app/api/products](https://quantacus-intelligence.vercel.app/api/products) *(Simulated API URL placeholder)*

---

## 13. Mock vs. Real Features

To guarantee **100% offline robustness** and prevent brittle reviewer configurations (e.g. broken cloud tokens), high-latency third-party pipelines are managed via a simulated backend worker:

| Feature Area | Production Integration | Staging Simulation (Dev Mode) | Status |
| --- | --- | --- | --- |
| **Video Storage** | Cloudinary / UploadThing API | Mock File metadata saved locally | **Simulated** |
| **Frame Extraction** | FFmpeg CLI worker | PROGRESS Logs written sequentially to DB | **Simulated** |
| **Label OCR** | Google Vision API | Mock Brand/SKU label detection matched | **Simulated** |
| **Attributes Extract** | Google Gemini API | Template matching based on uploaded name | **Simulated** |
| **repricing Reprice** | Scraping platform targets | "Refresh Prices" updates prices by random -20% to +10% | **Simulated** |
| **DB Persistence** | PostgreSQL / Prisma | Full SQL read/writes to local PostgreSQL | **100% Real** |
| **State Polling** | SWR / fetch | Polling `/api/jobs` at 1000ms intervals | **100% Real** |
| **Data Visualization**| Recharts SVG | Compiles competitor lists into interactive graphs | **100% Real** |
| **Title Enhancer** | Attribute + SEO Keywords | Dynamic merging algorithm, lets user overwrite titles | **100% Real** |
| **Listing Validator** | Penalty checklist subtraction | Math formula registering errors | **100% Real** |

---

## 14. Tradeoffs & Future Improvements

### Major Architectural Tradeoffs Made:
1.  **SWR Polling chosen over WebSockets**: WebSockets add significant network overhead and complex state management on serverless functions like Vercel. SWR `refreshInterval: 1000ms` provides a lightweight, serverless-friendly polling mechanism that mimics instant updates reliably.
2.  **Staging metadata review chosen over Auto-Creation**: Creating product listings directly from high-uncertainty OCR extractions introduces dirty catalog data. We introduce a staging area (`ProcessingJob.metadata`), giving the seller an editable preview dashboard before publishing.
3.  **Prisma v5 Locked over v7**: Prisma v7 introduced dynamic WASM config constraints. Locking Prisma `v5.21.1` guarantees frictionless database sync and avoids WASM compilation constraints.
4.  **Bespoke inline CSV parser over external packages**: We wrote a lightweight split-based CSV parser to reduce npm package size and eliminate third-party package vulnerabilities during compilation.

### Future Improvements:
*   Integrate actual Upstash Redis queues (`BullMQ`) for horizontal background task scaling.
*   Enable OAuth2 secure user session logs.
*   Add canvas-based PDF downloadable quality reports for warehouse audits.

---

## 15. Screenshots

![Executive Dashboard](https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=800)
*Executive dashboard visualizing average Quality Scores, severe validation checklists, and pricing alerts.*

---

## 16. Demo Video

Sellers can preview a 2-minute walkthrough detailing:
1.  Ingesting a video clip using preset quick-loaders.
2.  Watching SWR poll live logs during background OCR extraction.
3.  Editing and publishing the draft specifications.
4.  Auditing the uncompetitive price gap charts and applying title overwrites.
# Assignment-Quant
