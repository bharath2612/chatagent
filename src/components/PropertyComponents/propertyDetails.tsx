"use client"

import { useState } from "react"
import { X, MapPin, Send } from "lucide-react"
import Image from "next/image"
import ImageCarousel from "./imageCarousel"

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

export default function PropertyDetails({
  name = "Skyline Heights",
  price = "₹1.8 Crores",
  location = { city: "Chennai", mapUrl: "" },
  mainImage = "/placeholder.svg?height=150&width=300",
  galleryImages = [],
  units = [{ type: "2 BHK" }, { type: "3 BHK" }],
  amenities = [{ name: "Parking" }, { name: "Gym" }, { name: "Pool" }],
  onClose = () => {},
}: PropertyProps) {
  const [carouselOpen, setCarouselOpen] = useState(false)
  const [initialImageIndex, setInitialImageIndex] = useState(0)

  const allImages = [{ url: mainImage, alt: name }, ...galleryImages]

  const openCarousel = (index: number) => {
    setInitialImageIndex(index)
    setCarouselOpen(true)
  }

  return (
    <>
      <div className="bg-white text-black rounded-lg overflow-hidden shadow-lg border-0 scroll-container">
        <div className="bg-blue-800 text-white p-4 flex justify-between items-center">
          <h2 className="font-semibold text-lg">Property Details</h2>
          <button onClick={onClose} className="text-white hover:bg-blue-700">
            <X size={18} />
          </button>
        </div>

        <div className="relative h-48 w-full cursor-pointer" onClick={() => openCarousel(0)}>
          <Image src={mainImage} alt={name} fill className="object-cover" priority />
        </div>

        <div className="flex p-2 gap-2 border-b border-dashed border-gray-200">
          {galleryImages.slice(0, 3).map((image, index) => (
            <div
              key={index}
              className="relative h-[47px] w-[65px] flex-shrink-0 cursor-pointer"
              onClick={() => openCarousel(index + 1)}
            >
              <Image src={image.url} alt={image.alt} fill className="object-cover rounded-sm" />
            </div>
          ))}
          {galleryImages.length > 3 && (
            <div
              className="cursor-pointer relative h-[47px] w-[50px] flex-shrink-0 bg-gray-800 rounded-sm flex items-center justify-center text-white font-semibold"
              onClick={() => openCarousel(3)}
            >
              {galleryImages.length - 2}+
            </div>
          )}
        </div>

        <div className="p-4 border-b border-dashed border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-gray-800">{name}</h3>
              <div className="flex items-center text-gray-600 mt-1">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="text-sm">{location.city}</span>
              </div>
            </div>
            <div className="text-xl font-bold text-green-700">{price}</div>
          </div>
        </div>

        <div className="p-4 border-b border-dashed border-gray-200">
          <h4 className="font-semibold mb-2">Types of Units</h4>
          <div className="space-y-2">
            {units.map((unit, index) => (
              <div key={index} className="text-gray-700">
                {unit.type}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 border-b border-dashed border-gray-200">
          <h4 className="font-semibold mb-2">Amenities</h4>
          <div className="grid grid-cols-2 gap-y-2">
            {amenities.map((amenity, index) => (
              <div key={index} className="flex items-center text-gray-700">
                <span className="h-1.5 w-1.5 rounded-full bg-gray-700 mr-2"></span>
                {amenity.name}
              </div>
            ))}
          </div>
        </div>

        <div className="p-4">
          <h4 className="font-semibold mb-2">Location</h4>
          <div className="relative h-28 w-full rounded overflow-hidden">
            <iframe
              src={location.mapUrl || "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3503.5096853911874!2d77.49743461508212!3d28.58648098243483!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x390cfb693ac619c3%3A0xd138a50d9e17f11b!2sKIET%20Group%20of%20Institutions!5e0!3m2!1sen!2sin!4v1631101948034!5m2!1sen!2sin"}
              loading="lazy"
              allowFullScreen
              className="absolute top-0 left-0 w-full h-full border-0"
            ></iframe>
          </div>
        </div>

        {/* <div className="absolute bottom-3 right-3">
          <button className="bg-white p-2 rounded-full shadow">
            <Send size={18} className="text-blue-800" />
          </button>
        </div> */}
      </div>

      {carouselOpen && (
        <ImageCarousel
          images={allImages}
          initialIndex={initialImageIndex}
          onClose={() => setCarouselOpen(false)}
        />
      )}
    </>
  )
}