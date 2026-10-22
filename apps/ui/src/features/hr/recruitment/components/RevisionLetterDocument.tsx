"use client";

import { useState } from "react";
import { Download, FileText } from "lucide-react";
import { Button } from "@texawave-erp/ui-kit";
import { printOfferLetter } from "../utils";

export interface RevisionLetterDocumentData {
  documentNo?: string | undefined;
  employeeName: string;
  employeeCode?: string | undefined;
  designation: string;
  department?: string | undefined;
  location: string;
  letterDate: string;
  effectiveDate: string;
  revisionType?: string | undefined;
  currentComponents?:
    | {
        basic: string | number;
        da: string | number;
        hra: string | number;
        ca: string | number;
      }
    | undefined;
  components: {
    basic: string | number;
    da: string | number;
    hra: string | number;
    ca: string | number;
  };
  signatoryName?: string | undefined;
  signatoryDesignation?: string | undefined;
  companyEmail?: string | undefined;
  companyPhone?: string | undefined;
  companyWebsite?: string | undefined;
  companyAddress?: string | undefined;
  signatureImageUrl?: string | undefined;
  sealImageUrl?: string | undefined;
}

export interface RevisionLetterDocumentProps {
  data: RevisionLetterDocumentData;
  onPrint?: () => void;
  className?: string;
}

