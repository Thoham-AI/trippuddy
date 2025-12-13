import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export async function POST(req) {
  try {
    const { itinerary } = await req.json();
    if (!itinerary || !Array.isArray(itinerary) || itinerary.length === 0) {
      return NextResponse.json({ error: "No itinerary data provided" }, { status: 400 });
    }

    // Create a new PDF
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // Add a page
    let page = pdfDoc.addPage();
    const { width, height } = page.getSize();
    let y = height - 50;

    const writeLine = (text, size = 12, color = rgb(0, 0, 0)) => {
      if (y < 50) {
        page = pdfDoc.addPage();
        y = height - 50;
      }
      page.drawText(text, { x: 50, y, size, font, color });
      y -= size + 4;
    };

    // Header
    writeLine("TripPuddy — AI-Generated Travel Itinerary", 18, rgb(0, 0.5, 1));
    y -= 10;

    // Each day
    for (const day of itinerary) {
      writeLine(`Day ${day.day || ""}: ${day.city || ""}, ${day.country || ""}`, 14, rgb(0.1, 0.1, 0.6));

      if (day.activities?.length) {
        for (const a of day.activities) {
          writeLine(`• ${a.time || "Flexible"} — ${a.title || ""}`, 11);
          if (a.location?.name) writeLine(`  Location: ${a.location.name}`, 10);
          if (a.details) writeLine(`  Details: ${a.details}`, 10);
          if (a.cost_estimate) writeLine(`  Cost: ${a.cost_estimate}`, 10);
          writeLine(""); // spacer
        }
      } else {
        writeLine("  (No activities listed)", 10, rgb(0.4, 0.4, 0.4));
      }

      y -= 10;
    }

    // Save PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(pdfBytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="itinerary.pdf"',
      },
    });
  } catch (err) {
    console.error("PDF generation failed:", err);
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
