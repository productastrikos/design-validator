#!/usr/bin/env python3
"""
Generates the PDF, Word, DXF, image and text files in sample-docs/.
The Excel workbooks come from workbooks.js (they need cached formula results).

Everything here is fictitious: the vessel, the companies and the document numbers
exist only to exercise the application. Requires: reportlab python-docx ezdxf pillow

    python scripts/sample-docs/generate_docs.py
    node   scripts/sample-docs/workbooks.js
"""
import os
import random
from pathlib import Path

import ezdxf
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.shared import Cm, Pt, RGBColor
from PIL import Image, ImageDraw, ImageFilter, ImageFont
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A3, A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.platypus import (KeepTogether, PageBreak, Paragraph, SimpleDocTemplate,
                                Spacer, Table, TableStyle)

OUT = Path(__file__).resolve().parents[2] / "sample-docs"
OUT.mkdir(exist_ok=True)

YARD   = "Example Shipbuilders Ltd."
OWNER  = "Example Offshore Services"
VESSEL = "OSV-45 Multipurpose Offshore Support Vessel"
HULL   = "Hull 101"
NOTICE = "SAMPLE DOCUMENT - fictitious data for demonstration only"
NAVY   = colors.HexColor("#17324D")
GRID   = colors.HexColor("#9AA7B4")
SHADE  = colors.HexColor("#E8EDF2")

# ── PDF building blocks ──────────────────────────────────────────────────────
S = {
    "title":  ParagraphStyle("title", fontName="Helvetica-Bold", fontSize=18, leading=23, textColor=NAVY, alignment=TA_CENTER, spaceAfter=8),
    "sub":    ParagraphStyle("sub", fontName="Helvetica", fontSize=11, leading=15, textColor=NAVY, alignment=TA_CENTER, spaceAfter=4),
    "h1":     ParagraphStyle("h1", fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=NAVY, spaceBefore=12, spaceAfter=5, keepWithNext=1),
    "h2":     ParagraphStyle("h2", fontName="Helvetica-Bold", fontSize=10, leading=13, textColor=NAVY, spaceBefore=7, spaceAfter=3, keepWithNext=1),
    "body":   ParagraphStyle("body", fontName="Helvetica", fontSize=9.5, leading=13, spaceAfter=4),
    "clause": ParagraphStyle("clause", fontName="Helvetica", fontSize=9.5, leading=13, spaceAfter=4, leftIndent=30, bulletIndent=0),
    "cell":   ParagraphStyle("cell", fontName="Helvetica", fontSize=8.5, leading=10.5),
    "head":   ParagraphStyle("head", fontName="Helvetica-Bold", fontSize=8.5, leading=10.5, textColor=NAVY),
}


class _NumberedCanvas(rl_canvas.Canvas):
    """Second pass so the footer can print 'Page X of Y'."""
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        total = len(self._pages)
        for state in self._pages:
            self.__dict__.update(state)
            self.setFont("Helvetica", 7.5)
            self.setFillColor(colors.HexColor("#555555"))
            self.drawRightString(self._pagesize[0] - 18 * mm, 10 * mm, f"Page {self._pageNumber} of {total}")
            super().showPage()
        super().save()


def build_pdf(name, title, doc_no, rev, story, author=YARD):
    def decorate(c, doc):
        w, h = doc.pagesize
        c.saveState()
        c.setFont("Helvetica-Bold", 7.5)
        c.setFillColor(NAVY)
        c.drawString(18 * mm, h - 11 * mm, author)
        c.setFont("Helvetica", 7.5)
        c.drawRightString(w - 18 * mm, h - 11 * mm, f"{doc_no}  Rev. {rev}")
        c.setStrokeColor(GRID)
        c.line(18 * mm, h - 13 * mm, w - 18 * mm, h - 13 * mm)
        c.line(18 * mm, 14 * mm, w - 18 * mm, 14 * mm)
        c.setFillColor(colors.HexColor("#555555"))
        c.drawString(18 * mm, 10 * mm, NOTICE)
        c.restoreState()

    doc = SimpleDocTemplate(str(OUT / name), pagesize=A4, leftMargin=18 * mm, rightMargin=18 * mm,
                            topMargin=19 * mm, bottomMargin=19 * mm, title=title, author=author,
                            subject=NOTICE)
    doc.build(story, onFirstPage=decorate, onLaterPages=decorate, canvasmaker=_NumberedCanvas)
    print("  wrote", name)


def P(text, style="body"):
    return Paragraph(text, S[style])


def clauses(items):
    return [Paragraph(text, S["clause"], bulletText=no) for no, text in items]


def table(header, rows, widths):
    data = [[Paragraph(str(h), S["head"]) for h in header]]
    data += [[Paragraph(str(c), S["cell"]) for c in r] for r in rows]
    t = Table(data, colWidths=[w * mm for w in widths], repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.4, GRID),
        ("BACKGROUND", (0, 0), (-1, 0), SHADE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("LEFTPADDING", (0, 0), (-1, -1), 4), ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def cover(title, subtitle, doc_no, rev, date, prepared_by=YARD, extra=None):
    rows = [["Project", f"{VESSEL} ({HULL})"], ["Document No.", doc_no], ["Revision", rev],
            ["Date", date], ["Prepared by", prepared_by]] + (extra or [])
    meta = Table([[Paragraph(a, S["head"]), Paragraph(b, S["cell"])] for a, b in rows], colWidths=[40 * mm, 110 * mm])
    meta.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, GRID), ("BACKGROUND", (0, 0), (0, -1), SHADE),
                              ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    return [Spacer(1, 35 * mm), P(title, "title"), P(subtitle, "sub"), Spacer(1, 12 * mm), meta, PageBreak()]


