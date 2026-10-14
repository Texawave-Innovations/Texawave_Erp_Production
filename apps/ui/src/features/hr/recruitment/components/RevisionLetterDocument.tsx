"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";

export interface RevisionLetterDocumentData {
  documentNo?: string;
  employeeName: string;
  employeeCode?: string;
  designation: string;
  department?: string;
  location: string;
  letterDate: string;
  effectiveDate: string;
  revisionType?: string;
  currentComponents?: {
    basic: string | number;
    da: string | number;
    hra: string | number;
    ca: string | number;
  };
  components: {
    basic: string | number;
    da: string | number;
    hra: string | number;
    ca: string | number;
  };
  signatoryName?: string;
  signatoryDesignation?: string;
  companyEmail?: string;
  companyPhone?: string;
  companyWebsite?: string;
  companyAddress?: string;
}

export interface RevisionLetterDocumentProps {
  data: RevisionLetterDocumentData;
  onPrint?: () => void;
  className?: string;
}

/** Formats number with Indian comma grouping: ₹ 5,250 / ₹ 1,80,000 */
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

function TexaLogo() {
  return (
    <div className="flex items-center gap-1.5">
      <svg
        viewBox="0 0 100 32"
        className="h-8 w-auto"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M6 6H26V11H18.5V26H13.5V11H6V6Z" fill="#439234" />
        <path
          d="M29 6H44V11H34.5V13.5H42.5V18.5H34.5V21H44V26H29V6Z"
          fill="#439234"
        />
        <path
          d="M46 6L53.5 16L46 26H52L56.5 20L61 26H67L59.5 16L67 6H61L56.5 12L52 6H46Z"
          fill="#78b449"
        />
        <path
          d="M74 6L67 26H72.5L74.5 20H81.5L83.5 26H89L82 6H74ZM76 15.5L78 9.5L80 15.5H76Z"
          fill="#439234"
        />
      </svg>
    </div>
  );
}

/**
 * Exact Salary Revision Letter Document reproducing Revision_Letter_Keerthivasan.pdf
 * Features two-page layout, green border, employee information table, compensation breakdown, and employee acceptance.
 */
