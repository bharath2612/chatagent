"use client"
import { useState } from "react"
import React from "react"
import { motion, AnimatePresence } from "framer-motion"

interface PropertyUnit {
  type: string
}

interface Amenity {
  name: string
}

interface PropertyLocation {
  city?: string
  mapUrl?: string
  coords?: string 
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

interface BookingConfirmationProps {
  onClose: () => void
  selectedTime: string
  selectedDay: string
  onConfirm: () => void
  property: PropertyProps
}

export default function BookingConfirmation({
  onClose,
  selectedTime,
  selectedDay,
  onConfirm,
  property,
}: BookingConfirmationProps) {
  const [name, setName] = useState<string>("")
  const [number, setNumber] = useState<string>("")

  return (
    <div className="space-y-6 max-w-sm w-full">
      <motion.p
        className="text-xl font-normal leading-6"
      >
        To confirm the booking please verify your name and number
      </motion.p>
      <motion.div  className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter Name here"
          className="w-full px-4 py-3 bg-[#1e4db7] text-white placeholder-white placeholder-opacity-80 rounded-3xl border-2 border-blue-500 text-sm text-center font-normal focus:outline-none"
        />
        <input
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="Enter Number here"
          className="w-full px-4 py-3 bg-[#1e4db7] text-white placeholder-white placeholder-opacity-80 rounded-3xl border-2 border-blue-500 text-sm text-center font-normal focus:outline-none"
        />
      </motion.div>
      <motion.div  className="space-y-3">
        <p className="text-sm italic">Selected: {selectedDay} at {selectedTime}</p>
        <button
          onClick={onConfirm}
          className="w-full bg-[#1e4db7] text-white py-2 rounded-lg text-lg font-normal hover:bg-[#2a5dd8] transition-colors"
        >
          Confirm
        </button>
        <button
          onClick={onClose}
          className="w-full bg-[#1e4db7] text-white py-2 rounded-lg text-lg font-normal hover:bg-[#2a5dd8] transition-colors"
        >
          Cancel
        </button>
      </motion.div>
    </div>
  )
}