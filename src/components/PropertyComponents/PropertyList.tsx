"use client"

import type React from "react"
import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import PropertyDetails from "./propertyDetails"

interface PropertyUnit {
  type: string
}

interface Amenity {
  name: string
}

interface PropertyLocation {
  city?: string
  mapUrl?: string
}

interface PropertyImage {
  url?: string
  alt?: string
}

interface PropertyProps {
  id?: string
  name?: string
  price?: string
  area?: string
  location?: PropertyLocation
  mainImage?: string
  galleryImages?: PropertyImage[]
  units?: PropertyUnit[]
  amenities?: Amenity[]
  description?: string
  websiteUrl?: string
  onClose?: () => void
}

interface PropertyListProps {
  properties: PropertyProps[] // Only properties is needed now
  onScheduleVisit?: (property: PropertyProps) => void
  onPropertySelect: (property: PropertyProps) => void
}

export default function PropertyList({ properties, onScheduleVisit, onPropertySelect }: PropertyListProps) {
  console.log("[PropertyList Component] Received properties:", properties);

  const [selectedProperty, setSelectedProperty] = useState<PropertyProps | null>(null)
  // Track failed images to prevent repeated errors
  const failedImages = useRef<Set<string>>(new Set());

  const handleImageError = (propertyName: string, imageUrl: string, e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only log once and update if not already marked as failed
    if (!failedImages.current.has(imageUrl)) {
      console.log(`[PropertyList] Image error for ${propertyName}, using placeholder`);
      failedImages.current.add(imageUrl);
      e.currentTarget.src = "/placeholder.svg";
      e.currentTarget.onerror = null; // Prevent further errors
    }
  };

  // Default placeholder for cases where no image exists
  const getImageSrc = (property: PropertyProps) => {
    const src = property.mainImage || "/placeholder.svg";
    return failedImages.current.has(src) ? "/placeholder.svg" : src;
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="list"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="space-y-4"
      >
        {properties && properties.length > 0 ? (
          properties.map((property, index) => (
            <div
              key={property.id || index}
              className="p-2 bg-white rounded-lg cursor-pointer hover:bg-slate-200 flex"
              onClick={() => {
                console.log(`[PropertyList] Selected property: ${property.name} (${property.id})`);
                onPropertySelect(property);
              }}
            >
              <div>
                <img 
                  src={getImageSrc(property)} 
                  alt={property.name || "Property"} 
                  className="h-[80px] w-[80px] mr-3 object-cover rounded-lg" 
                  onError={(e) => handleImageError(property.name || "Unknown property", property.mainImage || "", e)}
                />
              </div>
              <div className="text-gray-700">
                <h3 className="font-medium">{property.name || "Property"}</h3>
                <p className="text-sm">{property.location?.city || "Location unavailable"}</p>
                <div className="flex items-center space-x-3 mt-2 text-sm">
                  <p className="flex gap-1 text-[#667085]">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M12 6L15.75 2.25M15.75 2.25H12M15.75 2.25V6M6 6L2.25 2.25M2.25 2.25L2.25 6M2.25 2.25L6 2.25M6 12L2.25 15.75M2.25 15.75H6M2.25 15.75L2.25 12M12 12L15.75 15.75M15.75 15.75V12M15.75 15.75H12" 
                        stroke="#667085" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    {property.area || "Area unavailable"}
                  </p>
                  <p className="text-[#027A48]">{property.price || "Price unavailable"}</p>
                </div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-gray-400 italic">No properties to display.</p>
        )}
      </motion.div>
    </AnimatePresence>
  )
}