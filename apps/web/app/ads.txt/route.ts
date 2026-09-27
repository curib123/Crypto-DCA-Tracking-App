export const dynamic = "force-dynamic";

export async function GET() {
  const clientId = String(process.env.ADSENSE_CLIENT_ID || "").trim();

  if (!/^ca-pub-\d{16}$/.test(clientId)) {
    return new Response("AdSense publisher is not configured.\n", {
      status: 404,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }

  const publisherId = clientId.replace(/^ca-/, "");

  return new Response(
    "google.com, " +
      publisherId +
      ", DIRECT, f08c47fec0942fa0\n",
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    },
  );
}
