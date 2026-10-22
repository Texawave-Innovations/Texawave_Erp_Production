"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import { printOfferLetter } from "../utils";

export interface OfferLetterDocumentData {
  candidateName: string;
  role: string;
  location: string;
  reportingManager?: string;
  offerDate: string;
  joiningDate: string;
  offerValidityDate?: string;
  components: {
    basic: string | number;
    da: string | number;
    hra: string | number;
    ca: string | number;
  };
  grossMonthly?: string | number;
  grossAnnual?: string | number;
  workScheduleMonFri?: string;
  workScheduleSat?: string;
  workScheduleSun?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyAddress?: string;
  signatureImageUrl?: string;
  sealImageUrl?: string;
}

export interface OfferLetterDocumentProps {
  data: OfferLetterDocumentData;
  onPrint?: () => void;
  className?: string;
}

/** Formats number with Indian comma grouping: ₹ 25,000 / ₹ 5,16,000 */
export function formatDocRupees(amount: number | string | undefined): string {
  if (amount === undefined || amount === null || amount === "") return "₹ 0";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹ 0";
  const intVal = Math.round(num);
  return `₹ ${intVal.toLocaleString("en-IN")}`;
}

/** Formats dates as DD/MM/YYYY conforming to reference PDF */
export function formatDocDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateStr)) return dateStr;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (match && match[1] && match[2] && match[3]) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Logo using texawave-logo.png from public folder with original prominent size */
function TexaLogo() {
  return (
    <div className="flex items-center shrink-0">
      <img
        src="/texawave-logo.png"
        alt="TEXAWAVE"
        className="h-10 sm:h-11 md:h-12 w-auto object-contain"
      />
    </div>
  );
}

/**
 * Exact Offer Letter Document reproducing reference layout
 * Features two-page layout, brand blue accent borders, table formats, and legal acceptance clauses.
 */
