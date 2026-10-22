/**
 * Salary Revision Letter Template & Calculations
 *
 * Implements pure calculations and deterministic HTML generation conforming to
 * TexaOne brand guidelines (Prime Blue gradients, cyan accents, Nunito Sans, zero green/violet).
 */

export interface RevisionLetterData {
  employeeRecordId?: string | number;
  employeeCode?: string;
  employeeName: string;
  designation: string;
  department?: string;
  location: string;
  documentNo: string;
  letterDate: string;
  effectiveDate: string;
  basic: number;
  da: number;
  hra: number;
  ca: number;
  signatoryName: string;
  signatoryDesignation: string;
  companyEmail: string;
  companyPhone: string;
  companyWebsite: string;
  companyAddress: string;
  signatureImageUrl?: string;
  sealImageUrl?: string;
}

export interface RevisedSalaryBreakup {
  basic: number;
  da: number;
  hra: number;
  ca: number;
  netMonthly: number;
  grossMonthly: number;
  grossAnnual: number;
}

export function calculateRevisedSalaryBreakup(
  data: Partial<RevisionLetterData>,
): RevisedSalaryBreakup {
  const basic = Number(data.basic) || 0;
  const da = Number(data.da) || 0;
  const hra = Number(data.hra) || 0;
  const ca = Number(data.ca) || 0;

  const netMonthly = basic + da + hra + ca;
  const grossMonthly = netMonthly;
  const grossAnnual = grossMonthly * 12;

  return { basic, da, hra, ca, netMonthly, grossMonthly, grossAnnual };
}

/** India financial-year label like "26-27" for a given date (FY runs Apr-Mar). */
export function getFinancialYearLabel(date: Date = new Date()): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // Month index 3 = April
  const endYear = startYear + 1;
  return `${String(startYear).slice(-2)}-${String(endYear).slice(-2)}`;
}

