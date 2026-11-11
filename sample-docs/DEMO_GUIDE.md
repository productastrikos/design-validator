# Design Validator demo guide

A step-by-step script for demonstrating Design Validator with the sample documents in this
folder. Each step says what to click, what to type, and what the audience should see.

The sample documents describe one invented project: an offshore supply vessel, OSV-45, Hull 101.
Every file is fictitious and marked as a sample, so all of them are safe to show. `README.md` in
this folder is the full answer key.

AI wording changes from run to run. Treat the "You should see" lists as a checklist, not exact text.

## Before the demo

1. **Open the app.** Use `https://designvalidator.astrikos.xyz:8443`, or `http://localhost:3309`
   for a local run.
2. **Sign in.** The username is `admin`. The password is the `ADMIN_PASSWORD` value in
   `server/.env`; ask the person who deployed the app if you don't have it.
3. **Check the AI connection.** Open **Settings & AI Config** and click **Test Connection**. It should
   say *Inference engine online*. If it doesn't, stop and fix the API key first (see `DEPLOY.md`
   section 5).
4. **Upload the samples.** Open **Document Intel**, drag all 23 files from this folder onto the upload
   area at once, and wait until each one shows a detected type. Files 10 and 11 are scans, so they take
   longer because they are read with the vision model.
5. **Seed the lessons.** Run step 8 of the walkthrough once before the audience arrives. **Lessons
   Learnt** starts empty, and that step fills it.
6. **Choose a theme.** The sun/moon button at the top right switches between dark and light. Dark
   usually reads better on a projector.

Uploaded documents stay in your browser session. Signing out clears them, so upload again after
signing back in. Tick **Save to shared repository** during upload to keep them for everyone.

Plan on about 40 minutes for the full walkthrough. For a short slot, use the 10-minute route at the
end.

## Things to show on any page

- **Download.** Every result table has a **Download** button. It opens the *Document studio*: a
  branded A4 preview where you can click any heading, figure or cell to edit it, hide or reorder
  sections, and add notes. Then download as PDF, Excel, CSV, PNG, Word or ODS.
- **Copy for Excel.** Copies a table so it pastes straight into Excel cells.
- **Rate this output.** Every AI result has *Satisfied / Partially satisfied / Not satisfied*
  buttons. The feedback is stored and guides later results in that module.
- **Ask the assistant.** Most modules end with a chat panel that already knows the selected document.
- **Find a page.** Press **Ctrl+K** and type, for example, `cost` or `drawing`.

## The walkthrough

### 1. Document Intelligence: compliance scan (4 min)

**Story:** "We drop in a build specification and it is checked against SOLAS, MARPOL and the class
rules in one pass."

1. Open **Document Intel**. Point out that every uploaded file has been classified automatically, for
   example *Build Specification*, *SOTR*, *Technical Offer* and *Drawing*.
2. Open the **Rule Validator** tab, select **01 Build_Specification_OSV-45**, and click
   **Run Validation Scan**.

**You should see** these defects, each with the rule it breaks:

| Clause | Defect |
| --- | --- |
| 4.4 | Collision bulkhead at about 3.6% of length; SOLAS II-1/12 requires at least 5% |
| 6.3 | Overboard discharge at 100 ppm oil; MARPOL Annex I allows 15 ppm |
| 7.2 / 7.9 | Three generators in one clause, two in another |
| 7.4 | Emergency supply within 120 s; SOLAS II-1/43 requires 45 s |
| 7.6 / 8.4 | IP56 in one clause, IP44 for the same kind of equipment in another |
| 7.6 / 11.3 | The same sentence repeated |
| 7.7 | PVC cable where flame retardance is "not required" |
| 10.2 | Machinery space with portable extinguishers only; SOLAS II-2/10 needs a fixed system |

### 2. Rules & Regulations assistant (5 min)

**Story:** "Engineers ask the rule books in plain English and get cited answers."

1. Open **Rules & Regulations**. Leave **Domain focus** on *All domains*.
2. Ask these questions one at a time:
   - *What is the required position of the collision bulkhead?*
   - *How quickly must the emergency generator supply the emergency switchboard on a cargo ship?*
   - *What are the requirements for a fixed fire-extinguishing system in a machinery space of category A?*
   - *How many lifeboats or liferafts does a cargo ship need?*
3. Under **Reference document**, select **01 Build_Specification_OSV-45**, then ask:
   - *Does clause 7.4 comply with SOLAS?* The answer should be **no**: 120 s against the 45 s limit.
   - *List every non-compliance in this specification as a table.* Then click **Copy for Excel**.
4. Select **16 Cable_Schedule** and ask *Which cables in this schedule are not flame-retardant?*

**You should see** answers that cite SOLAS, LSA Code or class rule references, and suggested follow-up
questions after each answer.

### 3. Technical offer evaluation (5 min)

**Story:** "Two vendors bid on the navigation radar. Which one actually meets the SOTR?"

