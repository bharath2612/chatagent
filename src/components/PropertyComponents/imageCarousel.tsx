"use client"

import type React from "react"
import { useState, useCallback, useEffect, useRef } from "react"
import { X, ChevronLeft, ChevronRight } from "lucide-react"

interface PropertyImage {
  url?: string
  alt?: string
}

interface ImageCarouselProps {
  images: PropertyImage[]
  initialIndex?: number
  onClose: () => void
}

const ImageCarousel: React.FC<ImageCarouselProps> = ({ images = [], initialIndex = 0, onClose }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  // Track failed images to prevent repeated errors
  const failedImages = useRef<Set<string>>(new Set());

  const nextImage = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length)
  }, [images.length])

  const prevImage = useCallback(() => {
    setCurrentIndex((prevIndex) => (prevIndex - 1 + images.length) % images.length)
  }, [images.length])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft") prevImage()
      if (e.key === "ArrowRight") nextImage()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [nextImage, prevImage, onClose])

  const handleImageError = (imageUrl: string | undefined, e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only log once and update if not already marked as failed
    if (imageUrl && !failedImages.current.has(imageUrl)) {
      console.log(`[ImageCarousel] Image error for ${imageUrl}, using placeholder`);
      failedImages.current.add(imageUrl);
      e.currentTarget.src = "/placeholder.svg";
      e.currentTarget.onerror = null; // Prevent further errors
    }
  };

  // Get image source with fallback handling
  const getImageSrc = (image: PropertyImage) => {
    const src = image?.url || "/placeholder.svg";
    return failedImages.current.has(src) ? "/placeholder.svg" : src;
  };

  if (images.length === 0) {
    return null
  }

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden bg-blue-950 flex flex-col">
      {/* Main image container */}
      <div className="relative flex-1 flex items-center justify-center">
        <img
          src={getImageSrc(images[currentIndex] || {})}
          alt={images[currentIndex]?.alt || `Carousel Image ${currentIndex + 1}`}
          className="max-w-full max-h-full object-contain"
          onError={(e) => handleImageError(images[currentIndex]?.url, e)}
        />
        
        {/* Navigation arrows */}
        <button
          onClick={prevImage}
          className="absolute left-2 bg-black/50 text-white p-1 rounded-full z-10 hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <button
          onClick={nextImage}
          className="absolute right-2 bg-black/50 text-white p-1 rounded-full z-10 hover:bg-black/70 transition-colors"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Thumbnails */}
      <div className="p-2 bg-blue-950">
        <div className="flex gap-1 overflow-x-auto py-1 scrollbar-thin scrollbar-thumb-blue-700">
          {images.map((image, index) => (
            <button
              key={index}
              onClick={() => setCurrentIndex(index)}
              className={`relative h-12 w-12 flex-shrink-0 border-2 transition-all ${
                currentIndex === index ? "border-white" : "border-transparent opacity-70"
              }`}
            >
              <img
                src={getImageSrc(image)}
                alt={image.alt || `Thumbnail ${index + 1}`}
                className="h-full w-full object-cover"
                onError={(e) => handleImageError(image.url, e)}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ImageCarousel