import {
  getTableData,
  getTablePrimaryKeys,
  getTableColumns,
  getTableColumnTypes,
  getTableType,
  getTableIntrospection,
} from "@/lib/db";
import TablePageClient from "./TablePageClient";
import { Metadata } from "next";

// Force dynamic rendering since this page fetches database data
export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ tableName: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const resolvedParams = await params;
  const tableName = decodeURIComponent(resolvedParams.tableName);
  return {
    title: `Table: ${tableName}`,
  };
}

export default async function TablePage({ params, searchParams }: Props) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);

  // Convert searchParams to URLSearchParams properly
  const urlSearchParams = new URLSearchParams();
  Object.entries(resolvedSearchParams).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        value.forEach((v) => urlSearchParams.append(key, v));
      } else {
        urlSearchParams.append(key, value);
      }
    }
  });

  const tableName = decodeURIComponent(resolvedParams.tableName);
  const [data, primaryKeys, columns, columnTypes, tableType, introspection] =
    await Promise.all([
      getTableData(tableName, urlSearchParams),
      getTablePrimaryKeys(tableName),
      getTableColumns(tableName),
      getTableColumnTypes(tableName),
      getTableType(tableName),
      getTableIntrospection(tableName),
    ]);

  return (
    <TablePageClient
      tableName={tableName}
      initialData={data}
      initialPrimaryKeys={primaryKeys}
      initialColumns={columns}
      initialColumnTypes={columnTypes}
      tableType={tableType}
      introspection={introspection}
    />
  );
}