1. Open **Technical Offer Eval.**
2. Set **Tender Technical Specification** to **02 SOTR_Navigation_Radar_ECDIS**.
3. Under **Vendor Technical Offer(s)**, select **03 Acme** and **04 Globex**.
4. Optionally enter *Radar / ECDIS* as the system, then click **Evaluate 2 Offers**.

**You should see:**
- **Acme** with many gaps: a 12 kW radar where 25 kW is required, a 19-inch display, a non-redundant
  LAN, a 15-minute UPS, certificates "under process", a 12-month warranty and a 10–12 month delivery.
- **Globex** largely compliant, with two deviations: IP55 antenna units where IP56 is required, and no
  on-board training.
- A vendor-wise comparison and a recommendation.

**Extra:** Run it again with **05 Compliance_Statement_Acme** added as a third offer. It claims
"Complied" on clauses 2.1, 3.1, 3.2, 3.5, 4.3, 5.3 and 6.1, which Acme's own offer contradicts.

**Ask the assistant:** *Which offer best meets the redundancy requirement?*, *Summarise the key
deviations across the offers.*

### 4. Binding data gap analysis (4 min)

**Story:** "The vendor sent their binding data. What is missing before we can approve it?"

1. Open **Binding Data Gap Analysis**.
2. Set **POTS** to **06 POTS_Public_Address_System** and **Vendor Binding Data** to
   **07 Binding_Data_Public_Address_System**.
3. Click **Run Gap Analysis**.

**You should see:**
- **Missing:** the sound pressure level calculation, the factory acceptance test procedure, the harbour
  and sea trial procedure, the interconnection diagram, the EMC and vibration test reports, the centre
  of gravity, and the battery unit weight.
- **Inadequate:** a type-approval certificate that expired on 30.06.2024, an MTBF that covers the
  amplifier rack only, a cable schedule without gland details, and one year of spares instead of two.
- **Deviations:** manual changeover instead of automatic, a 20-minute battery instead of 30, IP54 glands
  instead of IP56, and a 12-month warranty instead of 24.

**Ask the assistant:** *List the documents to seek before approval.*

### 5. Pre-bid queries (3 min)

**Story:** "Before we bid on a switchboard RFP, what must we clarify?"

1. Open **Pre-Bid Queries**, select **08 RFP_Main_Switchboard**, and click
   **Generate Pre-Bid Queries**.

**You should see** queries on bid validity (90 days on the cover, 120 in clause 1.2), delivery "as early
as possible", the unstated short-circuit rating, IP22 against IP44, "reputed make", feeder breakers to
"vendor standard", the undefined PMS interface, class witness charges, "standard documents" and
"standard spares", warranty, the missing liquidated-damages rate, and payment terms.

### 6. Drawing intelligence (5 min)

**Story:** "It reads CAD drawings directly, not just PDFs."

1. Open **Drawing Intelligence**.
2. **Extract:** select **14 GA_Plan_Main_Deck** and click **Extract to Table**. You should see 14
   compartments with their areas, such as *Galley 18.0 m²* and *Mess Room 28.0 m²*. The hull outline
   is listed separately as *(outline)*, 391.5 m².
3. **Compare:** click **Compare**, choose **12 SLD_Power_Distribution_RevA** as the drawing and
   **13 SLD_Power_Distribution_RevB** as the second drawing, then click **Compare Drawings**. You
   should see the emergency generator changed from 60 to 75 kW, the transformers from 100 to 125 kVA,
   and the bow thruster breaker from 500 to 630 A. There is also a new 55 kW deck crane feeder and a
   new drawing note.
4. **Validate:** click **Validate**, select **13** as the drawing and **01 Build Specification** as the
   build specification, then click **Validate Drawing**. Rev B should be flagged as inconsistent with
   the specification, which still says 60 kW and 100 kVA.

**Ask the assistant:** *List the major equipment on this drawing.*

### 7. Document comparison (3 min)

1. Open **Document Comparison** and select **19 Electrical_Spec_RevA** and **20 Electrical_Spec_RevB**.
2. Enter the prompt *Compare the two revisions and list every technical change.*
3. Click **Compare 2 Documents**.

**You should see** these changes: emergency generator 60 → 75 kW, supply time 120 → 45 s, transformer
100 → 125 kVA, breakers fixed → withdrawable, PVC allowed → flame-retardant zero-halogen only, open
deck IP55 → IP56, and a new section 6 on the deck crane supply.

**Second example:** compare **21** with **22** (Design Standard DS-100 v1 and v2). Segregation changes
from 100 to 150 mm and support spacing from 400 to 300 mm. There is a new requirement for at least 20%
spare transit capacity, and a new section 5 on open-deck glands.

### 8. Inspection reports and lessons learnt (5 min)

**Story:** "Trial reports become a searchable register, an analytics dashboard and organisational
memory."

1. Open **Inspection Report Analytics**. On the **Analyse Report** tab, select
   **09 Inspection_Report_Harbour_Trials**, enter *Hull 101* as the project, keep the option that saves
   findings to Lessons Learnt switched on, and click **Analyse Report**.
2. **You should see** 22 observations: 5 SAT and 17 UNSAT, across the emergency generator, steering
   gear, main switchboard and public address system.