/** Formats number with Indian comma grouping: ₹ 5,250 / ₹ 1,80,000 */
export function formatDocRupees(amount: number | string | undefined): string {
  if (amount === undefined || amount === null || amount === "") return "₹ 0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "₹ 0.00";
  return `₹ ${num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

/** Logo using texawave-logo.png from public folder matching Offer Letter */
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
 * Exact Salary Revision Letter Document reproducing 2-page layout
 * in TexaOne Brand Theme (Prime Blue, Nunito Sans, zero green/violet).
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

  const letterDateFormatted =
    formatDocDate(data.letterDate) || formatDocDate(new Date().toISOString());
  const effectiveDateFormatted =
    formatDocDate(data.effectiveDate) || "01/11/2026";

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
      printOfferLetter("revision-letter-printable-content");
    }
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Print Controls / Page Switcher (Hidden in print mode) */}
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
        id="revision-letter-printable-content"
        className="printable-doc-root flex flex-col gap-6"
      >
        {/* ================= PAGE 1 ================= */}
        <div
          className={`doc-page relative mx-auto w-full max-w-[210mm] min-h-[297mm] flex-col justify-between rounded-lg border-[2.5px] border-brand-500 bg-white p-6 sm:p-8 md:p-10 text-gray-900 shadow-md font-sans ${
            activePage === "2" ? "hidden" : "flex"
          }`}
        >
          <div>
            {/* Top Company Header (Single line with full logo) */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 border-b border-transparent pb-2.5">
              <TexaLogo />
              <h1 className="text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-wide text-brand-600 dark:text-cyan-400 whitespace-nowrap uppercase">
                TEXAWAVE INNOVATIONS PRIVATE LIMITED
              </h1>
            </div>

            {/* Title Banner (Table Header Gradient) */}
            <div className="mt-1 rounded-md bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] py-1 text-center shadow-xs">
              <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-white uppercase">
                SALARY REVISION LETTER
              </span>
            </div>

            {/* Document No & Date Row */}
            <div className="mt-2.5 flex items-center justify-between text-xs sm:text-sm font-bold">
              <div>
                <span className="text-gray-900">Document No: </span>
                <span className="text-brand-600 dark:text-cyan-400 font-extrabold">
                  {documentNo}
                </span>
              </div>
              <div>
                <span className="text-gray-900">Date: </span>
                <span className="text-brand-600 dark:text-cyan-400 font-extrabold">
                  {letterDateFormatted}
                </span>
              </div>
            </div>

            {/* Framed Recipient Box */}
            <div className="mt-2 rounded-lg border border-brand-200 bg-brand-50/30 p-2.5 text-xs sm:text-sm dark:border-brand-800 dark:bg-brand-950/20">
              <div className="font-extrabold text-brand-600 dark:text-cyan-400 text-xs uppercase">
                TO,
              </div>
              <div className="font-extrabold uppercase text-gray-900 text-sm">
                {employeeName}
              </div>
              <div className="font-semibold text-gray-700 dark:text-gray-300">
                {designation}
              </div>
            </div>

            {/* Salutation & Body Text */}
            <div className="mt-2.5 text-xs sm:text-sm space-y-1.5 text-gray-800 leading-relaxed text-justify">
              <div className="font-bold text-gray-900">
                Dear {employeeFirstName},
              </div>
              <p>
                We are pleased to inform you that, based on your performance,
                commitment, and contribution to TexaWave Innovations Private
                Limited, Management has approved a revision of your compensation
                package.
              </p>
              <p>
                Your revised salary structure shall be effective from{" "}
                <strong className="font-extrabold text-gray-900">
                  {effectiveDateFormatted}
                </strong>
                .
              </p>
              <p>
                The details of your revised compensation package are enclosed as
                Annexure A to this letter.
              </p>
              <p>
                Please note that the compensation details contained in this
                letter are strictly confidential and should not be disclosed to
                any unauthorized person.
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

            {/* Company Representative Block on Page 1 */}
            <div className="mt-2.5 text-xs sm:text-sm">
              <div className="font-bold text-gray-900">
                For TEXAWAVE INNOVATIONS PRIVATE LIMITED
              </div>
              {data.signatureImageUrl ? (
                <img
                  src={data.signatureImageUrl}
                  alt="Authorized Signature"
                  className="my-1 h-9 w-auto object-contain"
                />
              ) : null}
              <div className="font-extrabold text-gray-900 mt-0.5">
                {signatoryName}
              </div>
              <div className="font-semibold text-brand-600 dark:text-cyan-400 text-xs">
                {signatoryDesignation}
              </div>
              {data.sealImageUrl ? (
                <img
                  src={data.sealImageUrl}
                  alt="Company Seal"
                  className="mt-1 h-11 w-auto object-contain opacity-90"
                />
              ) : null}
            </div>

            {/* REVISED COMPENSATION STRUCTURE Subtitle Banner */}
            <div className="mt-3 rounded-md bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] py-1 text-center shadow-xs">
              <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                REVISED COMPENSATION STRUCTURE
              </span>
            </div>

            {/* Employee Information Table */}
            <div className="mt-1.5 overflow-hidden rounded-md border border-brand-300 dark:border-brand-800">
              <table className="w-full border-collapse text-xs">
                <tbody className="divide-y divide-brand-200 dark:divide-brand-800/60 text-gray-800">
                  <tr>
                    <td className="w-1/3 bg-brand-50/50 dark:bg-brand-950/30 py-1 px-3 font-bold text-gray-900 border-r border-brand-200 dark:border-brand-800/60">
                      Name
                    </td>
                    <td className="py-1 px-3 font-semibold text-gray-900">
                      {employeeName}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 bg-brand-50/50 dark:bg-brand-950/30 py-1 px-3 font-bold text-gray-900 border-r border-brand-200 dark:border-brand-800/60">
                      Designation
                    </td>
                    <td className="py-1 px-3 font-medium text-gray-800">
                      {designation}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 bg-brand-50/50 dark:bg-brand-950/30 py-1 px-3 font-bold text-gray-900 border-r border-brand-200 dark:border-brand-800/60">
                      Effective Date
                    </td>
                    <td className="py-1 px-3 font-semibold text-gray-900">
                      {effectiveDateFormatted}
                    </td>
                  </tr>
                  <tr>
                    <td className="w-1/3 bg-brand-50/50 dark:bg-brand-950/30 py-1 px-3 font-bold text-gray-900 border-r border-brand-200 dark:border-brand-800/60">
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
            <div className="mt-2 overflow-hidden rounded-md border border-brand-300 dark:border-brand-800">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] text-white">
                    <th className="py-1 px-3 text-left font-extrabold tracking-wider w-[65%]">
                      COMPONENT
                    </th>
                    <th className="py-1 px-3 text-right font-extrabold tracking-wider w-[35%]">
                      AMOUNT (INR)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-200 dark:divide-brand-800/60 text-gray-800">
                  <tr>
                    <td className="py-1 px-3 font-medium">Basic</td>
                    <td className="py-1 px-3 text-right font-bold text-gray-900">
                      {formatDocRupees(basicNum)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-3 font-medium">DA</td>
                    <td className="py-1 px-3 text-right font-bold text-gray-900">
                      {formatDocRupees(daNum)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-3 font-medium">HRA</td>
                    <td className="py-1 px-3 text-right font-bold text-gray-900">
                      {formatDocRupees(hraNum)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 px-3 font-medium">CA</td>
                    <td className="py-1 px-3 text-right font-bold text-gray-900">
                      {formatDocRupees(caNum)}
                    </td>
                  </tr>
                  <tr className="bg-sky-50/80 dark:bg-sky-950/40 font-bold">
                    <td className="py-1 px-3 text-gray-900">
                      Net Monthly Salary
                    </td>
                    <td className="py-1 px-3 text-right text-gray-900 font-extrabold">
                      {formatDocRupees(netMonthlyNum)}
                    </td>
                  </tr>
                  <tr className="bg-sky-50/80 dark:bg-sky-950/40 font-bold">
                    <td className="py-1 px-3 text-gray-900">
                      Gross Monthly CTC
                    </td>
                    <td className="py-1 px-3 text-right text-gray-900 font-extrabold">
                      {formatDocRupees(grossMonthlyNum)}
                    </td>
                  </tr>
                  <tr className="bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] font-extrabold text-white">
                    <td className="py-1.5 px-3 uppercase tracking-wider text-xs">
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
          <div className="mt-4 border-t border-brand-200 dark:border-brand-800 pt-2 text-center text-[10px] text-gray-600 space-y-0.5 bg-brand-50/20 py-1.5 rounded">
            <div>
              E-Mail:{" "}
              <span className="font-semibold text-gray-800">{companyEmail}</span>{" "}
              | Phone:{" "}
              <span className="font-semibold text-gray-800">{companyPhone}</span>{" "}
              | Website:{" "}
              <span className="font-semibold text-gray-800">
                {companyWebsite}
              </span>
            </div>
            <div>
              Address:{" "}
              <span className="font-semibold text-gray-800">
                {companyAddress}
              </span>
            </div>
          </div>
        </div>

        {/* ================= PAGE 2 ================= */}
        <div
          className={`doc-page relative mx-auto w-full max-w-[210mm] min-h-[297mm] flex-col justify-between rounded-lg border-[2.5px] border-brand-500 bg-white p-6 sm:p-8 md:p-10 text-gray-900 shadow-md font-sans ${
            activePage === "1" ? "hidden" : "flex"
          }`}
        >
          <div>
            {/* Header on Page 2 */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 border-b border-transparent pb-2.5">
              <TexaLogo />
              <h2 className="text-xs sm:text-sm md:text-base lg:text-lg font-extrabold tracking-wide text-brand-600 dark:text-cyan-400 whitespace-nowrap uppercase">
                TEXAWAVE INNOVATIONS PRIVATE LIMITED
              </h2>
            </div>

            {/* Title Banner */}
            <div className="mt-1 rounded-md bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] py-1 text-center shadow-xs">
              <span className="text-xs sm:text-sm font-extrabold tracking-[0.25em] text-white uppercase">
                SALARY REVISION LETTER
              </span>
            </div>

            {/* Signatory Left Block on Page 2 matching reference */}
            <div className="mt-6 text-xs sm:text-sm">
              <div className="font-bold text-gray-900">
                For TexaWave Innovations Pvt Ltd,
              </div>
              {data.signatureImageUrl ? (
                <img
                  src={data.signatureImageUrl}
                  alt="Authorized Signature"
                  className="my-2 h-12 w-auto object-contain"
                />
              ) : (
                <div className="h-10" />
              )}
              <div className="font-extrabold text-gray-900 mt-2">
                {signatoryName}
              </div>
              <div className="text-xs font-bold text-brand-600 dark:text-cyan-400">
                {signatoryDesignation}
              </div>
              {data.sealImageUrl ? (
                <img
                  src={data.sealImageUrl}
                  alt="Company Seal"
                  className="mt-2 h-14 w-auto object-contain opacity-90"
                />
              ) : null}
            </div>

            {/* EMPLOYEE ACCEPTANCE Section matching Image 3 and reference code */}
            <div className="mt-8">
              <div className="rounded-md bg-linear-to-r from-[#0a3271] via-[#1769F5] to-[#0284c7] py-1.5 text-center shadow-xs">
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                  EMPLOYEE ACCEPTANCE
                </span>
              </div>

              <div className="mt-4 text-xs sm:text-sm space-y-5 text-gray-800">
                <p className="text-justify leading-relaxed">
                  I acknowledge receipt of this Salary Revision Letter and
                  accept the revised compensation structure and related terms
                  and conditions.
                </p>

                <div className="mt-6 space-y-4 text-xs font-bold">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 min-w-17.5">Name:</span>
                    <span className="flex-1 border-b border-gray-400 max-w-60 inline-block h-4"></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 min-w-17.5">Signature:</span>
                    <span className="flex-1 border-b border-gray-400 max-w-60 inline-block h-4"></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-gray-900 min-w-17.5">Date:</span>
                    <span className="flex-1 border-b border-gray-400 max-w-60 inline-block h-4"></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Page 2 Footer */}
          <div className="mt-6 border-t border-brand-200 dark:border-brand-800 pt-2 text-center text-[10px] text-gray-600 space-y-0.5 bg-brand-50/20 py-1.5 rounded">
            <div>
              E-Mail:{" "}
              <span className="font-semibold text-gray-800">{companyEmail}</span>{" "}
              | Phone:{" "}
              <span className="font-semibold text-gray-800">{companyPhone}</span>{" "}
              | Website:{" "}
              <span className="font-semibold text-gray-800">
                {companyWebsite}
              </span>
            </div>
            <div>
              Address:{" "}
              <span className="font-semibold text-gray-800">
                {companyAddress}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
