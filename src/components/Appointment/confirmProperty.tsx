"use client"

import React from "react"
import { useState } from "react"
import TimePick from "./timePick"

// Interface definitions remain the same
interface PropertyUnit {
  type: string
}

interface Amenity {
  name: string
}

interface PropertyLocation {
  city: string
  mapUrl: string
}

interface PropertyImage {
  url: string
  alt: string
}

interface PropertyProps {
  name: string
  price: string
  area: string
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}

interface BookingConfirmationProps {
  onClose: () => void
  selectedTime: string
  selectedDay: string
  onConfirm: () => void
  property: PropertyProps
}

export default function PropertyConfirmation({
  onClose,
  selectedTime,
  selectedDay,
  onConfirm,
  property,
}: BookingConfirmationProps) {
  const [confirmed, setConfirmed] = useState<boolean>(false)



  const schedule = {
    monday: ["10:00 am - 12:00 pm", "2:00 pm - 4:00 pm", "6:00 pm - 8:00 pm"],
    tuesday: ["11:00 am - 1:00 pm"],
  }

  return (
    <div>
      {!confirmed ? (
        <div className="p-4 bg-[#0b3d91] text-white rounded-xl space-y-4 mt-10">
          <div
              className="p-2 bg-white rounded-lg cursor-pointer hover:bg-slate-200 flex"
            >
                <div>
                <img src="/media/image.jpg" alt={property.name} className="h-[80px] w-[80px] mr-3 object-cover rounded-lg" />
                </div>
                <div className="text-gray-700">
              <h3 className="font-medium">{property.name}</h3>
              <p className="text-sm">{property.location.city}</p>
              <div className="flex items-center space-x-3 mt-2 text-sm">
              <p className="flex gap-1 text-[#667085]"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
  <path d="M12 6L15.75 2.25M15.75 2.25H12M15.75 2.25V6M6 6L2.25 2.25M2.25 2.25L2.25 6M2.25 2.25L6 2.25M6 12L2.25 15.75M2.25 15.75H6M2.25 15.75L2.25 12M12 12L15.75 15.75M15.75 15.75V12M15.75 15.75H12" stroke="#667085" strokeLinecap="round" strokeLinejoin="round"/>
</svg>{property.area}</p>
              <p className="text-[#027A48]">{property.price}</p>
              </div>
              </div>
            </div>
          <div className="flex space-x-4 mt-4">
            <button
              className="px-4 py-2 bg-gray-200 text-blue-900 rounded-lg hover:bg-gray-300"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              onClick={() => {
                setConfirmed(true)
                onConfirm()
              }}
            >
              Confirm
            </button>
          </div>
        </div>
      ) : (
        <TimePick
          schedule={schedule}
          property={property}
        />
      )}
    </div>
  )
}