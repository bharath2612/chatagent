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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <ImageCarousel
        images={carouselImages}
        initialIndex={currentIndex}
        onClose={onClose}
      />
    </div>
  )
} 