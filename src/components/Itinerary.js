"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

export default function Itinerary({ itinerary, destinations }) {
  // 🟢 Export PDF
  const exportPDF = () => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(18);
    doc.text("Travel Itinerary", 14, 20);

    // Destinations section
    doc.setFontSize(14);
    doc.text("Suggested Destinations:", 14, 30);

    destinations.forEach((d, index) => {
      const y = 40 + index * 60;
      doc.setFontSize(12);
      doc.text(`${d.name}`, 14, y);

      if (d.image) {
        // Load image
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = d.image;
        img.onload = function () {
          doc.addImage(img, "JPEG", 14, y + 5, 50, 30);
          doc.text(doc.splitTextToSize(d.description || "", 130), 70, y + 15);
          doc.save("itinerary.pdf"); // Save sau khi ảnh load xong
        };
      } else {
        doc.text(doc.splitTextToSize(d.description || "", 130), 14, y + 15);
      }
    });

    // Itinerary section
    autoTable(doc, {
      startY: 40 + destinations.length * 60,
      head: [["Day", "Plan"]],
      body: itinerary.map((day) => [day.day, day.plan.join("\n")]),
    });

    if (!destinations.some((d) => d.image)) {
      // Save ngay nếu không có ảnh
      doc.save("itinerary.pdf");
    }
  };

  // 🟢 Export CSV
  const exportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Day,Plan\n";
    itinerary.forEach((day) => {
      csvContent += `${day.day},"${day.plan.join(" | ")}"\n`;
    });

    csvContent += "\nDestinations:\nName,Description,Image\n";
    destinations.forEach((d) => {
      csvContent += `"${d.name}","${d.description}","${d.image}"\n`;
    });

    const blob = new Blob([decodeURIComponent(encodeURI(csvContent))], {
      type: "text/csv;charset=utf-8;",
    });
    saveAs(blob, "itinerary.csv");
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2 mb-4">
        <button
          onClick={exportPDF}
          className="bg-blue-800 text-white px-4 py-2 rounded"
        >
          Export PDF
        </button>
        <button
          onClick={exportCSV}
          className="bg-green-700 text-white px-4 py-2 rounded"
        >
          Export CSV
        </button>
      </div>

      <h2 className="text-2xl font-bold mb-2">Itinerary</h2>
      <div className="space-y-4">
        {itinerary.map((day, i) => (
          <div key={i} className="border rounded-lg p-4 shadow">
            <h3 className="font-bold">Day {day.day}</h3>
            <ul className="list-disc ml-5">
              {day.plan.map((p, j) => (
                <li key={j}>{p}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
