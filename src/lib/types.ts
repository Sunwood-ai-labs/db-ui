export interface IntrospectionColumn {
  column_name: string;
  ordinal_position: number;
  column_default: string | null;
  is_nullable: "YES" | "NO";
  data_type: string;
  udt_name: string;
  character_maximum_length: number | null;
  numeric_precision: number | null;
  numeric_scale: number | null;
  datetime_precision: number | null;
  is_identity: "YES" | "NO";
  identity_generation: string | null;
  is_generated: "NEVER" | "ALWAYS" | "BY DEFAULT";
  generation_expression: string | null;
  column_comment: string | null;
}

export interface IntrospectionPrimaryKey {
  column_name: string;
  ordinal_position: number;
}

export interface IntrospectionForeignKey {
  column_name: string;
  foreign_table_schema: string;
  foreign_table_name: string;
  foreign_column_name: string;
  constraint_name: string;
  update_rule: string;
  delete_rule: string;
}

export interface IntrospectionIndex {
  index_name: string;
  index_type: string;
  is_unique: boolean;
  is_primary: boolean;
  columns: string[] | string;
}

export interface TableIntrospection {
  columns: IntrospectionColumn[];
  primaryKeys: IntrospectionPrimaryKey[];
  foreignKeys: IntrospectionForeignKey[];
  indexes: IntrospectionIndex[];
}

export interface Filter {
  column: string;
  operator: string;
  value: string;
}

export interface Sort {
  column: string;
  direction: "asc" | "desc";
}
