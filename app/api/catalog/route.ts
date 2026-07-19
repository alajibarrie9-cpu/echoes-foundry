import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://echoes.mobi/api/v2/item_blueprints?_format=json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 86400 },
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`Echoes.mobi returned ${response.status}`);
    return new NextResponse(text, { headers: { "content-type": response.headers.get("content-type") || "application/json", "cache-control": "public, max-age=3600" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Catalogue unavailable" }, { status: 502 });
  }
}
