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
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}

interface PropertyListProps {
  properties: PropertyProps[] // Only properties is needed now
}

export default function PropertyList({ properties }: PropertyListProps) {
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
              className="p-3 bg-white rounded-lg cursor-pointer hover:bg-slate-200 flex"
              onClick={() => handlePropertyClick(property)}
            >
                <div>
                <img src="/media/image.jpg" alt={property.name} className="h-[80px] w-[80px] mr-7 object-cover rounded-lg" />
                </div>
                <div className="text-gray-700">
              <h3 className="font-medium">{property.name}</h3>
              <p className="text-sm">{property.price}</p>
              <p className="text-sm">{property.location.city}</p>
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
            <div className="h-[500px]">
          <PropertyDetails {...selectedProperty} onClose={handleCloseDetails} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}