# ── 01  Build specification ──────────────────────────────────────────────────
def build_specification():
    st = cover("BUILD SPECIFICATION", VESSEL, "EX-101-BS-001", "B", "12.03.2026")
    st += [P("Section 1 - General", "h1")]
    st += clauses([
        ("1.1", f"This specification describes the design, construction, outfitting, testing and delivery of one (1) {VESSEL}, {HULL}, to be built by {YARD} for {OWNER} (the Owner)."),
        ("1.2", "The vessel is intended for platform supply, anchor handling assistance, firefighting support and accommodation of special personnel in coastal and offshore waters."),
        ("1.3", "Where this specification and the contract plans differ, the contract shall prevail, followed by this specification and then the plans."),
        ("1.4", "All equipment shall be new, of marine type, and suitable for continuous operation at ambient conditions of 45 C air and 32 C sea water."),
    ])
    st += [P("Section 2 - Principal Particulars", "h1"),
           table(["Particular", "Value"], [
               ["Length overall", "45.00 m"], ["Length between perpendiculars", "41.50 m"],
               ["Breadth moulded", "11.00 m"], ["Depth moulded to main deck", "4.50 m"],
               ["Design draught", "3.60 m"], ["Deadweight at design draught", "650 t (approx.)"],
               ["Gross tonnage", "720 (approx.)"], ["Service speed at design draught", "12.0 knots at 85% MCR"],
               ["Complement", "12 crew + 20 special personnel (32 persons)"],
               ["Fuel oil capacity", "220 m3"], ["Fresh water capacity", "90 m3"],
           ], [70, 104])]
    st += [P("Section 3 - Classification and Regulations", "h1")]
    st += clauses([
        ("3.1", "The vessel shall be built under survey of an IACS member classification society nominated by the Owner, and classed for unrestricted service as an offshore support vessel."),
        ("3.2", "The vessel shall comply with: SOLAS 1974 as amended; the International Load Line Convention; MARPOL 73/78 Annexes I, IV, V and VI; the LSA Code; the FSS Code; COLREG 1972; and the ILO Maritime Labour Convention 2006."),
        ("3.3", "Electrical installations shall comply with the IEC 60092 series. Navigation and radio equipment shall comply with SOLAS Chapter V and Chapter IV and carry valid type approval."),
    ])
    st += [P("Section 4 - Hull Structure", "h1")]
    st += clauses([
        ("4.1", "Hull structure shall be of welded steel construction using ordinary and higher-strength shipbuilding steel with mill certificates from an approved works."),
        ("4.2", "Bottom shell plating shall be 10 mm and side shell plating 8 mm. Main deck plating shall be 10 mm in way of the cargo deck, which is designed for a uniform load of 5 t/m2."),
        ("4.3", "Transverse frame spacing shall be 600 mm throughout. A double bottom shall extend from the collision bulkhead to the aft peak bulkhead."),
        ("4.4", "Five (5) transverse watertight bulkheads shall be fitted, extending to the main deck. The collision bulkhead shall be located 1.50 m aft of the forward perpendicular."),
        ("4.5", "All external steel surfaces shall be blast cleaned to Sa 2.5 and coated with an approved marine coating system. Ballast tanks shall be coated in accordance with the IMO PSPC where applicable."),
    ])
    st += [P("Section 5 - Main Machinery", "h1")]
    st += clauses([
        ("5.1", "Propulsion shall be by two (2) marine diesel engines of 1,100 kW MCR each at 1,600 rpm, driving two (2) controllable pitch propellers through reduction gearboxes."),
        ("5.2", "One (1) electrically driven bow thruster of 250 kW shall be fitted, controllable from the wheelhouse."),
        ("5.3", "Two (2) electro-hydraulic steering gears shall be provided, each capable of putting the rudder from 35 degrees on one side to 30 degrees on the other side in not more than 28 seconds at service speed."),
        ("5.4", "Machinery spaces shall be arranged for attended operation with centralised alarm and monitoring at the engine control room and wheelhouse."),
    ])
    st += [P("Section 6 - Piping Systems", "h1")]
    st += clauses([
        ("6.1", "Two (2) independently driven bilge pumps of 40 m3/h each shall serve all watertight compartments. Bilge suctions shall be fitted with non-return valves."),
        ("6.2", "A ballast system with two (2) pumps of 60 m3/h each shall be provided. Ballast piping shall not pass through fuel oil tanks."),
        ("6.3", "One (1) oily water separator of 1.0 m3/h capacity shall be fitted, with an oil content meter. Treated bilge water may be discharged overboard at an oil content of up to 100 ppm while the vessel is under way."),
        ("6.4", "Fuel oil transfer, service and overflow systems shall be separate from all other systems. Sounding pipes shall not terminate in spaces where a risk of ignition from spillage exists."),
    ])
    st += [P("Section 7 - Electrical Installation", "h1")]
    st += clauses([
        ("7.1", "The electrical system shall be 415 V AC, 3-phase, 3-wire insulated neutral, 50 Hz for power, and 230 V AC for lighting and small power through 415/230 V transformers. A 24 V DC system shall serve alarms and communications."),
        ("7.2", "Main power shall be supplied by three (3) diesel generators of 250 kW (312.5 kVA) each at 0.8 power factor. Any two sets shall be capable of supplying the sea-going load with one set in standby."),
        ("7.3", "One (1) main switchboard shall be fitted in the engine control room with bus-tie between two sections, automatic synchronising and preferential tripping of non-essential loads."),
        ("7.4", "One (1) emergency generator of 60 kW (75 kVA) shall be fitted above the main deck in a dedicated space with its own emergency switchboard. It shall start automatically on loss of main power and shall supply the emergency switchboard within 120 seconds."),
        ("7.5", "Two (2) 415/230 V, 100 kVA dry-type transformers shall be provided, each capable of the full 230 V load. Shore connection shall be rated 63 A, 415 V with phase-sequence indication."),
        ("7.6", "All electrical equipment on open decks shall have a degree of protection not less than IP56."),
        ("7.7", "Power and lighting cables may be PVC-insulated general-purpose type in accommodation spaces, where flame-retardant properties are not required."),
        ("7.8", "Power and instrumentation cables running in parallel for more than 3 m shall be segregated or screened in accordance with IEC 60092-352."),
        ("7.9", "For load calculation purposes the main generating plant shall be taken as two (2) diesel generators of 250 kW each."),
    ])
    st += [P("Section 8 - Navigation and Communication", "h1")]
    st += clauses([
        ("8.1", "Bridge equipment shall include one X-band and one S-band radar, ECDIS with back-up arrangement, gyro compass, magnetic compass, DGPS, AIS, echo sounder, EM log, BNWAS and a simplified voyage data recorder."),
        ("8.2", "Radio installation shall meet GMDSS requirements for sea areas A1 and A2."),
        ("8.3", "A public address and general alarm system shall cover all accommodation, working and machinery spaces with a sound level meeting the LSA Code."),
        ("8.4", "Bridge wing and mast-mounted equipment shall have a degree of protection not less than IP44."),
    ])
    st += [P("Section 9 - Heating, Ventilation and Air Conditioning", "h1")]
    st += clauses([
        ("9.1", "Accommodation shall be air conditioned to 26 C and 55% relative humidity at the design ambient conditions, with a minimum of 30% fresh air."),
        ("9.2", "The engine room shall have two (2) supply fans and one (1) exhaust fan, giving sufficient air for combustion and heat removal with one supply fan out of service."),
    ])
    st += [P("Section 10 - Fire Protection and Life-Saving", "h1")]
    st += clauses([
        ("10.1", "Structural fire protection, escape routes and fire detection shall comply with SOLAS Chapter II-2 and the FSS Code. An addressable fire detection system shall be provided."),
        ("10.2", "The main machinery space shall be protected by portable and wheeled fire extinguishers only. Two (2) main fire pumps of 40 m3/h and one (1) emergency fire pump shall be provided."),
        ("10.3", "Inflatable liferafts for 100% of the persons on board shall be provided on each side, with one (1) SOLAS rescue boat served by a davit."),
        ("10.4", "Lifejackets, immersion suits, lifebuoys and pyrotechnics shall be provided in the quantities required by SOLAS Chapter III and the LSA Code."),
    ])
    st += [P("Section 11 - Deck Outfit", "h1")]
    st += clauses([
        ("11.1", "Anchoring and mooring equipment shall comply with class equipment number. One (1) combined windlass and two (2) mooring winches of 10 t pull shall be fitted."),
        ("11.2", "One (1) electro-hydraulic deck crane of 10 t SWL at 12 m radius shall be fitted on the starboard side of the cargo deck."),
        ("11.3", "All electrical equipment on open decks shall have a degree of protection not less than IP56."),
    ])
    st += [P("Section 12 - Tests and Trials", "h1")]
    st += clauses([
        ("12.1", "Major equipment shall undergo factory acceptance tests (FAT) witnessed by the Owner and class where required."),
        ("12.2", "Harbour acceptance trials (HAT) shall prove each system alongside. Sea acceptance trials (SAT) shall include speed, endurance, manoeuvring, steering gear, anchor and crash-stop trials."),
    ])
    st += [P("Section 13 - Documentation, Spares and Warranty", "h1")]
    st += clauses([
        ("13.1", "As-fitted drawings, operating and maintenance manuals and test records shall be delivered in English in both printed and searchable electronic form."),
        ("13.2", "Spares shall be supplied as required by class plus the maker's recommendation for two (2) years of operation. The builder's warranty shall be twelve (12) months from delivery."),
    ])
    build_pdf("01_Build_Specification_OSV-45.pdf", "Build Specification - OSV-45", "EX-101-BS-001", "B", st)


# ── 02  SOTR ─────────────────────────────────────────────────────────────────
SOTR_CLAUSES = [
    ("Chapter 01 - General Information", [
        ("1.1", "This Statement of Technical Requirements defines the requirements for the supply of a navigation radar and ECDIS system for the vessel."),
        ("1.2", "The scope covers design, manufacture, type testing, supply, installation supervision, commissioning, training and product support."),
    ]),
    ("Chapter 02 - Operational Requirements", [
        ("2.1", "The system shall comprise one X-band radar, one S-band radar and two ECDIS workstations networked on a redundant bridge LAN."),
        ("2.2", "Each workstation shall be able to act as a radar display or an ECDIS display, selectable by the operator."),
        ("2.3", "The radar shall provide automatic target tracking of not less than 100 targets and AIS target display."),
        ("2.4", "The ECDIS shall hold a complete back-up of chart data, and failure of one workstation shall not affect the other."),
    ]),
    ("Chapter 03 - Technical Specifications", [
        ("3.1", "The X-band radar shall have a transmitter output of not less than 25 kW and the S-band radar not less than 30 kW."),
        ("3.2", "Display size shall be not less than 23.1 inches (diagonal) with a resolution of not less than 1920 x 1200 pixels."),
        ("3.3", "The radar shall comply with IMO Resolution MSC.192(79) and IEC 62388. The ECDIS shall comply with IMO Resolution MSC.232(82) and IEC 61174."),
        ("3.4", "Interfaces to gyro, DGPS, AIS, EM log, echo sounder and VDR shall conform to IEC 61162-1/-2 and shall be included in the base price."),
        ("3.5", "Power supply shall be 230 V AC, 50 Hz from the ship's mains with a dedicated UPS giving not less than 30 minutes of operation on battery."),
    ]),
    ("Chapter 04 - Environmental Specifications", [
        ("4.1", "All equipment shall be type tested to IEC 60945 for the applicable equipment category."),
        ("4.2", "Antenna units shall have a degree of protection not less than IP56 and operate from -25 C to +55 C."),
        ("4.3", "Below-deck units shall operate from -15 C to +55 C at up to 95% relative humidity."),
    ]),
    ("Chapter 05 - Reliability and Maintainability", [
        ("5.1", "The vendor shall state the MTBF of each major unit, which shall be not less than 10,000 hours, and the MTTR, which shall not exceed 2 hours."),
        ("5.2", "Built-in test equipment shall identify a failed unit down to line-replaceable-unit level."),
        ("5.3", "Product support, including spares availability, shall be guaranteed for not less than ten (10) years after delivery."),
    ]),
    ("Chapter 06 - General Requirements", [
        ("6.1", "The equipment shall carry a valid marine equipment type-approval certificate; copies shall accompany the offer."),
        ("6.2", "On-board spares for two (2) years of operation shall be included. A priced list of recommended base spares shall be submitted."),
        ("6.3", "The vendor shall conduct FAT, and shall attend HAT and SAT on board at no extra cost."),
        ("6.4", "On-board training shall be provided for not less than 6 operators and 2 maintainers."),
        ("6.5", "The warranty shall be not less than twenty-four (24) months from vessel delivery."),
        ("6.6", "Manuals, drawings and test records shall be delivered in English, in printed and searchable electronic form."),
        ("6.7", "Delivery to the yard shall be within eight (8) months of the purchase order."),
    ]),
]


