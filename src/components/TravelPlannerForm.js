// src/components/TravelPlannerForm.js
"use client";

import { useState } from 'react';

export default function TravelPlannerForm() {
  const [formData, setFormData] = useState({
    numberOfPeople: 2,
    ages: ['30-40'], // Mảng độ tuổi
    interests: [], // Sở thích
    budget: 'medium', // low, medium, high, luxury
    duration: 7, // Số ngày
    destinationType: 'beach', // beach, mountain, city, etc.
    travelStyle: 'relaxing', // relaxing, adventurous, cultural
    season: 'summer',
    specialRequirements: ''
  });

  const interestsList = [
    'Ẩm thực', 'Văn hóa', 'Thiên nhiên', 'Thể thao', 
    'Mua sắm', 'Lịch sử', 'Nghệ thuật', 'Nightlife',
    'Thư giãn', 'Phiêu lưu', 'Chụp ảnh', 'Du lịch gia đình'
  ];

  const handleInterestToggle = (interest) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Gọi API AI để tạo lịch trình
    const response = await fetch('/api/travel-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    const result = await response.json();
    // Xử lý kết quả
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6">Thiết kế lịch trình du lịch</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Số lượng người */}
        <div>
          <label className="block text-sm font-medium mb-2">Số lượng người</label>
          <input
            type="number"
            min="1"
            max="20"
            value={formData.numberOfPeople}
            onChange={(e) => setFormData({...formData, numberOfPeople: parseInt(e.target.value)})}
            className="w-20 p-2 border rounded"
          />
        </div>

        {/* Độ tuổi */}
        <div>
          <label className="block text-sm font-medium mb-2">Độ tuổi thành viên</label>
          <div className="flex flex-wrap gap-2">
            {['Dưới 18', '18-25', '26-35', '36-45', '46-55', 'Trên 55'].map(age => (
              <button
                key={age}
                type="button"
                onClick={() => setFormData({...formData, ages: [age]})}
                className={`px-3 py-1 rounded-full text-sm ${
                  formData.ages.includes(age) 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {age}
              </button>
            ))}
          </div>
        </div>

        {/* Sở thích */}
        <div>
          <label className="block text-sm font-medium mb-2">Sở thích (chọn nhiều)</label>
          <div className="flex flex-wrap gap-2">
            {interestsList.map(interest => (
              <button
                key={interest}
                type="button"
                onClick={() => handleInterestToggle(interest)}
                className={`px-3 py-1 rounded-full text-sm ${
                  formData.interests.includes(interest)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-700'
                }`}
              >
                {interest}
              </button>
            ))}
          </div>
        </div>

        {/* Ngân sách */}
        <div>
          <label className="block text-sm font-medium mb-2">Ngân sách / người</label>
          <select 
            value={formData.budget}
            onChange={(e) => setFormData({...formData, budget: e.target.value})}
            className="w-full p-2 border rounded"
          >
            <option value="low">Tiết kiệm (dưới 5 triệu)</option>
            <option value="medium">Trung bình (5-15 triệu)</option>
            <option value="high">Cao cấp (15-30 triệu)</option>
            <option value="luxury">Sang trọng (trên 30 triệu)</option>
          </select>
        </div>

        {/* Thời gian */}
        <div>
          <label className="block text-sm font-medium mb-2">Thời gian (ngày)</label>
          <input
            type="number"
            min="1"
            max="30"
            value={formData.duration}
            onChange={(e) => setFormData({...formData, duration: parseInt(e.target.value)})}
            className="w-20 p-2 border rounded"
          />
        </div>

        {/* Nút submit */}
        <button
          type="submit"
          className="w-full bg-blue-500 text-white py-3 rounded-lg hover:bg-blue-600"
        >
          Tạo lịch trình AI
        </button>
      </form>
    </div>
  );
}