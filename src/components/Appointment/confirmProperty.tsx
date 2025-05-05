"use client"

import React from "react"
import { useState } from "react"
import TimePick from "./timePick"
import { motion, AnimatePresence } from "framer-motion"

// Interface definitions remain the same
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
  area: string
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}

interface BookingConfirmationProps {
  onClose: () => void
  selectedTime: string
  selectedDay: string
  onConfirm: () => void
  property: PropertyProps
}

export default function PropertyConfirmation({
  onClose,
  selectedTime,
  selectedDay,
  onConfirm,
  property,
}: BookingConfirmationProps) {
  const [confirmed, setConfirmed] = useState<boolean>(false)

  const schedule = {
    monday: ["10:00 am - 12:00 pm", "2:00 pm - 4:00 pm", "6:00 pm - 8:00 pm"],
    tuesday: ["11:00 am - 1:00 pm"],
  }

  // Animation variants for the modal
  const modalVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } },
    exit: { opacity: 0, y: 50, transition: { duration: 0.2, ease: "easeIn" } },
  }

  // Animation variants for buttons
  const buttonVariants = {
    hover: { scale: 1.05, transition: { duration: 0.2 } },
    tap: { scale: 0.95 },
  }

  return (
    <AnimatePresence mode="wait">
      {!confirmed ? (
        <motion.div
          key="confirmation"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="p-4 bg-[#0b3d91] text-white rounded-xl space-y-4 mt-10"
        >
          <motion.div
            className="p-2 bg-white rounded-lg cursor-pointer hover:bg-slate-200 flex"
            whileHover={{ scale: 1.02 }}
            transition={{ duration: 0.2 }}
          >
            <div>
              <img
                src="/media/image.jpg"
                alt={property.name}
                className="h-[80px] w-[80px] mr-3 object-cover rounded-lg"
              />
            </div>
            <div className="text-gray-700">
              <h3 className="font-medium">{property.name}</h3>
              <p className="text-sm">{property.location.city}</p>
              <div className="flex items-center space-x-3 mt-2 text-sm">
                <p className="flex gap-1 text-[#667085]">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                  >
                    <path
                      d="M12 6L15.75 2.25M15.75 2.25H12M15.75 2.25V6M6 6L2.25 2.25M2.25 2.25L2.25 6M2.25 2.25L6 2.25M6 12L2.25 15.75M2.25 15.75H6M2.25 15.75L2.25 12M12 12L15.75 15.75M15.75 15.75V12M15.75 15.75H12"
                      stroke="#667085"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  {property.area}
                </p>
                <p className="text-[#027A48]">{property.price}</p>
              </div>
            </div>
          </motion.div>
          <div className="flex space-x-4 mt-4">
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="px-4 py-2 bg-gray-200 text-blue-900 rounded-lg"
              onClick={onClose}
            >
              Cancel
            </motion.button>
            <motion.button
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              onClick={() => {
                setConfirmed(true)
                onConfirm()
              }}
            >
              Confirm
            </motion.button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="timepick"
          variants={modalVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
        >
          <TimePick schedule={schedule} property={property} onTimeSelect={(date, time) => console.log(date, time)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}