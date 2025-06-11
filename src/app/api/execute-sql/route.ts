import { executeQuery } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { query, toolCallId } = await request.json();

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

    if (!toolCallId || typeof toolCallId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Tool call ID is required",
          rows: [],
          rowCount: 0,
          fields: [],
        },
        { status: 400 }
      );
    }

    const result = await executeQuery(query);

    return NextResponse.json({
      ...result,
      toolCallId,
    });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        rows: [],
        rowCount: 0,
        fields: [],
        toolCallId: null,
      },
      { status: 500 }
    );
  }
}
