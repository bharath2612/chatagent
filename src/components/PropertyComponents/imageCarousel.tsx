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

  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = "auto"
    }
  }, [])

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
    <div className="flex items-center justify-center bg-black/50">
      <div className="flex items-center justify-center">
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

        <button
          onClick={onClose}
          className="absolute top-4 left-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        <button
          onClick={prevImage}
          className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10 hover:bg-black/70 transition-colors"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>

        <button
          onClick={nextImage}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black/50 text-white p-2 rounded-full z-10 hover:bg-black/70 transition-colors"
        >
          <ChevronRight className="h-6 w-6" />
        </button>

        <div className="absolute top-2/8">
            <img
              src={getImageSrc(images[currentIndex] || {})}
              alt={images[currentIndex]?.alt || `Carousel Image ${currentIndex + 1}`}
              className=" "
              onError={(e) => handleImageError(images[currentIndex]?.url, e)}
            />
          </div>

        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-2 px-2">
          <div className="flex gap-1 p-1 bg-black/50 rounded-lg overflow-x-auto max-w-[80vw]">
            {images.map((image, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`relative h-16 w-16 flex-shrink-0 border-2 transition-all ${
                  currentIndex === index ? "border-white" : "border-transparent opacity-70"
                }`}
              >
                <img
                  src={getImageSrc(image)}
                  alt={image.alt || `Thumbnail ${index + 1}`}
                  className="absolute inset-0 object-cover"
                  onError={(e) => handleImageError(image.url, e)}
                />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImageCarousel