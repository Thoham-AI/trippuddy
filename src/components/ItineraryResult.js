// src/components/ItineraryResult.js
export default function ItineraryResult({ itinerary }) {
  if (!itinerary) return null;

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-3xl font-bold mb-6">Lịch trình của bạn</h2>
      
      {/* Tóm tắt */}
      <div className="bg-blue-50 p-4 rounded-lg mb-6">
        <h3 className="text-xl font-semibold mb-2">Tóm tắt</h3>
        <p>{itinerary.summary}</p>
      </div>

      {/* Lịch trình hàng ngày */}
      <div className="space-y-6">
        {itinerary.dailyItinerary.map(day => (
          <div key={day.day} className="border rounded-lg p-4">
            <h3 className="text-xl font-bold mb-3">Ngày {day.day}</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold">🌅 Buổi sáng</h4>
                <p>{day.morning}</p>
              </div>
              <div>
                <h4 className="font-semibold">🌇 Buổi chiều</h4>
                <p>{day.afternoon}</p>
              </div>
              <div>
                <h4 className="font-semibold">🌃 Buổi tối</h4>
                <p>{day.evening}</p>
              </div>
            </div>

            {/* Chi tiết khác */}
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="font-semibold">🏨 Chỗ ở</h4>
                <p>{day.accommodation}</p>
              </div>
              <div>
                <h4 className="font-semibold">🍽️ Ăn uống</h4>
                <p>{day.meals}</p>
              </div>
            </div>

            {/* Ngân sách */}
            <div className="mt-4">
              <h4 className="font-semibold">💰 Chi phí ước tính</h4>
              <p>Chỗ ở: {day.budgetBreakdown.accommodation.toLocaleString()} VND</p>
              <p>Hoạt động: {day.budgetBreakdown.activities.toLocaleString()} VND</p>
              <p>Ăn uống: {day.budgetBreakdown.meals.toLocaleString()} VND</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tổng ngân sách */}
      <div className="mt-6 bg-green-50 p-4 rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Tổng ngân sách</h3>
        <p>
          {itinerary.totalBudget.min.toLocaleString()} - {itinerary.totalBudget.max.toLocaleString()} VND
        </p>
      </div>

      {/* Danh sách đồ cần mang */}
      <div className="mt-6">
        <h3 className="text-xl font-semibold mb-2">Đồ cần mang theo</h3>
        <ul className="list-disc list-inside">
          {itinerary.packingList.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Mẹo hữu ích */}
      <div className="mt-6 bg-yellow-50 p-4 rounded-lg">
        <h3 className="text-xl font-semibold mb-2">Mẹo hữu ích</h3>
        <ul className="list-disc list-inside">
          {itinerary.tips.map((tip, index) => (
            <li key={index}>{tip}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}