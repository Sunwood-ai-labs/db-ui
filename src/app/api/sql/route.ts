import { executeQuery } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Query is required and must be a string",
          rows: [],
          rowCount: 0,
          fields: [],
        },
        { status: 400 }
      );
    }

    const result = await executeQuery(query);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        rows: [],
        rowCount: 0,
        fields: [],
      },
      { status: 500 }
    );
  }
}
