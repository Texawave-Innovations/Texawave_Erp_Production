import { ContactList } from "@/features/crm/contacts/components/ContactList";

// `app/` stays thin — routing only. All real logic/markup lives in
// `features/crm/contacts/` (Docs/CODING_STANDARDS.md §4).
export default function CrmContactsPage() {
  return <ContactList />;
}
