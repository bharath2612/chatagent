"use client"

import React, { useState, useEffect } from "react"
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
  property: PropertyProps
  onTimeSelect?: (date: string, time: string) => void
  showVerification?: boolean
  onVerificationSubmit?: (name: string, phone: string) => void
}

// Add UI components for verification
const VerificationForm = ({ onSubmit }: { onSubmit?: (name: string, phone: string) => void }) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSubmit && name && phone) {
      onSubmit(name, phone);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="p-4 bg-[#0b3d91] text-white rounded-xl"
    >
      <motion.h3 variants={childVariants} className="text-lg font-semibold mb-3">
        Verification Required
      </motion.h3>
      <motion.p variants={childVariants} className="text-sm mb-4">
        To confirm your booking, please provide your contact details:
      </motion.p>
      <form onSubmit={handleSubmit}>
        <motion.div variants={childVariants} className="mb-3">
          <label className="block text-sm mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 text-blue-900 rounded"
            placeholder="Enter your full name"
            required
          />
        </motion.div>
        <motion.div variants={childVariants} className="mb-4">
          <label className="block text-sm mb-1">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 text-blue-900 rounded"
            placeholder="Enter your phone number"
            required
          />
        </motion.div>
        <motion.button
          variants={childVariants}
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-medium"
        >
          Verify & Book
        </motion.button>
      </form>
    </motion.div>
  );
};

export default function TimePick({ 
  schedule, 
  property,
  onTimeSelect,
  showVerification = false,
  onVerificationSubmit
}: TimePickProps) {
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  useEffect(() => {
    const days = Object.keys(schedule);
    if (days.length > 0 && !selectedDay) {
      setSelectedDay(days[0]);
    }
  }, [schedule, selectedDay]);

  // Modified handle time click to handle the new flow
  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    
    // Call the parent callback if provided
    if (onTimeSelect && selectedDay) {
      onTimeSelect(selectedDay, time);
    }
    
    // Show verification form if needed
    if (showVerification) {
      setShowVerificationForm(true);
    }
  };

  // Handle verification form submit
  const handleVerificationSubmit = (name: string, phone: string) => {
    if (onVerificationSubmit) {
      onVerificationSubmit(name, phone);
      setIsConfirmed(true);
    }
  };

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
            <AppointmentConfirmed 
              property={property} 
              date={selectedDay}
              time={selectedTime || ""}
            />
          </motion.div>
        ) : showVerificationForm ? (
          <VerificationForm onSubmit={handleVerificationSubmit} />
        ) : selectedTime ? (
          <motion.div
            key="booking-confirmation"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
          >
            <BookingConfirmation
              onClose={() => setSelectedTime(null)}
              selectedTime={selectedTime}
              selectedDay={selectedDay}
              onConfirm={() => showVerification ? setShowVerificationForm(true) : setIsConfirmed(true)}
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
                className="rounded-lg mb-4 bg-transparent text-white font-semibold ml-2 text-2xl underline disabled:opacity-50"
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                disabled={Object.keys(schedule).length === 0}
              >
                {Object.keys(schedule).length === 0 ? (
                  <option className="bg-[#0b3d91] text-white text-2xl" value="">Loading...</option>
                ) : (
                  Object.keys(schedule).map((day) => (
                    <option
                      key={day}
                      value={day}
                      className="bg-[#0b3d91] text-white"
                    >
                      {day}
                    </option>
                  ))
                )}
              </select>
            </motion.p>
            <motion.div variants={childVariants} className="space-y-2">
              {Object.keys(schedule).length === 0 ? (
                <motion.p variants={childVariants} className="italic text-sm">
                  Loading available times...
                </motion.p>
              ) : selectedDay && schedule[selectedDay] && schedule[selectedDay].length > 0 ? (
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
                  No time slots available for {selectedDay}
                </motion.p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}