export function RevisionLetterDocument({
  data,
  onPrint,
  className = "",
}: RevisionLetterDocumentProps) {
  const [activePage, setActivePage] = useState<"1" | "2" | "all">("all");

  const employeeName = data.employeeName.trim() || "Keerthivasan";
  const employeeFirstName = employeeName.split(/\s+/)[0] || employeeName;
  const designation = data.designation.trim() || "Mechanical Design-Trainee";
  const location = data.location.trim() || "Chennai";
  const documentNo = data.documentNo?.trim() || "TW/HR/REV/26-27/001";

  const letterDateFormatted = formatDocDate(data.letterDate) || "08/09/2026";
  const effectiveDateFormatted =
    formatDocDate(data.effectiveDate) || "01/10/2026";

  const basicNum = Number(data.components.basic) || 5250;
  const daNum = Number(data.components.da) || 2250;
  const hraNum = Number(data.components.hra) || 4500;
  const caNum = Number(data.components.ca) || 3000;

  const netMonthlyNum = basicNum + daNum + hraNum + caNum || 15000;
  const grossMonthlyNum = netMonthlyNum;
  const grossAnnualNum = grossMonthlyNum * 12 || 180000;

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
      window.print();
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Print Controls / Page Switcher (Hidden in print mode) */}
      <div className="no-print flex items-center justify-between rounded-lg border border-gray-200 bg-white p-2.5 shadow-sm dark:border-gray-800 dark:bg-gray-800">
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-[#439234]" />
          <span className="text-theme-xs font-semibold text-gray-700 dark:text-gray-300">
            View Page:
          </span>
          <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5 text-theme-xs dark:border-gray-700 dark:bg-gray-900">
            <button
              type="button"
              onClick={() => setActivePage("all")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activePage === "all"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              All (2 Pages)
            </button>
            <button
              type="button"
              onClick={() => setActivePage("1")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activePage === "1"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              Page 1
            </button>
            <button
              type="button"
              onClick={() => setActivePage("2")}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                activePage === "2"
                  ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-white"
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
          className="inline-flex items-center gap-1.5 text-theme-xs font-medium"
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
      <div className="printable-doc-root flex flex-col gap-6">
        {/* ================= PAGE 1 ================= */}
        {(activePage === "all" || activePage === "1") && (
          <div className="doc-page relative mx-auto flex w-full max-w-[210mm] flex-col justify-between rounded-lg border-[2.5px] border-[#5aa846] bg-white p-8 text-gray-900 shadow-md sm:p-10 font-sans">
            <div>
              {/* Header */}
              <div className="flex items-center justify-center gap-2 border-b border-transparent pb-3">
                <TexaLogo />
                <h1 className="text-base sm:text-lg font-extrabold tracking-wide text-[#439234]">
                  TEXAWAVE INNOVATIONS PRIVATE LIMITED
                </h1>
              </div>

              {/* Title Banner */}
              <div className="mt-1 rounded-md bg-[#78b449] py-1 text-center shadow-xs">
                <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-white uppercase">
                  SALARY REVISION LETTER
                </span>
              </div>

              {/* Document No & Date Row */}
              <div className="mt-3 flex items-center justify-between text-xs sm:text-sm">
                <div>
                  <span className="font-bold text-gray-900">Document No: </span>
                  <span className="font-bold text-[#439234]">{documentNo}</span>
                </div>
                <div>
                  <span className="font-bold text-gray-900">Date: </span>
                  <span className="font-bold text-[#439234]">
                    {letterDateFormatted}
                  </span>
                </div>
              </div>

              {/* Framed Recipient Box */}
              <div className="mt-2.5 rounded-lg border border-[#78b449] bg-[#fbfdfa] p-3 text-xs sm:text-sm">
                <div className="font-bold text-[#439234] text-xs">TO,</div>
                <div className="font-extrabold uppercase text-gray-900 text-sm">
                  {employeeName}
                </div>
                <div className="text-gray-700">{designation}</div>
              </div>

              {/* Salutation & Body Text */}
              <div className="mt-3 text-xs sm:text-sm space-y-2 text-gray-800 leading-relaxed text-justify">
                <div className="font-bold text-gray-900">
                  Dear {employeeFirstName},
                </div>
                <p>
                  We are pleased to inform you that, based on your performance,
                  commitment, and contribution to TexaWave Innovations Private
                  Limited, Management has approved a revision of your
                  compensation package.
                </p>
                <p>
                  Your revised salary structure shall be effective from{" "}
                  <span className="font-bold text-gray-900">
                    {effectiveDateFormatted}
                  </span>
                  .
                </p>
                <p>
                  The details of your revised compensation package are enclosed
                  as Annexure A to this letter.
                </p>
                <p>
                  Please note that the compensation details contained in this
                  letter are strictly confidential and should not be disclosed
                  to any unauthorized person.
                </p>
                <p>
                  All other terms and conditions of your employment remain
                  unchanged.
                </p>
                <p>
                  We appreciate your contribution and wish you continued success
                  with the organization.
                </p>
              </div>

              {/* Company Representative Block */}
              <div className="mt-3 text-xs sm:text-sm">
                <div className="font-bold text-gray-900">
                  For TEXAWAVE INNOVATIONS PRIVATE LIMITED
                </div>
                <div className="font-bold text-gray-900 mt-1">
                  {signatoryName}
                </div>
                <div className="font-semibold text-[#439234] text-xs">
                  {signatoryDesignation}
                </div>
              </div>

              {/* REVISED COMPENSATION STRUCTURE Header */}
              <div className="mt-4 rounded bg-[#78b449] py-1 text-center shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  REVISED COMPENSATION STRUCTURE
                </span>
              </div>

              {/* Employee Information Table */}
              <div className="mt-2 overflow-hidden rounded border border-[#78b449]">
                <table className="w-full border-collapse text-xs">
                  <tbody className="divide-y divide-[#78b449]/40 text-gray-800">
                    <tr>
                      <td className="w-1/3 bg-[#fbfdfa] py-1 px-3 font-bold text-gray-900 border-r border-[#78b449]/40">
                        Name
                      </td>
                      <td className="py-1 px-3 font-semibold text-gray-900">
                        {employeeName}
                      </td>
                    </tr>
                    <tr>
                      <td className="w-1/3 bg-[#fbfdfa] py-1 px-3 font-bold text-gray-900 border-r border-[#78b449]/40">
                        Designation
                      </td>
                      <td className="py-1 px-3 font-medium text-gray-800">
                        {designation}
                      </td>
                    </tr>
                    <tr>
                      <td className="w-1/3 bg-[#fbfdfa] py-1 px-3 font-bold text-gray-900 border-r border-[#78b449]/40">
                        Effective Date
                      </td>
                      <td className="py-1 px-3 font-semibold text-gray-900">
                        {effectiveDateFormatted}
                      </td>
                    </tr>
                    <tr>
                      <td className="w-1/3 bg-[#fbfdfa] py-1 px-3 font-bold text-gray-900 border-r border-[#78b449]/40">
                        Location
                      </td>
                      <td className="py-1 px-3 font-medium text-gray-800">
                        {location}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Revised Compensation Table */}
              <div className="mt-3 overflow-hidden rounded border border-[#78b449]">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#78b449] text-white">
                      <th className="py-1 px-3 text-left font-bold tracking-wider">
                        COMPONENT
                      </th>
                      <th className="py-1 px-3 text-right font-bold tracking-wider">
                        AMOUNT (INR)
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#78b449]/40 text-gray-800">
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
                      <td className="py-1 px-3 font-medium">CA</td>
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
                        {formatDocRupees(grossMonthlyNum)}
                      </td>
                    </tr>
                    <tr className="bg-[#78b449] font-extrabold text-white">
                      <td className="py-1.5 px-3 uppercase tracking-wider">
                        Gross Annual CTC
                      </td>
                      <td className="py-1.5 px-3 text-right text-sm">
                        {formatDocRupees(grossAnnualNum)}
                      </td>
                    </tr>
                  </tbody>
                </table>
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
        )}

        {/* ================= PAGE 2 ================= */}
        {(activePage === "all" || activePage === "2") && (
          <div className="doc-page relative mx-auto flex w-full max-w-[210mm] flex-col justify-between rounded-lg border-[2.5px] border-[#5aa846] bg-white p-8 text-gray-900 shadow-md sm:p-10 font-sans">
            <div>
              {/* Header on Page 2 */}
              <div className="flex items-center justify-center gap-2 border-b border-transparent pb-3">
                <TexaLogo />
                <h2 className="text-base sm:text-lg font-extrabold tracking-wide text-[#439234]">
                  TEXAWAVE INNOVATIONS PRIVATE LIMITED
                </h2>
              </div>

              {/* Title Banner */}
              <div className="mt-1 rounded-md bg-[#78b449] py-1 text-center shadow-xs">
                <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-white uppercase">
                  SALARY REVISION LETTER
                </span>
              </div>

              {/* Signatory Left Block */}
              <div className="mt-6 text-xs sm:text-sm">
                <div className="font-semibold text-gray-800">
                  For TexaWave Innovations Pvt Ltd,
                </div>
                <div className="font-bold text-gray-900 mt-5">
                  {signatoryName}
                </div>
                <div className="text-xs font-semibold text-[#439234]">
                  {signatoryDesignation}
                </div>
              </div>

              {/* EMPLOYEE ACCEPTANCE Section */}
              <div className="mt-8">
                <div className="rounded-md bg-[#78b449] py-1 text-center shadow-xs">
                  <span className="text-xs font-bold uppercase tracking-wider text-white">
                    EMPLOYEE ACCEPTANCE
                  </span>
                </div>

                <div className="mt-4 text-xs sm:text-sm space-y-4 text-gray-800">
                  <p className="text-justify leading-relaxed">
                    I acknowledge receipt of this Salary Revision Letter and
                    accept the revised compensation structure and related terms
                    and conditions.
                  </p>

                  <div className="mt-6 space-y-4 text-xs">
                    <div>
                      <span className="font-bold text-gray-900">Name:</span>{" "}
                      ____________________
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">
                        Signature:
                      </span>{" "}
                      ____________________
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">Date:</span>{" "}
                      ____________________
                    </div>
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
        )}
      </div>
    </div>
  );
}