def sotr():
    st = cover("STATEMENT OF TECHNICAL REQUIREMENTS", "Navigation Radar and ECDIS System", "EX-101-SOTR-021", "A", "20.03.2026")
    st += [P("Vendors shall record <b>Complied</b> or <b>Not Complied</b> against every clause, with remarks for any deviation.")]
    for chapter, items in SOTR_CLAUSES:
        st += [P(chapter, "h1"), table(["Clause", "Requirement", "Vendor reply"], [[n, t, ""] for n, t in items], [14, 130, 30])]
    build_pdf("02_SOTR_Navigation_Radar_ECDIS.pdf", "SOTR - Navigation Radar and ECDIS", "EX-101-SOTR-021", "A", st)


# ── 03/04  Vendor technical offers ───────────────────────────────────────────
def offer_acme():
    v = "Acme Marine Electronics"
    st = cover("TECHNICAL OFFER", "Navigation Radar and ECDIS System", "AME/TO/2026/118", "0", "02.04.2026", prepared_by=v,
               extra=[["Reference", "Your enquiry against SOTR EX-101-SOTR-021"], ["Offer validity", "90 days"]])
    st += [P("1. Introduction", "h1"),
           P(f"{v} is pleased to submit this technical offer for the navigation radar and ECDIS system of {HULL}. The offer is based on our standard AME-7000 bridge series.")]
    st += [P("2. Scope of Supply", "h1"),
           table(["Item", "Description", "Qty"], [
               ["1", "X-band radar with 12 kW transceiver and 9 ft antenna", "1"],
               ["2", "S-band radar with 30 kW transceiver and 12 ft antenna", "1"],
               ["3", "Multifunction workstation with 19-inch display, 1600 x 1200 pixels", "2"],
               ["4", "ECDIS software licence and chart management module", "2"],
               ["5", "Bridge LAN switch (single, non-redundant)", "1"],
               ["6", "UPS, 15 minutes back-up", "1"],
           ], [14, 140, 20])]
    st += [P("3. Technical Particulars", "h1")]
    st += clauses([
        ("3.1", "Automatic tracking of up to 100 targets with AIS overlay. Radar performance is to IMO MSC.192(79); ECDIS to IMO MSC.232(82)."),
        ("3.2", "Interfaces to gyro, DGPS and AIS are included. The VDR and echo sounder interfaces are optional and are priced separately."),
        ("3.3", "Antenna units are rated IP56, -25 C to +55 C. Below-deck units are rated 0 C to +50 C."),
        ("3.4", "Type testing to IEC 60945 is complete. The marine type-approval certificate for the AME-7000 series is under process and will be furnished after award."),
        ("3.5", "Built-in test identifies failures to board level. MTBF figures will be provided at the post-order stage."),
    ])
    st += [P("4. Commercial and Support Terms (technical extract)", "h1")]
    st += clauses([
        ("4.1", "Warranty: twelve (12) months from date of commissioning or eighteen (18) months from despatch, whichever is earlier."),
        ("4.2", "On-board spares: one (1) year, as per the attached list. FAT is included. Attendance at HAT and SAT is charged at standard service-engineer rates."),
        ("4.3", "Training: two days at our works for up to 4 persons. On-board training is available on request."),
        ("4.4", "Delivery: ten (10) to twelve (12) months from purchase order. Manuals in English, printed copy only."),
        ("4.5", "Product support: spares availability for five (5) years after the end of series production."),
    ])
    build_pdf("03_Technical_Offer_Acme_Marine_Electronics.pdf", "Technical Offer - Acme Marine Electronics", "AME/TO/2026/118", "0", st, author=v)


def offer_globex():
    v = "Globex Marine Systems"
    st = cover("TECHNICAL OFFER", "Navigation Radar and ECDIS System", "GMS-OFF-2026-0342", "1", "05.04.2026", prepared_by=v,
               extra=[["Reference", "SOTR EX-101-SOTR-021 Rev. A"], ["Offer validity", "120 days"]])
    st += [P("1. Offered System", "h1"),
           P("Globex Marine Systems offers the GMS Bridge 900 integrated radar and ECDIS system, fully networked and type approved.")]
    st += [P("2. Scope of Supply", "h1"),
           table(["Item", "Description", "Qty"], [
               ["1", "X-band radar, 25 kW transceiver, 8 ft antenna", "1"],
               ["2", "S-band radar, 30 kW transceiver, 12 ft antenna", "1"],
               ["3", "Multifunction workstation, 24-inch display, 1920 x 1200 pixels", "2"],
               ["4", "ECDIS licence with back-up chart server", "2"],
               ["5", "Redundant bridge LAN, dual managed switches", "1 set"],
               ["6", "UPS, 30 minutes back-up", "1"],
           ], [14, 140, 20])]
    st += [P("3. Technical Compliance Summary", "h1")]
    st += clauses([
        ("3.1", "Tracking of 256 targets with AIS overlay. Radar to IMO MSC.192(79) and IEC 62388; ECDIS to IMO MSC.232(82) and IEC 61174."),
        ("3.2", "All listed interfaces (gyro, DGPS, AIS, EM log, echo sounder, VDR) conform to IEC 61162 and are included in the offer."),
        ("3.3", "Antenna units are rated IP55 and -25 C to +55 C; the vendor proposes this as an acceptable deviation from IP56. Below-deck units are rated -15 C to +55 C at 95% RH."),
        ("3.4", "Type testing to IEC 60945 is complete. Marine equipment type-approval certificates are valid until 2029 and copies are enclosed."),
        ("3.5", "MTBF 18,000 hours and MTTR 1 hour for each major unit. Built-in test isolates faults to line-replaceable-unit level."),
    ])
    st += [P("4. Support", "h1")]
    st += clauses([
        ("4.1", "Warranty: twenty-four (24) months from vessel delivery. Product support is guaranteed for ten (10) years."),
        ("4.2", "On-board spares for two (2) years are included, and a priced base-spares list is attached."),
        ("4.3", "FAT is included, and attendance at HAT and SAT is included at no extra cost."),
        ("4.4", "Training is held at the vendor's training centre for 6 operators and 2 maintainers. On-board training is not included."),
        ("4.5", "Delivery: eight (8) months from purchase order. Manuals in English, printed and searchable PDF."),
    ])
    build_pdf("04_Technical_Offer_Globex_Marine_Systems.pdf", "Technical Offer - Globex Marine Systems", "GMS-OFF-2026-0342", "1", st, author=v)


