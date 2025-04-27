"use client"

import type React from "react"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PropertyDetails from "./propertyDetails"

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
  area :string
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}

interface PropertyListProps {
  properties: PropertyProps[] // Only properties is needed now
  onScheduleVisit?: (property: PropertyProps) => void
}

export default function PropertyList({ properties ,onScheduleVisit}: PropertyListProps) {
  const [selectedProperty, setSelectedProperty] = useState<PropertyProps | null>(null)

  const handlePropertyClick = (property: PropertyProps) => {
    setSelectedProperty(property)
  }

  const handleCloseDetails = () => {
    setSelectedProperty(null)
  }

  return (
    <AnimatePresence mode="wait">
      {!selectedProperty ? (
        <motion.div
          key="list"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="space-y-4"
        >
          {properties.map((property, index) => (
            <div
              key={index}
              className="p-2 bg-white rounded-lg cursor-pointer hover:bg-slate-200 flex"
              onClick={() => handlePropertyClick(property)}
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
          ))}
        </motion.div>
      ) : (
        <motion.div
          key="details"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
            <div className="h-[400px]">
          <PropertyDetails {...selectedProperty} onClose={handleCloseDetails}
          onScheduleVisit={onScheduleVisit}
           />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}