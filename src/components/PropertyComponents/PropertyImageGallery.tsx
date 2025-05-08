"use client"

import { useState } from "react"
import ImageCarousel from "./imageCarousel"

interface PropertyImage {
  url?: string
  alt?: string
  description?: string
}

interface PropertyImageGalleryProps {
  propertyName: string
  images: PropertyImage[]
  onClose: () => void
}

export default function PropertyImageGallery({ propertyName, images, onClose }: PropertyImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0)

  // Convert images to the format expected by ImageCarousel
  const carouselImages = images.map(img => ({
    url: img.url,
    alt: img.alt || img.description || `${propertyName} image`
  }))

  return (
    <div className="relative w-full flex flex-col h-full">
      <div className="text-center mb-2">
        <h3 className="text-lg font-medium">{propertyName}</h3>
      </div>
      <div className="flex-1 overflow-hidden rounded-lg">
        <ImageCarousel
          images={carouselImages}
          initialIndex={currentIndex}
          onClose={onClose}
        />
      </div>
    </div>
  )
} 