/** Builds the next sequential Document No. (TW/HR/REV/{FY}/{seq}). */
export function generateNextDocumentNo(
  existingDocNos: string[],
  forDate: Date = new Date(),
): string {
  const fy = getFinancialYearLabel(forDate);
  const prefix = `TW/HR/REV/${fy}/`;
  let maxSeq = 0;
  existingDocNos.forEach((docNo) => {
    if (docNo && docNo.startsWith(prefix)) {
      const seqPart = docNo.slice(prefix.length);
      const seqNum = parseInt(seqPart, 10);
      if (!Number.isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
    }
  });
  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${prefix}${nextSeq}`;
}

export function formatDocCurrency(val: number | string | undefined): string {
  if (val === undefined || val === null || val === "") return "₹ 0.00";
  const num = typeof val === "string" ? parseFloat(val) : val;
  if (isNaN(num)) return "₹ 0.00";
  return `₹ ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Renders complete 2-page Salary Revision Letter HTML conforming to
 * TexaOne Brand Theme (Prime Blue, Nunito Sans, responsive A4 pages).
 */
export function renderRevisionLetterHtml(data: RevisionLetterData): string {
  const salary = calculateRevisedSalaryBreakup(data);
  const employeeName = data.employeeName || "Employee Name";
  const designation = data.designation || "Designation";
  const location = data.location || "Chennai";
  const documentNo = data.documentNo || "TW/HR/REV/26-27/001";
  const letterDate = data.letterDate || "";
  const effectiveDate = data.effectiveDate || "";

  const signatoryName = data.signatoryName || "Amanullah Khan";
  const signatoryDesignation = data.signatoryDesignation || "Co-Founder";
  const companyEmail = data.companyEmail || "contact@texawave.com";
  const companyPhone = data.companyPhone || "+91 9361360821";
  const companyWebsite = data.companyWebsite || "www.texawave.com";
  const companyAddress =
    data.companyAddress ||
    "No. 93/206, Canal Bank Road, Indra Nagar, Adyar, Chennai – 600020";

  const header = (title: string) => `
    <div class="rev-company-header">
      <div class="rev-header-inner">
        <img src="/texawave-logo.png" alt="Company Logo" class="rev-logo" />
        <div class="rev-company-name">TEXAWAVE INNOVATIONS PRIVATE LIMITED</div>
      </div>
    </div>
    <div class="rev-title-banner">${title}</div>`;

  const footer = `
    <div class="rev-page-footer">
      <div>E-Mail: <strong>${companyEmail}</strong> | Phone: <strong>${companyPhone}</strong> | Website: <strong>${companyWebsite}</strong></div>
      <div>Address: <strong>${companyAddress}</strong></div>
    </div>`;

  const compensationTable = `
    <div class="rev-table-wrap">
      <table class="rev-table">
        <thead>
          <tr>
            <th style="width: 65%; text-align: left;">COMPONENT</th>
            <th style="width: 35%; text-align: right;">AMOUNT (INR)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Basic</td><td class="amount">${formatDocCurrency(salary.basic)}</td></tr>
          <tr><td>DA</td><td class="amount">${formatDocCurrency(salary.da)}</td></tr>
          <tr><td>HRA</td><td class="amount">${formatDocCurrency(salary.hra)}</td></tr>
          <tr><td>CA</td><td class="amount">${formatDocCurrency(salary.ca)}</td></tr>
          <tr class="rev-subtotal"><td>Net Monthly Salary</td><td class="amount">${formatDocCurrency(salary.netMonthly)}</td></tr>
          <tr class="rev-subtotal"><td>Gross Monthly CTC</td><td class="amount">${formatDocCurrency(salary.grossMonthly)}</td></tr>
          <tr class="rev-total"><td>Gross Annual CTC</td><td class="amount">${formatDocCurrency(salary.grossAnnual)}</td></tr>
        </tbody>
      </table>
    </div>`;

  return `
    <div class="revision-letter-document">
      <style>
        .revision-letter-document {
          width: 794px;
          margin: 0 auto;
          padding: 0;
          background: #ffffff;
          color: #1e293b;
          font-family: 'Nunito Sans', 'Segoe UI', system-ui, -apple-system, sans-serif;
          font-size: 13.5px;
          line-height: 1.45;
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .rev-a4-page {
          position: relative;
          width: 794px;
          height: 1123px;
          min-height: 1123px;
          max-height: 1123px;
          margin: 0 auto 24px auto;
          padding: 20px;
          box-sizing: border-box;
          background: #ffffff;
          overflow: hidden;
          page-break-after: always;
          break-after: page;
        }

        .rev-a4-page:last-child {
          margin-bottom: 0;
          page-break-after: auto;
          break-after: auto;
        }

        .rev-page-frame {
          position: relative;
          width: 100%;
          height: 100%;
          border: 2.5px solid #1769F5;
          border-radius: 8px;
          box-sizing: border-box;
          background: #ffffff;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .rev-page-layer {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-sizing: border-box;
        }

        .rev-company-header {
          flex: 0 0 auto;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 10px 20px 8px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .rev-header-inner {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
        }

        .rev-logo {
          height: 42px;
          width: auto;
          object-fit: contain;
          display: block;
        }

        .rev-company-name {
          font-size: 17px;
          font-weight: 800;
          letter-spacing: 0.5px;
          color: #1769F5;
          text-transform: uppercase;
        }

        .rev-title-banner {
          flex: 0 0 auto;
          background: linear-gradient(135deg, #0a3271 0%, #1769F5 50%, #0284c7 100%);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 5px 16px;
          font-size: 14px;
          font-weight: 800;
          letter-spacing: 2px;
          text-transform: uppercase;
          box-sizing: border-box;
        }

        .rev-page-content {
          flex: 1 1 auto;
          padding: 12px 24px 10px;
          box-sizing: border-box;
          overflow: visible;
          display: flex;
          flex-direction: column;
        }

        .rev-meta-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .rev-meta-row span.value {
          color: #1769F5;
          font-weight: 800;
        }

        .rev-to-block {
          margin-bottom: 8px;
          border: 1px solid #bae6fd;
          border-radius: 6px;
          padding: 6px 12px;
          background: #f0f9ff;
          font-size: 13px;
        }

        .rev-to-block .rev-label {
          color: #0284c7;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 11px;
        }

        .rev-to-block .rev-name {
          font-weight: 800;
          text-transform: uppercase;
          color: #0f172a;
          font-size: 13.5px;
        }

        .rev-to-block .rev-designation {
          font-weight: 600;
          color: #475569;
        }

        .rev-paragraph {
          margin: 0 0 6px;
          font-size: 13.5px;
          line-height: 1.45;
          color: #1e293b;
          text-align: justify;
        }

        .rev-signoff {
          margin-top: 10px;
          font-size: 13.5px;
        }

        .rev-signoff .rev-for-line {
          font-weight: 800;
          color: #0f172a;
          margin-bottom: 2px;
        }

        .rev-signoff .rev-sign-name {
          font-weight: 800;
          color: #0f172a;
        }

        .rev-signoff .rev-sign-designation {
          color: #0284c7;
          font-weight: 700;
          font-size: 12px;
        }

        .rev-annexure-subtitle {
          text-align: center;
          font-weight: 800;
          font-size: 13.5px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #ffffff;
          background: linear-gradient(135deg, #0a3271 0%, #1769F5 50%, #0284c7 100%);
          border-radius: 4px;
          padding: 4px 8px;
          margin: 8px 0 6px;
          box-sizing: border-box;
        }

        .rev-info-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 8px;
          font-size: 13px;
          border: 1px solid #93c5fd;
          border-radius: 4px;
          overflow: hidden;
        }

        .rev-info-table td {
          border: 1px solid #93c5fd;
          padding: 4px 10px;
          box-sizing: border-box;
        }

        .rev-info-table td.rev-info-label {
          width: 30%;
          font-weight: 700;
          background: #f0f9ff;
          color: #0f172a;
        }

        .rev-table-wrap {
          border: 1px solid #93c5fd;
          border-radius: 4px;
          overflow: hidden;
          margin: 4px 0 6px;
          box-sizing: border-box;
        }

        .rev-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          background: #ffffff;
        }

        .rev-table th,
        .rev-table td {
          padding: 4.5px 10px;
          border-right: 1px solid #93c5fd;
          border-bottom: 1px solid #93c5fd;
          vertical-align: middle;
          box-sizing: border-box;
        }

        .rev-table th:last-child,
        .rev-table td:last-child {
          border-right: 0;
        }

        .rev-table tr:last-child td {
          border-bottom: 0;
        }

        .rev-table thead {
          background: linear-gradient(135deg, #0a3271 0%, #1769F5 50%, #0284c7 100%);
        }

        .rev-table thead th {
          color: #ffffff;
          font-weight: 800;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        .rev-table .amount {
          text-align: right;
          font-weight: 700;
          color: #0f172a;
        }

        .rev-table .rev-subtotal td {
          background: #f0f9ff;
          font-weight: 700;
          color: #0f172a;
        }

        .rev-table .rev-total {
          background: linear-gradient(135deg, #0a3271 0%, #1769F5 50%, #0284c7 100%);
          color: #ffffff !important;
          font-weight: 800;
          font-size: 13px;
        }

        .rev-table .rev-total td {
          color: #ffffff !important;
        }

        .rev-acceptance-title {
          text-align: center;
          font-weight: 800;
          font-size: 13.5px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
          color: #ffffff;
          background: linear-gradient(135deg, #0a3271 0%, #1769F5 50%, #0284c7 100%);
          border-radius: 4px;
          padding: 5px 12px;
          margin-bottom: 12px;
        }

        .rev-acceptance-line {
          margin: 18px 0 0;
          font-size: 13px;
          font-weight: 700;
          width: 60%;
        }

        .rev-page-footer {
          flex: 0 0 auto;
          text-align: center;
          font-size: 11px;
          color: #475569;
          border-top: 1px solid #bae6fd;
          padding: 6px 14px;
          box-sizing: border-box;
          background: #f8fafc;
          line-height: 1.4;
        }

        @media print {
          @page { size: A4 portrait; margin: 0; }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }
          .revision-letter-document {
            width: 794px !important;
            margin: 0 !important;
          }
          .rev-a4-page {
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      </style>

      <!-- PAGE 1: Cover Letter + Annexure A flow -->
      <section class="rev-a4-page" data-rev-page="1">
        <div class="rev-page-frame">
          <div class="rev-page-layer">
            <div>
              ${header("SALARY REVISION LETTER")}
              <div class="rev-page-content">
                <div class="rev-meta-row">
                  <div>Document No: <span class="value">${documentNo}</span></div>
                  <div>Date: <span class="value">${letterDate}</span></div>
                </div>

                <div class="rev-to-block">
                  <div class="rev-label">To,</div>
                  <div class="rev-name">${employeeName}</div>
                  <div class="rev-designation">${designation}</div>
                </div>

                <p class="rev-paragraph">Dear <strong>${employeeName}</strong>,</p>
                <p class="rev-paragraph">We are pleased to inform you that, based on your performance, commitment, and contribution to TexaWave Innovations Private Limited, Management has approved a revision of your compensation package.</p>
                <p class="rev-paragraph">Your revised salary structure shall be effective from <strong>${effectiveDate}</strong>.</p>
                <p class="rev-paragraph">The details of your revised compensation package are enclosed as Annexure A to this letter.</p>
                <p class="rev-paragraph">Please note that the compensation details contained in this letter are strictly confidential and should not be disclosed to any unauthorized person.</p>
                <p class="rev-paragraph">All other terms and conditions of your employment remain unchanged.</p>
                <p class="rev-paragraph">We appreciate your contribution and wish you continued success with the organization.</p>

                <div class="rev-signoff">
                  <p class="rev-for-line">For TEXAWAVE INNOVATIONS PRIVATE LIMITED</p>
                  ${
                    data.signatureImageUrl
                      ? `<img src="${data.signatureImageUrl}" alt="Signature" style="height: 36px; object-fit: contain; margin: 2px 0;" />`
                      : ""
                  }
                  <p class="rev-sign-name">${signatoryName}</p>
                  <p class="rev-sign-designation">${signatoryDesignation}</p>
                  ${
                    data.sealImageUrl
                      ? `<img src="${data.sealImageUrl}" alt="Seal" style="height: 44px; object-fit: contain; margin-top: 2px; opacity: 0.9;" />`
                      : ""
                  }
                </div>

                <div style="margin-top: 10px;">
                  <div class="rev-annexure-subtitle">Revised Compensation Structure</div>
                  <table class="rev-info-table">
                    <tbody>
                      <tr><td class="rev-info-label">Name</td><td><strong>${employeeName}</strong></td></tr>
                      <tr><td class="rev-info-label">Designation</td><td>${designation}</td></tr>
                      <tr><td class="rev-info-label">Effective Date</td><td><strong>${effectiveDate}</strong></td></tr>
                      <tr><td class="rev-info-label">Location</td><td>${location}</td></tr>
                    </tbody>
                  </table>
                  ${compensationTable}
                </div>
              </div>
            </div>
            ${footer}
          </div>
        </div>
      </section>

      <!-- PAGE 2: Signatory + Employee Acceptance -->
      <section class="rev-a4-page" data-rev-page="2">
        <div class="rev-page-frame">
          <div class="rev-page-layer">
            <div>
              ${header("SALARY REVISION LETTER")}
              <div class="rev-page-content" style="padding-top: 24px;">
                <div class="rev-signoff" style="margin-top: 10px;">
                  <p class="rev-for-line" style="margin-bottom: 16px;">For TexaWave Innovations Pvt Ltd,</p>
                  ${
                    data.signatureImageUrl
                      ? `<img src="${data.signatureImageUrl}" alt="Signature" style="height: 48px; object-fit: contain; margin-bottom: 6px;" />`
                      : `<div style="height: 36px;"></div>`
                  }
                  <p class="rev-sign-name">${signatoryName}</p>
                  <p class="rev-sign-designation">${signatoryDesignation}</p>
                  ${
                    data.sealImageUrl
                      ? `<img src="${data.sealImageUrl}" alt="Seal" style="height: 56px; object-fit: contain; margin-top: 8px; opacity: 0.9;" />`
                      : ""
                  }
                </div>

                <div style="margin-top: 36px;">
                  <div class="rev-acceptance-title">Employee Acceptance</div>
                  <p class="rev-paragraph">I acknowledge receipt of this Salary Revision Letter and accept the revised compensation structure and related terms and conditions.</p>

                  <div class="rev-acceptance-line">Name: ____________________________________</div>
                  <div class="rev-acceptance-line">Signature: _________________________________</div>
                  <div class="rev-acceptance-line">Date: ____________________________________</div>
                </div>
              </div>
            </div>
            ${footer}
          </div>
        </div>
      </section>
    </div>
  `;
}