# ── 06  POTS (Word) ──────────────────────────────────────────────────────────
def docx_base(title, subtitle, doc_no, rev):
    d = Document()
    sec = d.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.left_margin = sec.right_margin = Cm(2.2)
    sec.top_margin = sec.bottom_margin = Cm(2.2)
    base = d.styles["Normal"]
    base.font.name, base.font.size = "Arial", Pt(10)
    for name, size in (("Title", 20), ("Heading 1", 13), ("Heading 2", 11)):
        h = d.styles[name]
        h.font.name, h.font.size, h.font.bold = "Arial", Pt(size), True
        h.font.color.rgb = RGBColor(0x17, 0x32, 0x4D)
    d.core_properties.title, d.core_properties.author = title, YARD
    d.core_properties.subject = NOTICE
    sec.header.paragraphs[0].text = f"{YARD}    {doc_no}  Rev. {rev}"
    sec.footer.paragraphs[0].text = NOTICE
    d.add_paragraph(title, style="Title")
    d.add_paragraph(subtitle)
    return d


def docx_table(d, header, rows, widths_cm):
    t = d.add_table(rows=1, cols=len(header))
    t.style = "Table Grid"
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    for i, h in enumerate(header):
        cell = t.rows[0].cells[i]
        cell.text = h
        cell.paragraphs[0].runs[0].bold = True
    for r in rows:
        cells = t.add_row().cells
        for i, v in enumerate(r):
            cells[i].text = str(v)
    for row in t.rows:
        for i, w in enumerate(widths_cm):
            row.cells[i].width = Cm(w)
    d.add_paragraph()
    return t


def pots():
    doc_no = "EX-101-POTS-034"
    d = docx_base("PURCHASE ORDER TECHNICAL SPECIFICATION", "Public Address and General Alarm System", doc_no, "0")
    docx_table(d, ["Field", "Detail"], [
        ["Project", f"{VESSEL} ({HULL})"], ["Purchase order", "EX-101-PO-0457"],
        ["Vendor", "Acme Sound Systems"], ["Date", "15.04.2026"],
    ], [5, 11.5])
    d.add_heading("1. Scope", level=1)
    d.add_paragraph("The vendor shall supply a public address and general alarm (PAGA) system covering all accommodation, working and machinery spaces of the vessel, complying with SOLAS and the LSA Code.")
    d.add_heading("2. Technical Requirements", level=1)
    for no, text in [
        ("2.1", "The system shall comprise dual 1 kW amplifier racks in a main-and-standby arrangement, with automatic changeover on amplifier failure."),
        ("2.2", "The system shall operate from 230 V AC with a 24 V DC battery back-up giving 30 minutes of alarm broadcast."),
        ("2.3", "Sound pressure level shall be at least 80 dB(A) and at least 10 dB(A) above ambient noise in all spaces, as demonstrated by calculation and proved at trials."),
        ("2.4", "Weather-deck loudspeakers and cable glands shall be rated IP56 or better. Machinery-space loudspeakers shall be horn type."),
        ("2.5", "The equipment shall be type tested to IEC 60945, including EMC and vibration, and shall hold a valid marine type-approval certificate."),
    ]:
        d.add_paragraph(f"{no}  {text}")
    d.add_heading("3. Binding Data to Be Submitted by the Vendor", level=1)
    d.add_paragraph("The vendor shall submit the following within six (6) weeks of the purchase order for approval. Fabrication shall not begin until approval is given.")
    docx_table(d, ["Item", "Required deliverable", "POTS clause"], [
        ["BD-01", "Equipment list with make, model and quantity", "3.1"],
        ["BD-02", "General arrangement drawings with dimensions and maintenance envelope", "3.2"],
        ["BD-03", "Weight and centre of gravity of each unit", "3.3"],
        ["BD-04", "Power consumption and heat dissipation of each unit", "3.4"],
        ["BD-05", "Single line diagram and interconnection diagram", "3.5"],
        ["BD-06", "Cable schedule with cable type, size and gland details", "3.6"],
        ["BD-07", "Loudspeaker layout and sound pressure level calculation", "3.7"],
        ["BD-08", "Valid marine type-approval certificate", "3.8"],
        ["BD-09", "IEC 60945 test reports, including EMC and vibration", "3.9"],
        ["BD-10", "MTBF and MTTR calculation for each major unit", "3.10"],
        ["BD-11", "Factory acceptance test procedure", "3.11"],
        ["BD-12", "Harbour and sea acceptance trial procedure", "3.12"],
        ["BD-13", "Recommended spares list for two (2) years of operation", "3.13"],
        ["BD-14", "Operation and maintenance manual (draft)", "3.14"],
    ], [2, 11.5, 3])
    d.add_heading("4. Warranty and Support", level=1)
    d.add_paragraph("Warranty shall be twenty-four (24) months from vessel delivery. Product support shall be guaranteed for ten (10) years.")
    d.save(OUT / "06_POTS_Public_Address_System.docx")
    print("  wrote 06_POTS_Public_Address_System.docx")


# ── 07  Binding data ─────────────────────────────────────────────────────────
def binding():
    v = "Acme Sound Systems"
    st = cover("BINDING DATA SUBMISSION", "Public Address and General Alarm System", "ASS-BD-0457", "0", "28.05.2026", prepared_by=v,
               extra=[["Purchase order", "EX-101-PO-0457"], ["Status", "Submitted for approval"]])
    st += [P("1. Equipment List and Technical Particulars", "h1"),
           table(["S.No", "Name of the equipment", "Dimensions (W x H x D mm)", "Maintenance envelope", "Weight", "Power rating", "Heat dissipation", "Mounting"], [
               ["1", "Amplifier rack, main (1 kW)", "600 x 1800 x 600", "800 mm front", "185 kg", "1.6 kW", "450 W", "Deck"],
               ["2", "Amplifier rack, standby (1 kW)", "600 x 1800 x 600", "800 mm front", "185 kg", "1.6 kW", "450 W", "Deck"],
               ["3", "Battery and charger unit, 24 V DC", "500 x 900 x 400", "600 mm front", "Not stated", "0.6 kW", "120 W", "Bulkhead"],
               ["4", "Wheelhouse paging console", "300 x 120 x 250", "-", "4 kg", "25 W", "20 W", "Table top"],
               ["5", "Engine control room paging station", "200 x 300 x 100", "-", "3 kg", "15 W", "10 W", "Bulkhead"],
               ["6", "Horn loudspeaker, 25 W (machinery spaces)", "280 x 300 x 350", "-", "3.5 kg", "25 W", "-", "Bulkhead"],
               ["7", "Cabin loudspeaker, 6 W", "180 x 180 x 90", "-", "1.2 kg", "6 W", "-", "Bulkhead"],
               ["8", "Weather-deck loudspeaker, 25 W", "280 x 300 x 350", "-", "4 kg", "25 W", "-", "Bulkhead"],
           ], [10, 42, 27, 24, 15, 15, 20, 20])]
    st += [P("2. System Description", "h1"),
           P("The system uses dual 1 kW amplifier racks with manual changeover by a selector switch on the rack. On loss of 230 V AC the system transfers to 24 V DC batteries, which support a 20-minute alarm broadcast."),
           P("Weather-deck loudspeakers are IP56. Cable glands supplied for weather-deck loudspeakers are IP54 brass glands from our standard range.")]
    st += [P("3. Drawings and Calculations", "h1"),
           table(["Document", "Reference", "Status"], [
               ["General arrangement of amplifier racks", "ASS-DWG-101", "Enclosed"],
               ["Single line diagram", "ASS-DWG-102", "Enclosed"],
               ["Interconnection diagram", "-", "To follow after zone finalisation"],
               ["Cable schedule", "ASS-DWG-104", "Enclosed; gland details not included"],
               ["Loudspeaker layout", "ASS-DWG-105", "Enclosed"],
               ["Sound pressure level calculation", "-", "To follow"],
           ], [80, 40, 54])]
    st += [P("4. Certificates and Test Reports", "h1"),
           table(["Document", "Reference", "Remarks"], [
               ["Marine type-approval certificate", "TA-2019-4471", "Valid until 30.06.2024; renewal applied for"],
               ["IEC 60945 environmental test report", "TR-8821", "Temperature and humidity only"],
               ["MTBF calculation", "ASS-RAM-07", "Amplifier rack only"],
           ], [80, 40, 54])]
    st += [P("5. Spares and Support", "h1"),
           P("A recommended spares list for one (1) year of operation is enclosed (ASS-SP-09). A draft operation and maintenance manual is enclosed (ASS-OM-11)."),
           P("Warranty is twelve (12) months from commissioning. The factory acceptance test will follow the vendor's standard test sheet; a procedure can be furnished on request.")]
    build_pdf("07_Binding_Data_Public_Address_System.pdf", "Binding Data - Public Address System", "ASS-BD-0457", "0", st, author=v)


