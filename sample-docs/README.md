# Sample documents

Fictitious documents for demonstrating and testing Design Validator. The vessel (OSV-45,
Hull 101), the yard, the owner, the vendors and all document numbers are invented, and every file
is marked as a sample. They are safe to show to anyone.

The documents describe one consistent project and contain **deliberate defects**, so each module
has something real to find. The "What it should find" lists below are the answer key. The AI's
wording will vary from run to run, so treat them as a checklist rather than exact output.

## Quick start

1. Sign in and open **Document Intelligence**.
2. Upload every file in this folder at once. Each file's type should be detected automatically,
   as shown in the table below.
3. Open a module below and pick the listed documents from its dropdown.

Files 10 and 11 are scans, so they need the vision model. Everything else has a text layer or is
structured data, and uploads quickly.

## All files

| # | File | Format | Detected type | Used in |
| --- | --- | --- | --- | --- |
| 01 | Build_Specification_OSV-45 | PDF | Build Specification | Document Intelligence, BOM & SOTR, Ship Cost, Drawing Intelligence |
| 02 | SOTR_Navigation_Radar_ECDIS | PDF | SOTR | Technical Offer Evaluation |
| 03 | Technical_Offer_Acme_Marine_Electronics | PDF | Technical Offer | Technical Offer Evaluation |
| 04 | Technical_Offer_Globex_Marine_Systems | PDF | Technical Offer | Technical Offer Evaluation |
| 05 | Compliance_Statement_Acme | Excel | Compliance Matrix | Technical Offer Evaluation |
| 06 | POTS_Public_Address_System | Word | POTS | Binding Data Gap Analysis |
| 07 | Binding_Data_Public_Address_System | PDF | Binding Data | Binding Data Gap Analysis, Document Converter |
| 08 | RFP_Main_Switchboard | PDF | RFP / Tender | Pre-Bid Queries |
| 09 | Inspection_Report_Harbour_Trials | PDF | Inspection Report | Inspection Reports Analytics, Lessons Learnt |
| 10 | Inspection_Remarks_Scanned | PDF, no text layer | Set by the AI | Inspection Reports Analytics, Document Converter |
| 11 | Inspection_Remarks_Photo | JPEG | Set by the AI | Inspection Reports Analytics |
| 12 | SLD_Power_Distribution_RevA | DXF | Drawing | Drawing Intelligence |
| 13 | SLD_Power_Distribution_RevB | DXF | Drawing | Drawing Intelligence (compare) |
| 14 | GA_Plan_Main_Deck | DXF | Drawing | Drawing Intelligence |
| 15 | SLD_Power_Distribution | PDF (vector) | Drawing | Drawing Intelligence |
| 16 | Cable_Schedule | CSV | Drawing | Document Intelligence, Rules & Regulations Assistant |
| 17 | Electrical_Load_Analysis | Excel | Set by the AI | BOM & SOTR Generator |
| 18 | Budgetary_Quotations | Excel | Technical Offer | Ship Cost Estimation |
| 19 | Electrical_Spec_RevA | Word | Set by the AI | Document Comparison |
| 20 | Electrical_Spec_RevB | Word | Set by the AI | Document Comparison |
| 21 | Design_Standard_DS-100_v1 | PDF | Set by the AI | Document Comparison |
| 22 | Design_Standard_DS-100_v2 | PDF | Set by the AI | Document Comparison |
| 23 | Surveyor_Notes | Text | Set by the AI | Document Intelligence, Lessons Learnt |

## Module by module

### Document Intelligence: compliance scan
Scan **01 Build Specification**. It should find:

| Clause | Defect | Against |
| --- | --- | --- |
| 4.4 | Collision bulkhead 1.50 m aft of the forward perpendicular, about 3.6% of length | SOLAS II-1/12: not less than 5% |
| 6.3 | Overboard discharge at up to 100 ppm oil content | MARPOL Annex I: 15 ppm |
| 7.2 and 7.9 | Three generators in one clause, two in another | Internal contradiction |
| 7.4 | Emergency supply within 120 seconds | SOLAS II-1/43: 45 seconds |
| 7.6 and 11.3 | The same sentence repeated | Repetition |
| 7.6 and 8.4 | IP56 for open decks, IP44 for bridge wing and mast equipment | Internal contradiction |
| 7.7 | PVC cable where flame-retardant properties are "not required" | IEC 60092 and class rules |
| 10.2 | Machinery space protected by portable extinguishers only | SOLAS II-2/10: fixed system needed |

### Rules & Regulations Assistant
Ask questions answered from the built-in rule books, for example:
- *What is the required position of the collision bulkhead?*
- *How quickly must the emergency generator supply the emergency switchboard on a cargo ship?*

With file 01 selected as context, ask *Does clause 7.4 comply with SOLAS?*

### Technical Offer Evaluation
Use **02 SOTR** as the specification and **03** and **04** as the offers.

- **03 Acme** should show major gaps: 12 kW X-band radar (25 kW required), 19-inch display at
  1600 x 1200, non-redundant LAN, 15-minute UPS, VDR and echo sounder interfaces extra, below-deck
  range 0 to +50 C, certificate "under process", MTBF not stated, 12-month warranty, one year of
  spares, HAT and SAT attendance charged, training for 4 persons at works, printed manuals only,
  10 to 12 month delivery, and shorter product support.
- **04 Globex** should be largely compliant, with two deviations: antenna units IP55 (IP56
  required) and no on-board training.

Add **05 Compliance Statement** as a further offer to test contradiction spotting. It replies
"Complied" to clauses 2.1, 3.1, 3.2, 3.5, 4.3, 5.3 and 6.1, which Acme's own offer contradicts.

