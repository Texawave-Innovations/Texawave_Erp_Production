-- AlterTable
ALTER TABLE "projects"."proposal_settings" ADD COLUMN     "show_footer_address" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_footer_email" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_footer_page_number" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_footer_phone" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_footer_website" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_header_company_name" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_header_doc_title" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_header_logo" BOOLEAN NOT NULL DEFAULT true;

