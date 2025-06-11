import SQLQueryClient from "./SQLQueryClient";

// Force dynamic rendering since this page is interactive and involves database queries
export const dynamic = "force-dynamic";

export default function SQLPage() {
  return <SQLQueryClient />;
}
