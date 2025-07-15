import { createGroq } from "@ai-sdk/groq";
import { streamText, tool } from "ai";
import { getFullDatabaseSchema, formatSchemaForAI } from "@/lib/db";
import { z } from "zod";
// import { ProxyAgent } from "undici";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages } = await req.json();

  try {
    // Get the database schema
    const schemas = await getFullDatabaseSchema();
    const schemaText = await formatSchemaForAI(schemas);

    // Configure Groq
    const groq = createGroq({
      apiKey: process.env.GROQ_API_KEY,
    });

    const systemPrompt = `You are a helpful database assistant. You have access to a PostgreSQL database with the following schema:

${schemaText}

You should ONLY answer questions related to this database and its data. You can help users:
1. Understand the database structure
2. Suggest SQL queries to retrieve specific data
3. Explain relationships between tables
4. Provide insights about data patterns
5. Help with database optimization suggestions

When a user asks a question that requires querying the database, use the execute_sql tool to provide the SQL query.
The query will be reviewed by the user before execution for safety.

When you receive tool results from executed queries, analyze and explain the data in a helpful manner.

Rules:
- Always provide SQL queries when appropriate using the execute_sql tool
- Only answer database-related questions
- If asked about topics unrelated to the database, politely redirect the conversation back to database topics
- Be helpful and provide clear explanations
- When suggesting queries, explain what they do
- Consider the table types (TABLE vs VIEW) when making suggestions
- Only suggest SELECT queries for safety, avoid INSERT, UPDATE, DELETE operations unless specifically requested
- When you receive query results, provide meaningful insights about the data`;

    const result = streamText({
      model: groq(process.env.GROQ_MODEL || "llama-3.1-8b-instant"),
      system: systemPrompt,
      messages,
      maxSteps: 3,
      tools: {
        execute_sql: tool({
          description:
            "Execute a SQL query to retrieve data from the database. The query will be reviewed before execution.",
          parameters: z.object({
            query: z.string().describe("The SQL query to execute"),
            description: z
              .string()
              .describe("A brief description of what this query does"),
          }),
        }),
      },
    });

    return result.toDataStreamResponse();
  } catch (error) {
    console.error("Error in chat API:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process chat request" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
