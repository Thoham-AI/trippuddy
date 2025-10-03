"use client";
import Image from "next/image";

export default function DestinationCard({ destination }) {
  const { name, description, image } = destination;

  // fallback ảnh mặc định nếu không có ảnh từ Unsplash
  const fallbackImage = "/images/placeholder.jpg"; // đặt sẵn 1 ảnh trong public/images/

  return (
    <div className="bg-white rounded-2xl shadow-md p-4 flex flex-col items-center justify-between w-64">
      <div className="w-full h-40 relative mb-4">
        <Image
          src={image || fallbackImage}
          alt={name}
          fill
          className="object-cover rounded-xl"
          sizes="(max-width: 768px) 100vw, 300px"
        />
      </div>
      <h2 className="text-lg font-bold mb-2">{name}</h2>
      <p className="text-sm text-gray-600 text-center">{description}</p>
    </div>
  );
}