### Binding Data Gap Analysis
Use **06 POTS** with **07 Binding Data**. It should find:

- **Missing:** sound pressure level calculation (BD-07), factory acceptance test procedure (BD-11),
  harbour and sea trial procedure (BD-12), interconnection diagram (BD-05), EMC and vibration test
  reports (BD-09), centre of gravity (BD-03), battery unit weight (BD-03).
- **Inadequate:** type-approval certificate expired 30.06.2024 (BD-08), MTBF covers the amplifier
  rack only (BD-10), cable schedule without gland details (BD-06), one year of spares instead of two
  (BD-13).
- **Technical deviations:** manual changeover instead of automatic (2.1), 20-minute battery instead
  of 30 (2.2), IP54 glands instead of IP56 (2.4), 12-month warranty instead of 24.

### Pre-Bid Queries
Use **08 RFP**. It should raise queries on: bid validity (90 days on the cover, 120 in clause 1.2),
"as early as possible" delivery, unstated short-circuit rating, IP22 versus IP44, "reputed make",
feeder breakers to "vendor standard", the undefined PMS interface, class witness charges, "standard
documents" and "standard spares", warranty terms, the unstated liquidated damages rate, and payment
terms.

### Inspection Reports Analytics and Lessons Learnt
Analyse **09 Inspection Report**. It should produce **22 observations: 5 SAT and 17 UNSAT**, across
systems including the emergency generator, steering gear, main switchboard and public address system.
With saving enabled, the observations also populate **Lessons Learnt**.

**10** and **11** test OCR on the same kind of content: a two-sheet scanned punch list with **12
remarks** (**3 SAT, 9 UNSAT**), and a photo of its first sheet with **8 remarks** (**2 SAT, 6 UNSAT**).

Lessons Learnt starts empty on a new installation, so analyse a report before demonstrating it.

### Drawing Intelligence
- **Extract from 14 GA Plan:** 14 compartments with computed areas, such as Galley 18.0 m2 and
  Mess Room 28.0 m2. The hull outline is listed separately as "(outline)" at 391.5 m2.
- **Extract from 12 or 15 SLD:** generators, switchboards, breakers and feeders.
- **Compare 12 with 13:** emergency generator 60 kW to 75 kW, transformers 100 kVA to 125 kVA, bow
  thruster breaker 500 A to 630 A, a new 55 kW deck crane feeder, and a new drawing note.
- **Validate 13** against the rules, optionally with **01 Build Specification** selected. The
  specification still says 60 kW and 100 kVA, so Rev B should show as inconsistent with it.

File 15 is a vector drawing with sparse text, so it also exercises the vision model.

### BOM & SOTR Generator
- **BOM and SOTR:** generate both from **01 Build Specification**. The SOTR should follow the
  chapter and clause format, and show *Example Shipbuilders Ltd.* as the ship builder.
- **Generator and transformer sizing:** on the Bill of Materials tab, select **01** as a source, add
  **17 Electrical Load Analysis** as the ELA workbook, and generate. The load summary card is
  computed without AI, so check these figures exactly:

| On the card | Expected value | How it is derived |
| --- | --- | --- |
| Main-bus worst case | 620.7 kVA | 451.45 kW x 1.10 margin / 0.8 power factor |
| Worst-case mode | MANOEUVRING | The highest total across the two main-bus sheets |
| Emergency-bus worst case | 65.2 kVA | 47.45 kW x 1.10 margin / 0.8 power factor |
| Margin / Power factor | 10% / 0.8 | Read from the workbook's Cover sheet |

The card should also show the workbook's note that three 312.5 kVA generators are planned, and a
caveat that the main-bus sheets span two voltage levels. Generator and transformer rows are then
added to the BOM, with transformers sized against the minimums of 39.2 kVA (415V ESB) and 25 kVA
(230V ESB).

### Ship Cost Estimation
Generate an estimate from **01 Build Specification**, then upload **18 Budgetary Quotations**. The
vendor comparison should show these lowest quotes:

| Item | Lowest vendor | Unit rate (INR) |
| --- | --- | --- |
| Diesel generator set | Acme Power Systems | 4,150,000 |
| Emergency generator set | Globex Power Systems | 1,380,000 |
| Main switchboard with PMS | Acme Switchgear | 6,800,000 |
| Navigation radar and ECDIS | Acme Marine Electronics | 5,950,000 |
| Bilge pump | Acme Marine Pumps | 325,000 |

### Document Comparison
Compare **19** with **20**. It should find: emergency generator rating (60 kW to 75 kW), supply time
(120 s to 45 s), transformer size (100 kVA to 125 kVA), breaker type (fixed to withdrawable), cable
requirement (PVC allowed to all flame-retardant and zero-halogen), open-deck protection (IP55 to
IP56), and a new section 6 on the deck crane supply.

Compare **21** with **22** for a second example: segregation 100 mm to 150 mm, support spacing 400
mm to 300 mm, at least 20% spare transit capacity, and a new section 5 on open-deck glands.

### Document Converter
Convert **07 Binding Data** to Excel: its equipment table should map to the equipment register, with
"Not stated" kept for the battery unit's weight. Convert **10** to Word to show OCR of a scan.

## Regenerating

The generators are in `scripts/sample-docs/`:

```
pip install reportlab python-docx ezdxf pillow
python scripts/sample-docs/generate_docs.py
node scripts/sample-docs/workbooks.js
```

Run `npm install` in `server/` first, as the workbook script uses its `exceljs` package.
