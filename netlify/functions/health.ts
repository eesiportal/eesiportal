export default async function handler(): Promise<Response> {
  const apiKey = typeof process !== "undefined" ? process.env?.GEMINI_API_KEY : undefined;
  return new Response(
    JSON.stringify({
      ok: true,
      geminiConfigured: Boolean(apiKey && apiKey !== "MY_GEMINI_API_KEY"),
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