# ── 08  RFP ──────────────────────────────────────────────────────────────────
def rfp():
    st = cover("REQUEST FOR PROPOSAL", "Main Switchboard and Power Management System", "EX-101-RFP-052", "0", "10.04.2026",
               extra=[["Bid due date", "15.05.2026"], ["Bid validity", "90 days from bid due date"]])
    st += [P("1. Instructions to Bidders", "h1")]
    st += clauses([
        ("1.1", f"{YARD} invites offers for the supply of a main switchboard and power management system (PMS) for {HULL}."),
        ("1.2", "Bids shall remain valid for 120 days from the date of opening."),
        ("1.3", "Technical and price bids shall be submitted in separate envelopes. Queries shall be submitted in writing before the pre-bid meeting."),
        ("1.4", "Delivery shall be as early as possible and in line with the shipbuilding schedule."),
    ])
    st += [P("2. Technical Scope", "h1")]
    st += clauses([
        ("2.1", "The switchboard shall be suitable for the generators and loads of the vessel, in two sections with a bus-tie."),
        ("2.2", "Rated voltage shall be 415 V AC, 3-phase, 50 Hz. The busbar short-circuit withstand rating shall be suitable for the fault level of the system."),
        ("2.3", "Degree of protection shall be IP22 for the switchboard enclosure. The enclosure shall also meet IP44 where installed in machinery spaces."),
        ("2.4", "Breakers shall be of a reputed make. Generator breakers shall be withdrawable; feeder breakers shall be as per vendor standard."),
        ("2.5", "The PMS shall provide automatic start, synchronising, load sharing, load-dependent start and stop, and preferential tripping."),
        ("2.6", "The PMS shall interface with the ship's alarm and monitoring system. Details of the interface will be provided later."),
        ("2.7", "The equipment shall comply with the relevant standards and classification society requirements."),
    ])
    st += [P("3. Testing and Documentation", "h1")]
    st += clauses([
        ("3.1", "Factory acceptance tests shall be carried out as necessary. Class witness charges shall be borne by the party as mutually agreed."),
        ("3.2", "The vendor shall submit standard documents with the bid and all other documents after the order."),
    ])
    st += [P("4. Commercial Conditions", "h1")]
    st += clauses([
        ("4.1", "Standard spares shall be included in the scope of supply."),
        ("4.2", "Warranty shall be as per the shipbuilding contract."),
        ("4.3", "Liquidated damages shall apply for delay in delivery. The rate and ceiling are as per company policy."),
        ("4.4", "Payment terms shall be discussed during negotiation."),
    ])
    build_pdf("08_RFP_Main_Switchboard.pdf", "RFP - Main Switchboard and PMS", "EX-101-RFP-052", "0", st)


# ── 09  Inspection report ────────────────────────────────────────────────────
INSPECTION_ROWS = [
    ["1", "Emergency Generator", "Engine started on the second attempt only; the first automatic start failed.", "Class Surveyor", "UNSAT", "Investigate the starting battery and control relay. Repeat the blackout test."],
    ["2", "Emergency Generator", "Emergency switchboard took 58 seconds to energise after simulated blackout.", "Class Surveyor", "UNSAT", "Reset the start delay and retest; must not exceed 45 seconds."],
    ["3", "Emergency Generator", "Exhaust piping insulation incomplete in way of the bulkhead penetration.", "QA", "UNSAT", "Complete the insulation and fit cladding."],
    ["4", "Steering Gear", "Rudder swing from 35 degrees port to 30 degrees starboard took 26 seconds on each pump.", "Class Surveyor", "SAT", "None."],
    ["5", "Steering Gear", "Minor hydraulic weep at the cylinder gland of pump no. 2.", "Owner", "UNSAT", "Replace the gland packing and retest."],
    ["6", "Steering Gear", "Angle indicator at the wheelhouse differs from the local indicator by 3 degrees.", "Owner", "UNSAT", "Recalibrate the rudder angle transmitter."],
    ["7", "Main Switchboard", "Preferential trips proved at 110% load; all three stages operated correctly.", "Class Surveyor", "SAT", "None."],
    ["8", "Main Switchboard", "Insulation monitoring alarm not relayed to the wheelhouse alarm panel.", "QA", "UNSAT", "Complete the wiring per the interconnection diagram."],
    ["9", "Main Switchboard", "Several breaker labels are not as per the approved drawing.", "QA", "UNSAT", "Revise and re-fix the labels."],
    ["10", "Public Address System", "Cable glands at the weather-deck loudspeakers are IP54 instead of the IP56 specified.", "Owner", "UNSAT", "Replace with IP56 glands."],
    ["11", "Public Address System", "Sound level of 74 dB(A) measured in the engine room with machinery running.", "Class Surveyor", "UNSAT", "Add horn loudspeakers and re-measure; must be at least 80 dB(A) and 10 dB(A) above ambient."],
    ["12", "Fire Detection", "All detector loops tested; alarms correctly reported at the fire panel.", "Class Surveyor", "SAT", "None."],
    ["13", "Fire Detection", "Two detectors in the galley were found with protective covers still in place.", "QA", "UNSAT", "Remove the covers and retest the loop."],
    ["14", "HVAC", "Cabin 204 supply air flow is 20% below the design value.", "Owner", "UNSAT", "Rebalance the duct dampers."],
    ["15", "HVAC", "Engine room supply fan no. 2 tripped on overload after 40 minutes.", "QA", "UNSAT", "Check motor current and overload setting."],
    ["16", "Bilge System", "All bilge suctions proved from both pumps.", "Class Surveyor", "SAT", "None."],
    ["17", "Bilge System", "Non-return valve in the forward bilge line was installed against the flow direction.", "QA", "UNSAT", "Refit the valve correctly and test."],
    ["18", "Oily Water Separator", "15 ppm alarm test certificate is not available on board.", "Class Surveyor", "UNSAT", "Obtain the certificate from the maker."],
    ["19", "Deck Crane", "Load test at 12.5 t completed without any deficiency.", "Class Surveyor", "SAT", "None."],
    ["20", "Deck Crane", "Maker's manual on board is for a previous model.", "Owner", "UNSAT", "Supply the correct manual."],
    ["21", "Hull Structure", "Weld undercut observed at the frame 28 bracket on the port side.", "QA", "UNSAT", "Grind and re-weld, then carry out magnetic particle inspection."],
    ["22", "Hull Structure", "Paint coating below the specified dry film thickness in ballast tank no. 3.", "Owner", "UNSAT", "Apply a touch-up coat and re-measure."],
]


def inspection():
    st = cover("INSPECTION REPORT", "Harbour Acceptance Trials - Machinery and Outfit Systems", "EX-101-QA-IR-017", "0", "22.09.2026",
               extra=[["Inspection period", "14.09.2026 to 18.09.2026"], ["Location", "Fitting-out berth"], ["Attended by", "Class Surveyor, Owner's Representative, Yard QA"]])
    st += [P("1. Summary", "h1"),
           P(f"Harbour acceptance trials of the listed systems were carried out on {HULL}. A total of {len(INSPECTION_ROWS)} observations were recorded, of which {sum(r[4] == 'SAT' for r in INSPECTION_ROWS)} were satisfactory and {sum(r[4] == 'UNSAT' for r in INSPECTION_ROWS)} unsatisfactory."),
           P("2. Observations Register", "h1"),
           table(["Sl.No", "System / Equipment", "Observation", "Agency", "Result", "Action required"], INSPECTION_ROWS, [10, 28, 62, 20, 13, 41]),
           P("3. Conclusion", "h1"),
           P("The emergency generator blackout test and the public address sound level test shall be repeated in the presence of the class surveyor after rectification. All open remarks shall be closed before sea trials.")]
    build_pdf("09_Inspection_Report_Harbour_Trials.pdf", "Inspection Report - Harbour Trials", "EX-101-QA-IR-017", "0", st)


