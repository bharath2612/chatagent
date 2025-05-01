"use client"

import { useState, useRef } from "react"
import { X, Share, ExternalLink, MapPin, Maximize2 } from "lucide-react"
import ImageCarousel from "./imageCarousel"

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

interface PropertyDetailsProps {
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
  onClose: () => void
  onScheduleVisit?: (property: PropertyDetailsProps) => void
}

export default function PropertyDetails({
  id,
  name,
  price,
  area,
  location,
  mainImage,
  galleryImages,
  units,
  amenities,
  description,
  websiteUrl,
  onClose,
  onScheduleVisit
}: PropertyDetailsProps) {
  const [showImageCarousel, setShowImageCarousel] = useState(false)
  const [carouselIndex, setCarouselIndex] = useState(0)
  // Track failed images to prevent repeated errors
  const failedImages = useRef<Set<string>>(new Set());

  // Process images for the carousel
  const allImages: PropertyImage[] = [];
  
  // Add main image to carousel if it exists
  if (mainImage) {
    allImages.push({ url: mainImage, alt: name });
  }
  
  // Add gallery images if available
  if (galleryImages && Array.isArray(galleryImages)) {
    allImages.push(...galleryImages);
  }

  // If no images at all, add a placeholder
  if (allImages.length === 0) {
    allImages.push({ url: "/placeholder.svg", alt: "Placeholder image" });
  }

  const handleImageError = (imageUrl: string | undefined, e: React.SyntheticEvent<HTMLImageElement>) => {
    // Only log once and update if not already marked as failed
    if (imageUrl && !failedImages.current.has(imageUrl)) {
      console.log(`[PropertyDetails] Image error for ${imageUrl}, using placeholder`);
      failedImages.current.add(imageUrl);
      e.currentTarget.src = "/placeholder.svg";
      e.currentTarget.onerror = null; // Prevent further errors
    }
  };

  // Get image source with fallback handling
  const getImageSrc = (url: string | undefined) => {
    const src = url || "/placeholder.svg";
    return failedImages.current.has(src) ? "/placeholder.svg" : src;
  };

  return (
    <div className="overflow-hidden rounded-lg text-black">
      {/* Image Carousel */}
      {showImageCarousel && (
        <div className="fixed inset-0 z-50">
          <ImageCarousel
            images={allImages}
            initialIndex={carouselIndex}
            onClose={() => setShowImageCarousel(false)}
          />
        </div>
      )}
      
      {/* Main Container */}
      <div className="bg-white rounded-lg overflow-hidden flex flex-col h-[490px]">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-1 right-1 z-10 bg-white rounded-full p-1 shadow-md"
        >
          <X size={18} />
        </button>
        
        {/* Header Image */}
        <div className="relative h-48">
          <img
            src={getImageSrc(mainImage)}
            alt={name || "Property image"}
            className="w-full h-full object-cover"
            onError={(e) => handleImageError(mainImage, e)}
          />
          
          {/* Fullscreen button */}
          <button
            onClick={() => {
              setCarouselIndex(0)
              setShowImageCarousel(true)
            }}
            className="absolute bottom-2 right-2 bg-white rounded-full p-1 shadow-md"
          >
            <Maximize2 size={16} />
          </button>
          
          {/* Photo gallery thumbnails */}
          {galleryImages && galleryImages.length > 0 && (
            <div className="absolute bottom-2 left-2 flex space-x-1">
              {galleryImages.slice(0, 3).map((image, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setCarouselIndex(index + 1) // +1 because main image is first
                    setShowImageCarousel(true)
                  }}
                  className="h-8 w-8 bg-white rounded overflow-hidden shadow-md"
                >
                  <img 
                    src={getImageSrc(image.url)} 
                    alt={image.alt || `Gallery image ${index + 1}`} 
                    className="h-full w-full object-cover"
                    onError={(e) => handleImageError(image.url, e)}
                  />
                </button>
              ))}
              {galleryImages.length > 3 && (
                <button
                  onClick={() => {
                    setCarouselIndex(3) // Show the 4th image (index 3)
                    setShowImageCarousel(true)
                  }}
                  className="h-8 w-8 bg-white rounded overflow-hidden shadow-md flex items-center justify-center text-xs font-medium"
                >
                  +{galleryImages.length - 3}
                </button>
              )}
            </div>
          )}
        </div>
        
        {/* Content */}
        <div className="p-4 flex-1 overflow-y-auto">
          {/* Title and Price */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-lg">{name || "Property"}</h3>
              <p className="text-gray-500 flex items-center text-sm">
                <MapPin size={14} className="mr-1" />
                {location?.city || "Location unavailable"}
              </p>
            </div>
            <p className="text-green-600 font-bold">{price || "Price unavailable"}</p>
          </div>
          
          {/* Area */}
          {area && (
            <div className="mb-3 flex items-center text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none" className="mr-1">
                <path d="M12 6L15.75 2.25M15.75 2.25H12M15.75 2.25V6M6 6L2.25 2.25M2.25 2.25L2.25 6M2.25 2.25L6 2.25M6 12L2.25 15.75M2.25 15.75H6M2.25 15.75L2.25 12M12 12L15.75 15.75M15.75 15.75V12M15.75 15.75H12" 
                  stroke="currentColor" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>{area}</span>
            </div>
          )}
          
          {/* Description */}
          {description && (
            <div className="mb-4">
              <h4 className="font-medium mb-1">About this property</h4>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          )}
          
          {/* Units */}
          {units && units.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-1">Available Units</h4>
              <div className="flex flex-wrap gap-2">
                {units.map((unit, index) => (
                  <span key={index} className="text-xs bg-gray-100 py-1 px-2 rounded">
                    {unit.type}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Amenities */}
          {amenities && amenities.length > 0 && (
            <div className="mb-4">
              <h4 className="font-medium mb-1">Amenities</h4>
              <div className="flex flex-wrap gap-2">
                {amenities.map((amenity, index) => (
                  <span key={index} className="text-xs bg-gray-100 py-1 px-2 rounded">
                    {amenity.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Map link */}
          {location?.mapUrl && (
            <div className="mb-4">
              <a
                href={location.mapUrl}
                target="_blank"
                rel="noopener noreferrer" 
                className="text-blue-600 flex items-center text-sm"
              >
                <MapPin size={14} className="mr-1" />
                View on map
              </a>
            </div>
          )}
          
          {/* Website link */}
          {websiteUrl && (
            <div className="mb-4">
              <a
                href={websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 flex items-center text-sm"
              >
                <ExternalLink size={14} className="mr-1" />
                Visit website
              </a>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="p-3 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => onScheduleVisit?.({ id, name, price, area, location, mainImage, galleryImages, units, amenities, description, websiteUrl, onClose })}
            className="bg-blue-600 text-white px-4 py-2 rounded font-medium flex-1"
          >
            Schedule a Visit
          </button>
          
          <button className="ml-2 bg-gray-100 p-2 rounded">
            <Share size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}