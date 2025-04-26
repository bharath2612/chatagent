// BookingConfirmation.tsx
"use client"

import React, { useState } from "react"
import { motion, Variants } from "framer-motion"

// Animation variants for child elements
const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

interface BookingConfirmationProps {
  onClose: () => void
  selectedTime: string
  selectedDay: string
  onConfirm: () => void
}

export default function BookingConfirmation({
  onClose,
  selectedTime,
  selectedDay,
  onConfirm,
}: BookingConfirmationProps) {
  const [name, setName] = useState<string>("")
  const [number, setNumber] = useState<string>("")

  return (
    <div className="space-y-6 max-w-sm w-full">
      <motion.p
        variants={childVariants}
        className="text-xl font-normal leading-6"
      >
        To confirm the booking please verify your name and number
      </motion.p>
      <motion.div variants={childVariants} className="space-y-4">
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
      <motion.div variants={childVariants} className="space-y-3">
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