export function OfferLetterDocument({
  data,
  onPrint,
  className = "",
}: OfferLetterDocumentProps) {
  const [activePage, setActivePage] = useState<"1" | "2" | "all">("all");

  const candidateName = data.candidateName.trim() || "CANDIDATE NAME";
  const candidateFirstName = data.candidateName.trim()
    ? (candidateName.split(/\s+/)[0] || candidateName)
    : "Candidate Name";
  const role = data.role.trim() || "DESIGNATION";
  const location = data.location.trim() || "Chennai";
  const reportingManager =
    data.reportingManager?.trim() || "Mr. Nithyanandan Ramaraj";

  const offerDateFormatted =
    formatDocDate(data.offerDate) || formatDocDate(new Date().toISOString());
  const joiningDateFormatted = formatDocDate(data.joiningDate) || "";
  const offerValidityFormatted =
    formatDocDate(data.offerValidityDate) || "26/10/2026";

  const basicNum = Number(data.components.basic) || 0;
  const daNum = Number(data.components.da) || 0;
  const hraNum = Number(data.components.hra) || 0;
  const caNum = Number(data.components.ca) || 0;

  const netMonthlyNum =
    Number(data.grossMonthly) || basicNum + daNum + hraNum + caNum || 0;
  const grossAnnualNum =
    Number(data.grossAnnual) || netMonthlyNum * 12 || 0;

  const workScheduleMonFri = data.workScheduleMonFri || "10:00 AM – 7:00 PM";
  const workScheduleSat = data.workScheduleSat || "10:00 AM – 7:00 PM";
  const workScheduleSun = data.workScheduleSun || "Week Off";

  const signatoryName = data.signatoryName || "Amanullah Khan";
  const signatoryDesignation = data.signatoryDesignation || "Co-Founder";

  const companyEmail = data.companyEmail || "contact@texawave.com";
  const companyPhone = data.companyPhone || "+91 9361360821";
  const companyWebsite = data.companyWebsite || "www.texawave.com";
  const companyAddress =
    data.companyAddress ||
    "No. 93/206, Canal Bank Road, Indra Nagar, Adyar, Chennai – 600020";

  function handleDownload() {
    if (onPrint) {
      onPrint();
    } else {
      printOfferLetter("offer-letter-printable-content");
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Print Controls / Page Switcher (Hidden in print mode) matching Image 5 */}
      <div className="no-print flex items-center justify-between rounded-xl border border-gray-200 bg-white p-2.5 shadow-xs dark:border-gray-800 dark:bg-gray-800">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-brand-500" />
          <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
            View Page:
          </span>
          <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setActivePage("all")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                activePage === "all"
                  ? "bg-white text-brand-600 shadow-xs dark:bg-gray-800 dark:text-cyan-400"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All (2 Pages)
            </button>
            <button
              type="button"
              onClick={() => setActivePage("1")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                activePage === "1"
                  ? "bg-white text-brand-600 shadow-xs dark:bg-gray-800 dark:text-cyan-400"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Page 1
            </button>
            <button
              type="button"
              onClick={() => setActivePage("2")}
              className={`rounded-md px-3 py-1 font-semibold transition-all ${
                activePage === "2"
                  ? "bg-white text-brand-600 shadow-xs dark:bg-gray-800 dark:text-cyan-400"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Page 2
            </button>
          </div>
        </div>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 text-theme-xs font-semibold text-brand-600 hover:text-brand-700 hover:bg-brand-50 border-brand-200"
        >
          <Download className="h-3.5 w-3.5" />
          Download PDF / Print
        </Button>
      </div>

      {/* Embedded CSS for Exact A4 Pagination and High-Fidelity Printing */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 0;
          }
          body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .printable-doc-root {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .doc-page {
            width: 210mm !important;
            min-height: 297mm !important;
            height: 297mm !important;
            page-break-after: always !important;
            page-break-inside: avoid !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            padding: 12mm 14mm !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .doc-page:last-child {
            page-break-after: auto !important;
          }
        }
      `,
        }}
      />

      {/* Document Root Container */}
      <div
        id="offer-letter-printable-content"
        className="printable-doc-root flex flex-col gap-6"
      >
        {/* ================= PAGE 1 ================= */}
        <div
          className={`doc-page relative mx-auto w-full max-w-[210mm] flex-col justify-between rounded-lg border-[2.5px] border-brand-500 bg-white p-6 sm:p-8 md:p-10 text-gray-900 shadow-md font-sans ${
            activePage === "2" ? "hidden" : "flex"
          }`}
        >
            {/* Top Company Header (Single line with full logo) */}
            <div>
              <div className="flex items-center justify-center gap-2 sm:gap-3 border-b border-transparent pb-3">
                <TexaLogo />
                <h1 className="text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-wide text-brand-600 dark:text-sky-400 whitespace-nowrap uppercase">
                  TEXAWAVE INNOVATIONS PRIVATE LIMITED
                </h1>
              </div>

              {/* Title Banner (Table Header Gradient) */}
              <div className="mt-1 rounded-md bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] py-1 text-center shadow-xs">
                <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-white uppercase">
                  OFFER LETTER
                </span>
              </div>

              {/* Issue Date (Right Aligned) */}
              <div className="mt-3 flex justify-end text-xs sm:text-sm">
                <span className="font-bold text-gray-900">
                  Date:{" "}
                  <span className="font-bold text-brand-600">
                    {offerDateFormatted}
                  </span>
                </span>
              </div>

              {/* Framed Recipient Box */}
              <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/20 p-3 text-xs sm:text-sm">
                <div className="font-bold text-brand-600 text-xs">TO</div>
                <div className="font-extrabold uppercase text-gray-900 text-sm">
                  {candidateName}
                </div>
                <div className="text-gray-700">{location}</div>
              </div>

              {/* Subject Line & Salutation */}
              <div className="mt-3 text-xs sm:text-sm">
                <div className="font-bold text-gray-900">
                  Subject:{" "}
                  <span className="font-semibold">Offer of Employment</span>
                </div>
                <div className="mt-2 font-bold text-gray-900">
                  Dear {candidateFirstName},
                </div>
                <p className="mt-1.5 text-justify text-xs sm:text-sm leading-relaxed text-gray-800">
                  We are pleased to extend this formal offer of employment for
                  the position of{" "}
                  <span className="font-bold uppercase text-gray-900">
                    {role}
                  </span>{" "}
                  at TexaWave Innovations Pvt Ltd. We were impressed with your
                  background, experience, and the strengths you bring, and we
                  believe you will make a strong contribution to the
                  organization.
                </p>
                <p className="mt-1 text-justify text-xs sm:text-sm leading-relaxed text-gray-800">
                  This offer outlines the terms and conditions governing your
                  employment with us. Please read this document carefully.
                </p>
              </div>

              {/* 1. POSITION & REPORTING STRUCTURE */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  1. POSITION & REPORTING STRUCTURE
                </div>
                <div className="mt-1 text-xs sm:text-sm space-y-0.5 text-gray-800 leading-normal">
                  <p>
                    You will be appointed as{" "}
                    <span className="font-semibold text-gray-900">
                      {role === "DESIGNATION" ? "Designation" : role}
                    </span>
                    .
                  </p>
                  <p>
                    You will report directly to{" "}
                    <span className="font-bold text-gray-900">
                      {reportingManager}
                    </span>
                    .
                  </p>
                  <p className="text-justify">
                    You agree to diligently perform the duties assigned to you,
                    comply with all company policies, and act in the best
                    interests of the Company at all times.
                  </p>
                </div>
              </div>

              {/* 2. DATE OF JOINING */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  2. DATE OF JOINING
                </div>
                <div className="mt-1 text-xs sm:text-sm space-y-0.5 text-gray-800 leading-normal">
                  <p>
                    Your joining date will be{" "}
                    <span className="font-bold text-gray-900">
                      {joiningDateFormatted}
                    </span>
                    .
                  </p>
                  <p className="text-justify">
                    If you are unable to join on this date, you must notify the
                    Company immediately. Any change in the date of joining is
                    subject to management approval.
                  </p>
                </div>
              </div>

              {/* 3. COMPENSATION STRUCTURE */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  3. COMPENSATION STRUCTURE
                </div>
                <p className="mt-1 text-xs sm:text-sm text-gray-800 leading-normal">
                  Your Annual Cost to Company (CTC) will be{" "}
                  <span className="font-bold text-gray-900">
                    {formatDocRupees(grossAnnualNum)} per annum
                  </span>
                  . This amount includes fixed salary components and applicable
                  allowances.
                </p>

                {/* Compensation Table with Table Header Gradient */}
                <div className="mt-2 overflow-hidden rounded border border-brand-200">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] text-white">
                        <th className="py-1 px-3 text-left font-bold tracking-wider">
                          COMPONENT
                        </th>
                        <th className="py-1 px-3 text-right font-bold tracking-wider">
                          AMOUNT (INR)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100 text-gray-800">
                      <tr>
                        <td className="py-1 px-3 font-medium">Basic</td>
                        <td className="py-1 px-3 text-right font-semibold">
                          {formatDocRupees(basicNum)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 font-medium">DA</td>
                        <td className="py-1 px-3 text-right font-semibold">
                          {formatDocRupees(daNum)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 font-medium">HRA</td>
                        <td className="py-1 px-3 text-right font-semibold">
                          {formatDocRupees(hraNum)}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 font-medium">
                          CA (Conveyance Allowance)
                        </td>
                        <td className="py-1 px-3 text-right font-semibold">
                          {formatDocRupees(caNum)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50/70 font-semibold">
                        <td className="py-1 px-3 text-gray-900">
                          Net Monthly Salary
                        </td>
                        <td className="py-1 px-3 text-right text-gray-900 font-bold">
                          {formatDocRupees(netMonthlyNum)}
                        </td>
                      </tr>
                      <tr className="bg-gray-50/70 font-semibold">
                        <td className="py-1 px-3 text-gray-900">
                          Gross Monthly CTC
                        </td>
                        <td className="py-1 px-3 text-right text-gray-900 font-bold">
                          {formatDocRupees(netMonthlyNum)}
                        </td>
                      </tr>
                      <tr className="bg-linear-to-r from-[#0a3271] to-[#1769F5] font-extrabold text-white">
                        <td className="py-1.5 px-3 uppercase tracking-wider">
                          GROSS ANNUAL CTC
                        </td>
                        <td className="py-1.5 px-3 text-right text-sm">
                          {formatDocRupees(grossAnnualNum)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Page 1 Footer */}
            <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-600 space-y-0.5">
              <div>
                E-Mail:{" "}
                <span className="font-medium text-gray-800">
                  {companyEmail}
                </span>{" "}
                | Phone:{" "}
                <span className="font-medium text-gray-800">
                  {companyPhone}
                </span>{" "}
                | Website:{" "}
                <span className="font-medium text-gray-800">
                  {companyWebsite}
                </span>
              </div>
              <div>
                Address:{" "}
                <span className="font-medium text-gray-800">
                  {companyAddress}
                </span>
              </div>
            </div>
          </div>

        {/* ================= PAGE 2 ================= */}
        <div
          className={`doc-page relative mx-auto w-full max-w-[210mm] flex-col justify-between rounded-lg border-[2.5px] border-brand-500 bg-white p-6 sm:p-8 md:p-10 text-gray-900 shadow-md font-sans ${
            activePage === "1" ? "hidden" : "flex"
          }`}
        >
            <div>
              {/* Header on Page 2 (Single line with full logo) */}
              <div className="flex items-center justify-center gap-2 sm:gap-3 border-b border-transparent pb-3">
                <TexaLogo />
                <h2 className="text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-wide text-brand-600 dark:text-sky-400 whitespace-nowrap uppercase">
                  TEXAWAVE INNOVATIONS PRIVATE LIMITED
                </h2>
              </div>

              {/* 4. WORKING HOURS & EMPLOYMENT TYPE */}
              <div className="mt-2">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  4. WORKING HOURS & EMPLOYMENT TYPE
                </div>
                <p className="mt-1 text-xs sm:text-sm text-gray-800 leading-normal">
                  You will be employed as a{" "}
                  <span className="font-bold text-gray-900">
                    Full-Time Employee
                  </span>
                  .
                </p>

                {/* Working hours table with Table Header Gradient */}
                <div className="mt-2 overflow-hidden rounded border border-brand-200 max-w-lg">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] text-white">
                        <th className="py-1 px-3 text-left font-bold tracking-wider">
                          DAY
                        </th>
                        <th className="py-1 px-3 text-left font-bold tracking-wider">
                          INDIAN STANDARD TIME (IST)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-100 text-gray-800">
                      <tr>
                        <td className="py-1 px-3 font-semibold">
                          Monday – Friday
                        </td>
                        <td className="py-1 px-3 font-medium">
                          {workScheduleMonFri}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 font-semibold">Saturday</td>
                        <td className="py-1 px-3 font-medium">
                          {workScheduleSat}
                        </td>
                      </tr>
                      <tr>
                        <td className="py-1 px-3 font-semibold">Sunday</td>
                        <td className="py-1 px-3 font-medium">
                          {workScheduleSun}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 5. PROBATION PERIOD */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  5. PROBATION PERIOD
                </div>
                <div className="mt-1 text-xs sm:text-sm space-y-0.5 text-gray-800 leading-normal">
                  <p>
                    You will be on probation for a period of{" "}
                    <span className="font-bold text-gray-900">3 months</span>{" "}
                    from your date of joining.
                  </p>
                  <p>Your performance and conduct will be evaluated.</p>
                  <p>The Company may extend the probation period if needed.</p>
                  <p>
                    Confirmation of employment will be communicated in writing
                    after successful completion.
                  </p>
                </div>
              </div>

              {/* 6. CODE OF CONDUCT & COMPANY POLICIES */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  6. CODE OF CONDUCT & COMPANY POLICIES
                </div>
                <p className="mt-1 text-justify text-xs sm:text-sm text-gray-800 leading-normal">
                  You must strictly follow all TexaWave policies, including IT
                  Usage, Attendance & Leave, Harassment Prevention, Data
                  Protection, and Confidentiality.
                </p>
              </div>

              {/* 7. CONFIDENTIALITY & IP OWNERSHIP */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  7. CONFIDENTIALITY & IP OWNERSHIP
                </div>
                <p className="mt-1 text-justify text-xs sm:text-sm text-gray-800 leading-normal">
                  During employment, any code, technical documents, designs, or
                  products created remain the exclusive intellectual property of
                  TexaWave Innovations Pvt Ltd.
                </p>
              </div>

              {/* 8. BACKGROUND VERIFICATION */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  8. BACKGROUND VERIFICATION
                </div>
                <p className="mt-1 text-justify text-xs sm:text-sm text-gray-800 leading-normal">
                  This offer is subject to satisfactory background verification
                  of education, identity documents, and previous employment
                  records.
                </p>
              </div>

              {/* 9. NOTICE PERIOD & TERMINATION CLAUSE */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  9. NOTICE PERIOD & TERMINATION CLAUSE
                </div>
                <div className="mt-1 text-xs sm:text-sm space-y-0.5 text-gray-800 leading-normal">
                  <p>
                    <span className="font-bold text-gray-900">
                      During Probation:
                    </span>{" "}
                    Either party may terminate employment with 15 days notice.
                  </p>
                  <p>
                    <span className="font-bold text-gray-900">
                      After Confirmation:
                    </span>{" "}
                    Either party may terminate employment with 60 days written
                    notice or salary in lieu of notice.
                  </p>
                </div>
              </div>

              {/* 10. OFFER VALIDITY */}
              <div className="mt-3">
                <div className="rounded bg-linear-to-r from-[#0a3271] to-[#1769F5] px-3 py-0.5 text-xs font-bold uppercase tracking-wider text-white">
                  10. OFFER VALIDITY
                </div>
                <p className="mt-1 text-xs sm:text-sm text-gray-800 leading-normal">
                  This offer remains valid until{" "}
                  <span className="font-bold text-gray-900">
                    {offerValidityFormatted}
                  </span>
                  . Please sign and return the duplicate copy as acceptance.
                </p>
              </div>

              {/* Signatures & Acceptance Framed Section */}
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Left Box: Company Signatory */}
                <div className="relative rounded-lg border border-brand-200 bg-brand-50/20 p-3.5 text-xs sm:text-sm">
                  <div className="font-semibold text-gray-800">
                    For TexaWave Innovations Pvt Ltd,
                  </div>
                  <div className="relative my-2 min-h-11 flex items-center">
                    {data.signatureImageUrl ? (
                      <img
                        src={data.signatureImageUrl}
                        alt="Signature"
                        className="h-10 max-w-30 object-contain"
                      />
                    ) : (
                      <div className="font-serif italic text-base font-bold text-brand-600">
                        {signatoryName}
                      </div>
                    )}
                    {data.sealImageUrl ? (
                      <img
                        src={data.sealImageUrl}
                        alt="Company Seal"
                        className="absolute right-0 top-0 h-12 w-12 object-contain opacity-90"
                      />
                    ) : null}
                  </div>
                  <div className="font-bold text-gray-900">{signatoryName}</div>
                  <div className="text-xs text-brand-600 font-semibold">
                    {signatoryDesignation}
                  </div>
                </div>

                {/* Right Box: Acceptance of Offer */}
                <div className="rounded-lg border border-brand-200 bg-brand-50/20 p-3.5 text-xs sm:text-sm flex flex-col justify-between">
                  <div className="text-center font-bold tracking-wider text-brand-600 uppercase text-xs">
                    ACCEPTANCE OF OFFER
                  </div>
                  <div className="mt-3 space-y-2 text-xs">
                    <div>Signature: _______________________</div>
                    <div>Date: _______________________</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Page 2 Footer */}
            <div className="mt-6 border-t border-gray-200 pt-3 text-center text-[10px] text-gray-600 space-y-0.5">
              <div>
                E-Mail:{" "}
                <span className="font-medium text-gray-800">
                  {companyEmail}
                </span>{" "}
                | Phone:{" "}
                <span className="font-medium text-gray-800">
                  {companyPhone}
                </span>{" "}
                | Website:{" "}
                <span className="font-medium text-gray-800">
                  {companyWebsite}
                </span>
              </div>
              <div>
                Address:{" "}
                <span className="font-medium text-gray-800">
                  {companyAddress}
                </span>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
