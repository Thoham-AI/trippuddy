import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const TMP_DIR = "/tmp";
const PDF_FILE = path.join(TMP_DIR, "TripPuddy_Itinerary.pdf");

export async function GET() {
  try {
    if (!fs.existsSync(PDF_FILE)) {
      return NextResponse.json({ error: "No PDF found" }, { status: 404 });
    }
    const fileBuffer = fs.readFileSync(PDF_FILE);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="TripPuddy_Itinerary.pdf"',
      },
    });
  } catch (err) {
    console.error("PDF download error:", err);
    return NextResponse.json({ error: "Download failed" }, { status: 500 });
  }
}