3. Open the **Analytics Dashboard** tab, filter by *Hull 101*, and click **Apply / Refresh**. Show the
   equipment, category and status charts, then the download icon on that panel.
4. Open **Status Tracking**, click **Update status** on one remark, and close it with a short remark.
5. Open **Query Data** and ask *How many UNSAT remarks were raised on the emergency generator?*
6. **OCR:** analyse **10 Inspection_Remarks_Scanned**, which should give 12 remarks (3 SAT, 9 UNSAT).
   Then analyse **11 Inspection_Remarks_Photo**, which should give 8 remarks (2 SAT, 6 UNSAT).
7. Open **Lessons Learnt**. The repository now holds these observations. On **Proactive Assistant**,
   enter *Public address system* as the system and click **Get Lessons & Recommendations**.

### 9. Design review assistant (2 min)

1. Open **Design Review Assistant**. Enter *Main switchboard* as the system and *Electrical* as the
   domain. Optionally select **01 Build Specification** as the design document.
2. Click **Generate Design Review**.

**You should see** a system checklist, a risk analysis, and recurring defects taken from the lessons
captured in step 8.

### 10. BOM, SOTR and load analysis (4 min)

1. Open **BOM & SOTR**. On the Bill of Materials tab, select **01 Build Specification** as a source,
   attach **17 Electrical_Load_Analysis** as the ELA workbook, and click **Generate BOM**.
2. **You should see** a load summary card computed without AI, so these figures are exact:

   | On the card | Expected value |
   | --- | --- |
   | Main-bus worst case | 620.7 kVA |
   | Worst-case mode | MANOEUVRING |
   | Emergency-bus worst case | 65.2 kVA |
   | Margin / Power factor | 10% / 0.8 |

   Generator and transformer rows are added to the BOM. Click **Save** on the BOM, because Ship Cost
   Estimation uses it.
3. On the SOTR tab, select **01** and click **Generate SOTR**. The SOTR follows chapter and clause
   format and names *Example Shipbuilders Ltd.* as the ship builder. Download it as Word or PDF.

### 11. Ship cost estimation (3 min)

1. Open **Ship Cost Estimation**, select **01 Build Specification**, enter *OSV 45 / Hull 101* as the
   project, and click **Generate BOM & Estimate Cost**.
2. In **4 · Refine with Budgetary Quotations**, upload **18 Budgetary_Quotations**, then click
   **Apply BQs & Update Estimate**.
3. **You should see** the vendor-wise comparison pick these lowest quotes:

   | Item | Lowest vendor | Unit rate (INR) |
   | --- | --- | --- |
   | Diesel generator set | Acme Power Systems | 4,150,000 |
   | Emergency generator set | Globex Power Systems | 1,380,000 |
   | Main switchboard with PMS | Acme Switchgear | 6,800,000 |
   | Navigation radar and ECDIS | Acme Marine Electronics | 5,950,000 |
   | Bilge pump | Acme Marine Pumps | 325,000 |

4. Show the auto-drafted vendor enquiry letters in **6 · Vendor-wise BQ Enquiries**.

### 12. Document converter (2 min)

1. Open **Document Converter** → **Extract to table**. Select **07 Binding Data** and enter
   *Extract the equipment register with make, model, quantity and weight.* Click **Extract to Table**.
   The battery unit's weight should show as "Not stated".
2. Open **Convert file format**, add **10 Inspection_Remarks_Scanned**, and convert it to Word. This
   shows OCR producing an editable document.

### 13. Governance (2 min)

1. Open **Role-Based Access Control** to show the admin and design-engineer roles and their
   department-based access.
2. Open **Audit Log** to show every sign-in, upload, analysis and download recorded in this demo,
   including the files downloaded from the Document studio.
3. Open **Interaction History** to show that earlier questions and answers can be revisited and reused.

### 14. Dashboard (2 min, a good closer)

1. Open **Dashboard**. Under **Documents to analyse**, select **03**, **04** and **05**.
2. Enter *Compare compliance across the selected offers, equipment-wise, with counts of complied and
   non-complied clauses.* Click **Generate Analytics**.
3. Show the figures and charts, then the download icon, which turns them into a branded report.

## 10-minute route

1. Document Intel → Rule Validator on **01** (step 1).
2. Rules & Regulations: *Does clause 7.4 comply with SOLAS?* with **01** selected (step 2).
3. Technical Offer Eval. with **02**, **03** and **04** (step 3).
4. Drawing Intelligence → Compare **12** with **13** (step 6).
5. Download any result table and show the Document studio.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| "Inference engine is not configured" or "rejected the API key" | The server's API key is missing or wrong. See `DEPLOY.md` section 5. |
| "HTTP 429" | The AI provider's rate limit. Wait a minute and run it again. |
| A document dropdown is empty | Documents were cleared when you signed out. Upload them again. |
| Lessons Learnt or Design Review shows nothing from history | Run step 8 first. |
| Results differ slightly from this guide | That is normal for AI output. Check against the lists above. |