# ── 10/11  Scanned remarks (image-only PDF + phone photo) ────────────────────
def _font(size, bold=False):
    candidates = ["C:/Windows/Fonts/courbd.ttf" if bold else "C:/Windows/Fonts/cour.ttf",
                  "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _scan_page(title, lines, seed):
    random.seed(seed)
    w, h = 1654, 2339
    im = Image.new("L", (w, h), 244)
    d = ImageDraw.Draw(im)
    y = 110
    d.text((110, y), YARD.upper(), font=_font(38, True), fill=25); y += 58
    d.text((110, y), title, font=_font(34, True), fill=25); y += 56
    d.text((110, y), f"Project: {HULL}   Date: 20.09.2026   Agency: Yard QA", font=_font(28), fill=30); y += 44
    d.text((110, y), NOTICE, font=_font(24), fill=70); y += 54
    d.line((110, y, w - 110, y), fill=40, width=3); y += 28
    for line in lines:
        d.text((110 + random.randint(-1, 1), y), line, font=_font(29), fill=random.randint(18, 42))
        y += 45
    im = im.rotate(random.uniform(-0.7, 0.7), resample=Image.BICUBIC, fillcolor=244)
    px = im.load()
    for _ in range(26000):
        px[random.randrange(w), random.randrange(h)] = random.randint(90, 230)
    return im.filter(ImageFilter.GaussianBlur(0.55)).convert("RGB")


def scans():
    page1 = _scan_page("PUNCH LIST - DECK AND ACCOMMODATION (Sheet 1 of 2)", [
        "SL  SYSTEM              REMARK                          RESULT", "",
        "1   Windlass            Brake lining worn on port       UNSAT",
        "                        wildcat. Replace lining.",
        "2   Mooring Winch       Load test completed at 12 t.    SAT",
        "3   Rescue Boat Davit   Limit switch not operating in   UNSAT",
        "                        the stowed position. Adjust.",
        "4   Liferaft Cradle     Hydrostatic release is past     UNSAT",
        "                        its expiry date. Replace.",
        "5   Accommodation Door  Fire door D-12 does not fully   UNSAT",
        "                        self-close. Adjust the closer.",
        "6   Galley              Exhaust duct fire damper has    UNSAT",
        "                        no position indication.",
        "7   Cabin 106           Insulation gap in way of the    UNSAT",
        "                        cable penetration. Rectify.",
        "8   Navigation Lights   All lights and the panel        SAT",
        "                        alarm tested satisfactory.",
    ], 11)
    page2 = _scan_page("PUNCH LIST - DECK AND ACCOMMODATION (Sheet 2 of 2)", [
        "SL  SYSTEM              REMARK                          RESULT", "",
        "9   Cargo Deck          Timber sheathing bolts loose    UNSAT",
        "                        at frame 14. Retighten.",
        "10  Fresh Water System  Pressure set pump cycling too   UNSAT",
        "                        often. Check the accumulator.",
        "11  Sewage Plant        Discharge test completed.       SAT",
        "                        Certificate to be supplied.",
        "12  Bridge Wing         Control station cable gland     UNSAT",
        "                        is loose. Retighten and seal.", "",
        "All open remarks are to be closed before sea trials.", "",
        "Signed: Yard QA Inspector",
    ], 12)
    scratch = OUT / "_scan1.jpg", OUT / "_scan2.jpg"
    page1.save(scratch[0], quality=80)
    page2.save(scratch[1], quality=80)
    c = rl_canvas.Canvas(str(OUT / "10_Inspection_Remarks_Scanned.pdf"), pagesize=A4)
    c.setTitle("Scanned punch list - no text layer")
    c.setSubject(NOTICE)
    for path in scratch:
        c.drawImage(str(path), 0, 0, width=A4[0], height=A4[1])
        c.showPage()
    c.save()
    # A second capture of sheet 1, as if photographed rather than scanned.
    photo = page1.rotate(1.6, resample=Image.BICUBIC, fillcolor=(205, 205, 200)).resize((1240, 1754))
    photo.save(OUT / "11_Inspection_Remarks_Photo.jpg", quality=72)
    for path in scratch:
        path.unlink()
    print("  wrote 10_Inspection_Remarks_Scanned.pdf, 11_Inspection_Remarks_Photo.jpg")


# ── 12/13/15  Single line diagram (DXF revisions + PDF) ──────────────────────
def sld_data(rev):
    """Rev B changes: EG 60→75 kW, transformers 100→125 kVA, a new crane feeder, thruster breaker size."""
    b = rev == "B"
    return {
        "rev": rev,
        "date": "30.06.2026" if b else "15.03.2026",
        "eg": "EG 75 kW / 93.75 kVA" if b else "EG 60 kW / 75 kVA",
        "tr": "125 kVA" if b else "100 kVA",
        "thruster_acb": "630 A MCCB" if b else "500 A MCCB",
        "feeders": [
            ("BOW THRUSTER 250 kW", "630 A MCCB" if b else "500 A MCCB"),
            ("BILGE PUMP 1 15 kW", "32 A MCCB"),
            ("FIRE PUMP 1 22 kW", "50 A MCCB"),
            ("ER SUPPLY FAN 1 11 kW", "25 A MCCB"),
            ("ACCOM. A/C PLANT 45 kW", "100 A MCCB"),
        ] + ([("DECK CRANE 55 kW", "125 A MCCB")] if b else []),
        "notes": ["ALL CABLES TO IEC 60092-353, FLAME RETARDANT.",
                  "BREAKER SETTINGS PER DISCRIMINATION STUDY EX-101-EL-009."]
                 + (["DECK CRANE FEEDER ADDED AND EG UPRATED PER CHANGE NOTE CN-014."] if b else []),
    }


def sld_dxf(rev, name):
    data = sld_data(rev)
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 4
    for layer, colour in (("BUS", 1), ("EQUIP", 3), ("TEXT", 7), ("TITLE", 5), ("CABLE", 8)):
        doc.layers.add(layer, color=colour)
    m = doc.modelspace()

    def text(s, x, y, h=120, layer="TEXT"):
        m.add_text(s, dxfattribs={"layer": layer, "height": h}).set_placement((x, y))

    def box(x, y, w, h, layer="EQUIP"):
        m.add_lwpolyline([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True, dxfattribs={"layer": layer})

    # Generators and bus
    bus_y, x0 = 7000, 800
    for i in range(3):
        x = x0 + i * 2600
        m.add_circle((x + 700, 9400), 500, dxfattribs={"layer": "EQUIP"})
        text(f"DG-{i + 1}", x + 1300, 9550)
        text("250 kW", x + 1300, 9350, 100)
        text("312.5 kVA", x + 1300, 9180, 100)
        m.add_line((x + 700, 8900), (x + 700, bus_y), dxfattribs={"layer": "CABLE"})
        box(x + 500, 7600, 400, 400)
        text("630 A ACB", x + 950, 7760, 100)
    m.add_lwpolyline([(100, bus_y), (15400, bus_y)], dxfattribs={"layer": "BUS", "const_width": 60})
    text("MSB - 415 V AC 3PH 50 Hz (TWO SECTIONS WITH BUS-TIE)", 8000, bus_y + 120)

    # Feeders
    for i, (label, breaker) in enumerate(data["feeders"]):
        x = 1200 + i * 2150
        m.add_line((x, bus_y), (x, 5200), dxfattribs={"layer": "CABLE"})
        box(x - 150, 6200, 300, 300)
        text(breaker, x + 200, 6300, 90)
        text(label, x - 700, 5000, 90)

    # Transformers and 230 V board
    m.add_line((14400, bus_y), (14400, 5000), dxfattribs={"layer": "CABLE"})
    m.add_circle((14400, 4700), 300, dxfattribs={"layer": "EQUIP"})
    m.add_circle((14400, 4300), 300, dxfattribs={"layer": "EQUIP"})
    text(f"TR-1 / TR-2 415/230 V {data['tr']} DRY TYPE", 14800, 4500, 100)
    m.add_line((14400, 4000), (14400, 3700), dxfattribs={"layer": "CABLE"})
    m.add_lwpolyline([(12400, 3700), (17800, 3700)], dxfattribs={"layer": "BUS", "const_width": 40})
    text("230 V DISTRIBUTION BOARD LDB", 14600, 3820, 100)

    # Emergency section
    m.add_line((400, bus_y), (400, 3200), dxfattribs={"layer": "CABLE"})
    text("MSB-ESB INTERCONNECTOR 125 A", 550, 4300, 100)
    m.add_lwpolyline([(100, 3200), (10400, 3200)], dxfattribs={"layer": "BUS", "const_width": 50})
    text("EMERGENCY SWITCHBOARD ESB - 415 V AC 3PH 50 Hz", 600, 3320)
    m.add_circle((1600, 1600), 500, dxfattribs={"layer": "EQUIP"})
    m.add_line((1600, 2100), (1600, 3200), dxfattribs={"layer": "CABLE"})
    text(data["eg"], 2300, 1700)
    text("AUTO START ON LOSS OF MAIN POWER", 2300, 1500, 100)
    for i, label in enumerate(["EMERGENCY FIRE PUMP 15 kW", "STEERING GEAR 2 11 kW", "EMERGENCY LIGHTING 8 kW", "NAV AND RADIO SUPPLY 3 kW"]):
        x, y = 5400 + i * 1200, 2600 - i * 300
        m.add_line((x, 3200), (x, y), dxfattribs={"layer": "CABLE"})
        text(label, x + 60, y, 90)

    # Notes and title block
    text("NOTES:", 11200, 3000)
    for i, n in enumerate(data["notes"]):
        text(f"{i + 1}. {n}", 11200, 2800 - i * 200, 90)
    box(11000, 200, 8000, 1500, "TITLE")
    text(f"{YARD}", 11150, 1450, 140, "TITLE")
    text(f"PROJECT: {VESSEL} - {HULL}", 11150, 1200, 110, "TITLE")
    text("TITLE: SINGLE LINE DIAGRAM - POWER DISTRIBUTION", 11150, 980, 110, "TITLE")
    text(f"DRAWING NO: EX-101-EL-002   REV: {data['rev']}   DATE: {data['date']}", 11150, 760, 110, "TITLE")
    text(NOTICE, 11150, 480, 90, "TITLE")
    doc.saveas(OUT / name)
    print("  wrote", name)


def sld_pdf():
    data = sld_data("B")
    path = OUT / "15_SLD_Power_Distribution.pdf"
    W, H = landscape(A3)
    c = rl_canvas.Canvas(str(path), pagesize=(W, H))
    c.setTitle("Single Line Diagram - Power Distribution")
    c.setSubject(NOTICE)
    c.setLineWidth(1)
    c.rect(12 * mm, 12 * mm, W - 24 * mm, H - 24 * mm)

    def label(s, x, y, size=8, bold=False):
        c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
        c.drawString(x, y, s)

    bus = H - 95 * mm
    for i in range(3):
        x = (55 + i * 62) * mm
        c.circle(x, bus + 52 * mm, 9 * mm)
        label(f"DG-{i + 1}", x - 5 * mm, bus + 51 * mm, 9, True)
        label("250 kW / 312.5 kVA", x + 11 * mm, bus + 53 * mm)
        label("415 V, 50 Hz, 0.8 PF", x + 11 * mm, bus + 49 * mm, 7)
        c.line(x, bus + 43 * mm, x, bus)
        c.rect(x - 3 * mm, bus + 15 * mm, 6 * mm, 6 * mm)
        label("630 A ACB", x + 5 * mm, bus + 17 * mm, 7)
    c.setLineWidth(3)
    c.line(25 * mm, bus, W - 30 * mm, bus)
    c.setLineWidth(1)
    label("MAIN SWITCHBOARD (MSB) - 415 V AC, 3PH, 50 Hz", 200 * mm, bus + 2 * mm, 9, True)
    for i, (name, brk) in enumerate(data["feeders"]):
        x = (62 + i * 42) * mm
        c.line(x, bus, x, bus - 45 * mm)
        c.rect(x - 3 * mm, bus - 18 * mm, 6 * mm, 6 * mm)
        label(brk, x + 5 * mm, bus - 16 * mm, 7)
        label(name, x - 15 * mm, bus - 50 * mm, 7)
    x = 325 * mm
    c.line(x, bus, x, bus - 30 * mm)
    c.circle(x, bus - 35 * mm, 5 * mm)
    c.circle(x, bus - 42 * mm, 5 * mm)
    label(f"TR-1 / TR-2  415/230 V  {data['tr']}", x + 8 * mm, bus - 39 * mm)
    c.line(x, bus - 47 * mm, x, bus - 58 * mm)
    c.setLineWidth(2)
    c.line(300 * mm, bus - 58 * mm, W - 30 * mm, bus - 58 * mm)
    c.setLineWidth(1)
    label("230 V DISTRIBUTION BOARD (LDB)", x + 3 * mm, bus - 56 * mm, 8, True)

    esb = 62 * mm
    c.line(32 * mm, bus, 32 * mm, esb)
    label("MSB-ESB interconnector 125 A", 35 * mm, esb + 30 * mm, 7)
    c.setLineWidth(2.5)
    c.line(25 * mm, esb, 200 * mm, esb)
    c.setLineWidth(1)
    label("EMERGENCY SWITCHBOARD (ESB) - 415 V AC", 36 * mm, esb + 2 * mm, 9, True)
    c.circle(45 * mm, esb - 25 * mm, 9 * mm)
    label("EG", 42 * mm, esb - 26 * mm, 9, True)
    c.line(45 * mm, esb - 16 * mm, 45 * mm, esb)
    label(data["eg"], 57 * mm, esb - 22 * mm)
    label("Auto start on loss of main power", 57 * mm, esb - 28 * mm, 7)
    for i, (name, kw) in enumerate([("Emergency fire pump", "15 kW"), ("Steering gear 2", "11 kW"), ("Emergency lighting", "8 kW"), ("Nav and radio supply", "3 kW")]):
        fx = (108 + i * 26) * mm
        c.line(fx, esb, fx, esb - 12 * mm)
        label(name, fx - 11 * mm, esb - 16 * mm, 6.5)
        label(kw, fx - 11 * mm, esb - 20 * mm, 6.5)

    tx, ty = W - 165 * mm, 16 * mm
    c.rect(tx, ty, 150 * mm, 40 * mm)
    label(YARD, tx + 4 * mm, ty + 32 * mm, 10, True)
    label(f"Project: {VESSEL} - {HULL}", tx + 4 * mm, ty + 25 * mm)
    label("Title: Single Line Diagram - Power Distribution", tx + 4 * mm, ty + 19 * mm)
    label(f"Drawing No: EX-101-EL-002    Rev: {data['rev']}    Date: {data['date']}", tx + 4 * mm, ty + 13 * mm)
    label(NOTICE, tx + 4 * mm, ty + 5 * mm, 7)
    c.showPage()
    c.save()
    print("  wrote", path.name)


# ── 14  General arrangement (compartments as closed polylines in metres) ─────
GA_ROOMS = [
    ("WHEELHOUSE STORE",   0.0,  0.0, 6.0, 4.0),
    ("CHIEF ENGINEER CABIN", 6.0,  0.0, 5.0, 4.0),
    ("MASTER CABIN",      11.0,  0.0, 5.0, 4.0),
    ("MESS ROOM",         16.0,  0.0, 7.0, 4.0),
    ("GALLEY",            23.0,  0.0, 4.5, 4.0),
    ("PROVISION STORE",   27.5,  0.0, 4.5, 4.0),
    ("CREW CABIN 101",     0.0,  4.0, 4.0, 3.0),
    ("CREW CABIN 102",     4.0,  4.0, 4.0, 3.0),
    ("CREW CABIN 103",     8.0,  4.0, 4.0, 3.0),
    ("CORRIDOR",          12.0,  4.0, 20.0, 1.2),
    ("LAUNDRY",           12.0,  5.2, 4.0, 1.8),
    ("EMERGENCY GENERATOR ROOM", 16.0, 5.2, 6.0, 1.8),
    ("CO2 ROOM",          22.0,  5.2, 4.0, 1.8),
    ("PAINT STORE",       26.0,  5.2, 6.0, 1.8),
]


def ga_dxf():
    doc = ezdxf.new("R2010", setup=True)
    doc.header["$INSUNITS"] = 6
    for layer, colour in (("COMPARTMENT", 3), ("LABEL", 7), ("TITLE", 5), ("HULL", 1)):
        doc.layers.add(layer, color=colour)
    m = doc.modelspace()
    m.add_lwpolyline([(-1, -1), (40, -1), (45, 3.5), (40, 8), (-1, 8)], close=True, dxfattribs={"layer": "HULL"})
    for name, x, y, w, h in GA_ROOMS:
        m.add_lwpolyline([(x, y), (x + w, y), (x + w, y + h), (x, y + h)], close=True, dxfattribs={"layer": "COMPARTMENT"})
        m.add_text(name, dxfattribs={"layer": "LABEL", "height": 0.14}).set_placement((x + 0.15, y + h / 2))
    for s, y in [(YARD, -2.2), (f"PROJECT: {VESSEL} - {HULL}", -2.6),
                 ("TITLE: GENERAL ARRANGEMENT - MAIN DECK", -3.0),
                 ("DRAWING NO: EX-101-GA-001   REV: A   DATE: 01.03.2026   SCALE 1:100", -3.4), (NOTICE, -3.8)]:
        m.add_text(s, dxfattribs={"layer": "TITLE", "height": 0.18}).set_placement((0, y))
    doc.saveas(OUT / "14_GA_Plan_Main_Deck.dxf")
    print("  wrote 14_GA_Plan_Main_Deck.dxf")


# ── 16  Cable schedule (CSV) ─────────────────────────────────────────────────
def cable_schedule():
    rows = [
        ["Cable No", "From", "To", "Type", "Size", "Length (m)", "Service"],
        ["P-001", "DG-1", "MSB", "Flame retardant, armoured", "3 x 185 mm2", "28", "Generator power"],
        ["P-002", "DG-2", "MSB", "Flame retardant, armoured", "3 x 185 mm2", "24", "Generator power"],
        ["P-003", "DG-3", "MSB", "Flame retardant, armoured", "3 x 185 mm2", "21", "Generator power"],
        ["P-010", "MSB", "Bow thruster starter", "Flame retardant, armoured", "3 x 240 mm2", "36", "Thruster power"],
        ["P-011", "MSB", "Bilge pump 1", "Flame retardant, armoured", "3 x 10 mm2", "14", "Pump power"],
        ["P-012", "MSB", "Fire pump 1", "Flame retardant, armoured", "3 x 16 mm2", "16", "Pump power"],
        ["P-013", "MSB", "ESB", "Fire resistant, armoured", "3 x 70 mm2", "42", "Interconnector"],
        ["P-020", "EG", "ESB", "Fire resistant, armoured", "3 x 50 mm2", "6", "Emergency generator power"],
        ["P-021", "ESB", "Emergency fire pump", "Fire resistant, armoured", "3 x 16 mm2", "33", "Pump power"],
        ["P-022", "ESB", "Steering gear 2", "Fire resistant, armoured", "3 x 10 mm2", "38", "Steering power"],
        ["L-101", "LDB", "Accommodation lighting", "Flame retardant", "3 x 2.5 mm2", "65", "Lighting"],
        ["S-201", "Bridge LAN switch", "ECDIS workstation 1", "Screened data, Cat 6", "4 pair", "12", "Network"],
        ["S-202", "Bridge LAN switch", "ECDIS workstation 2", "Screened data, Cat 6", "4 pair", "14", "Network"],
        ["A-301", "Amplifier rack", "Weather deck loudspeakers", "Fire resistant, screened", "2 x 1.5 mm2", "85", "Public address"],
    ]
    with open(OUT / "16_Cable_Schedule.csv", "w", encoding="utf-8", newline="") as f:
        for r in rows:
            f.write(",".join(f'"{c}"' if "," in c else c for c in r) + "\r\n")
    print("  wrote 16_Cable_Schedule.csv")


# ── 19/20  Electrical specification revisions (Word, for Document Compare) ───
def electrical_spec(rev):
    b = rev == "B"
    doc_no = "EX-101-EL-SPEC-003"
    d = docx_base("ELECTRICAL SYSTEM SPECIFICATION", f"{VESSEL} ({HULL})", doc_no, rev)
    docx_table(d, ["Field", "Detail"], [["Document No.", doc_no], ["Revision", rev], ["Date", "30.06.2026" if b else "15.03.2026"]], [5, 11.5])
    sections = [
        ("1. System Description", [
            "The main distribution system is 415 V AC, 3-phase, 3-wire insulated neutral, 50 Hz. Lighting and small power are 230 V AC.",
            "Alarms and communications are supplied at 24 V DC from duplicated battery banks.",
        ]),
        ("2. Generating Plant", [
            "Three (3) main diesel generators of 250 kW (312.5 kVA) each are fitted.",
            ("The emergency generator is rated 75 kW (93.75 kVA)." if b else "The emergency generator is rated 60 kW (75 kVA)."),
            ("The emergency generator shall supply the emergency switchboard within 45 seconds of loss of main power." if b else "The emergency generator shall supply the emergency switchboard within 120 seconds of loss of main power."),
        ]),
        ("3. Distribution", [
            ("Two (2) 415/230 V dry-type transformers of 125 kVA each are provided." if b else "Two (2) 415/230 V dry-type transformers of 100 kVA each are provided."),
            "The shore connection is rated 63 A at 415 V.",
            ("Generator circuit breakers are 630 A air circuit breakers of the withdrawable type." if b else "Generator circuit breakers are 630 A air circuit breakers of the fixed type."),
        ]),
        ("4. Cables", [
            ("All cables shall be flame-retardant and low-smoke, zero-halogen to the IEC 60092-350 series." if b else "Cables in machinery spaces shall be flame-retardant. PVC general-purpose cable may be used in accommodation spaces."),
            "Emergency circuits passing through other high-risk spaces shall use fire-resistant cable.",
        ]),
        ("5. Environmental Protection", [
            "Equipment in machinery spaces shall be at least IP44.",
            ("Equipment on open decks shall be at least IP56." if b else "Equipment on open decks shall be at least IP55."),
        ]),
    ]
    for head, paras in sections:
        d.add_heading(head, level=1)
        for p in paras:
            d.add_paragraph(p)
    if b:
        d.add_heading("6. Deck Crane Supply", level=1)
        d.add_paragraph("A 55 kW feeder is added from the main switchboard for the deck crane, protected by a 125 A MCCB.")
    name = f"{19 if not b else 20}_Electrical_Spec_Rev{rev}.docx"
    d.save(OUT / name)
    print("  wrote", name)


# ── 21/22  Internal design standard (rule-book version control) ──────────────
def design_standard(version):
    v2 = version == 2
    st = cover("DESIGN STANDARD DS-100", "Shipboard Electrical Cable Installation", "EX-DS-100", str(version), "15.09.2026" if v2 else "10.01.2026")
    st += [P("1. Purpose", "h1"), P(f"This internal standard of {YARD} sets minimum requirements for the routing and installation of shipboard electrical cables, in addition to class rules and IEC 60092-352.")]
    st += [P("2. Segregation", "h1")]
    st += clauses([
        ("2.1", "Power cables and instrumentation cables running in parallel for more than 3 m shall be separated by at least " + ("150 mm" if v2 else "100 mm") + ", unless a screened tray with a continuous earth bond is used."),
        ("2.2", "Cables of duplicated essential services shall be routed separately, as far apart as practicable."),
    ])
    st += [P("3. Support", "h1")]
    st += clauses([
        ("3.1", "Cable supports on horizontal runs shall be at a maximum spacing of " + ("300 mm" if v2 else "400 mm") + "."),
        ("3.2", "Cable ties in open-deck locations shall be of stainless steel. Non-metallic ties alone are not permitted where a cable could fall during a fire."),
    ])
    st += [P("4. Penetrations", "h1")]
    st += clauses([
        ("4.1", "Bulkhead and deck penetrations shall use type-approved transit systems which maintain the fire and watertight rating of the division."),
        ("4.2", "Each transit shall have at least 20% spare capacity at delivery." if v2 else "Each transit shall have spare capacity at delivery."),
    ])
    if v2:
        st += [P("5. Open-Deck Cable Glands", "h1")]
        st += clauses([("5.1", "Cable glands on open decks shall be at least IP56, matching the equipment they serve. This clause was added after harbour-trial findings on recent projects.")])
    build_pdf(f"{21 if not v2 else 22}_Design_Standard_DS-100_v{version}.pdf", f"Design Standard DS-100 v{version}", "EX-DS-100", str(version), st)


# ── 23  Plain-text notes ─────────────────────────────────────────────────────
def notes():
    text = f"""SURVEYOR ATTENDANCE NOTES - {HULL}
{NOTICE}

Date: 16.09.2026
Attended: emergency generator blackout test, fitting-out berth.

1. First automatic start failed. The second attempt succeeded.
2. Time to energise the emergency switchboard was recorded as 58 seconds. Requirement is 45 seconds.
3. Test to be repeated after the yard checks the starting battery and the control relay.
4. Certificates for the emergency generator engine were seen and found in order.
5. The surveyor asked for the updated load analysis, since the emergency generator rating is under review.
"""
    with open(OUT / "23_Surveyor_Notes.txt", "w", encoding="utf-8", newline="\r\n") as f:
        f.write(text)
    print("  wrote 23_Surveyor_Notes.txt")


if __name__ == "__main__":
    build_specification()
    sotr()
    offer_acme()
    offer_globex()
    pots()
    binding()
    rfp()
    inspection()
    scans()
    sld_dxf("A", "12_SLD_Power_Distribution_RevA.dxf")
    sld_dxf("B", "13_SLD_Power_Distribution_RevB.dxf")
    ga_dxf()
    sld_pdf()
    cable_schedule()
    electrical_spec("A")
    electrical_spec("B")
    design_standard(1)
    design_standard(2)
    notes()
