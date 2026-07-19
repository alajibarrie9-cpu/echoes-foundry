import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://echoes.mobi/api/items?_format=json", {
      headers: { Accept: "application/json" },
      next: { revalidate: 21600 }
    });
    if (!response.ok) throw new Error("Echoes.mobi price service unavailable");
    const raw = await response.json();
    const rows = Array.isArray(raw) ? raw : raw["hydra:member"] || raw.items || raw.data || [];
    const prices: Record<string, number> = {};
    for (const item of rows) {
      const name = String(item.name || item.item_name || "");
      const price = Number(item.weekly_average_price || 0);
      if (name && Number.isFinite(price) && price > 0) prices[name] = price;
    }
    return NextResponse.json(
      { prices, updatedAt: new Date().toISOString() },
      { headers: { "cache-control": "public, s-maxage=21600, stale-while-revalidate=86400" } }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Prices unavailable" },
      { status: 502 }
    );
  }
}
