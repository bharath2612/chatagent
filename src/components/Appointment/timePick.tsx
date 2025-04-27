"use client"

import React, { useState } from "react"
import BookingConfirmation from "./BookingConfirmation"
import AppointmentConfirmed from "./Confirmations"
import { motion, AnimatePresence, Variants } from "framer-motion"

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
  area :string
  location: PropertyLocation
  mainImage: string
  galleryImages: PropertyImage[]
  units: PropertyUnit[]
  amenities: Amenity[]
  onClose?: () => void
}
// Animation variants for the container
const containerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
      when: "beforeChildren",
      staggerChildren: 0.2,
    },
  },
  exit: { opacity: 0, y: 20, transition: { duration: 0.3 } },
}

// Animation variants for child elements
const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
}

type Schedule = {
  [day: string]: string[]
}

interface TimePickProps {
  schedule: Schedule
  property: PropertyProps // Add property prop
}

export default function TimePick({ schedule, property }: TimePickProps) {
  const [selectedDay, setSelectedDay] = useState<string>("Monday")
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false)

  const handleTimeClick = (time: string) => {
    setSelectedTime(time)
  }

  const handleCloseConfirmation = () => {
    setSelectedTime(null)
  }

  const handleConfirmBooking = () => {
    setIsConfirmed(true)
  }

  return (
    <div className="p-4 absolute top-36 bg-[#0b3d91] text-white rounded-xl space-y-4">
      <AnimatePresence mode="wait">
        {isConfirmed ? (
          <motion.div
            key="appointment-confirmed"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <AppointmentConfirmed property={property} />
          </motion.div>
        ) : selectedTime ? (
          <motion.div
            key="booking-confirmation"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <BookingConfirmation
              onClose={handleCloseConfirmation}
              selectedTime={selectedTime}
              selectedDay={selectedDay}
              onConfirm={handleConfirmBooking}
              property={property}
            />
          </motion.div>
        ) : (
          <motion.div
            key="time-pick"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <motion.p variants={childVariants} className="text-lg ">
              <em className="text-3xl font-sans">
                Appointment time available for {property.name}
              </em>
              <select
                className="rounded-lg mb-4 bg-transparent text-white font-semibold ml-2 text-2xl underline"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
              >
                <option className="bg-[#0b3d91] text-white text-2xl">--day--</option>
                {Object.keys(schedule).map((day) => (
                  <option
                    key={day}
                    value={day}
                    className="bg-[#0b3d91] text-white"
                  >
                    {day}
                  </option>
                ))}
              </select>
            </motion.p>
            <motion.div variants={childVariants} className="space-y-2">
              {schedule[selectedDay] && schedule[selectedDay].length > 0 ? (
                schedule[selectedDay].map((time, index) => (
                  <motion.div
                    key={index}
                    variants={childVariants}
                    className="flex justify-between items-center px-4 py-3 bg-[#1e4db7] rounded-full shadow-md cursor-pointer hover:bg-[#2a5dd8]"
                    onClick={() => handleTimeClick(time)}
                  >
                    <span className="font-semibold">{selectedDay}</span>
                    <span className="text-sm">{time}</span>
                  </motion.div>
                ))
              ) : (
                <motion.p variants={childVariants} className="italic text-sm">
                  No time slots available
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}