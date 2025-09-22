"use client";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Itinerary({ itinerary }) {
  if (!itinerary || itinerary.length === 0) return null;

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Travel Itinerary", 14, 20);

    itinerary.forEach((day) => {
      const rows = day.plan.map((activity, idx) => [idx + 1, activity]);

      autoTable(doc, {
        startY: doc.lastAutoTable ? doc.lastAutoTable.finalY + 10 : 30,
        head: [[`Day ${day.day}`, "Activities"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [66, 139, 202] }, // xanh dương nhạt
        styles: { fontSize: 11, cellPadding: 3 },
      });
    });

    doc.save("itinerary.pdf");
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">📅 Your Itinerary</h2>
        <button
          onClick={downloadPDF}
          className="bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700"
        >
          Download PDF
        </button>
      </div>

      <div className="grid gap-6">
        {itinerary.map((day) => (
          <div
            key={day.day}
            className="bg-white rounded-lg shadow-md p-6 border border-gray-200"
          >
            <h3 className="text-lg font-semibold mb-3">Day {day.day}</h3>
            <ul className="list-disc pl-5 space-y-2">
              {day.plan.map((activity, idx) => (
                <li key={idx} className="text-gray-700">
                  {activity}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
