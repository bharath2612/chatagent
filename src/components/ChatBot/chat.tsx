"use client"

import React from "react"
import { useState, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MessageSquare, X, Mic, MicOff, Phone, Send } from "lucide-react"
import PropertyList from "../PropertyComponents/PropertyList"
import PropertyConfirmation from "../Appointment/confirmProperty" // Updated import
import AppointmentConfirmed from "../Appointment/Confirmations"
import { VoiceWaveform } from "./VoiceWaveForm"

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
export default function RealEstateAgent() {
  const [inputVisible, setInputVisible] = useState(false)
  const [micMuted, setMicMuted] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [showProperties, setShowProperties] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [appointment, setAppointment] = useState(false)
  const [selectedProperty, setSelectedProperty] = useState<PropertyProps | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>("Monday")
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false)

  const schedule = {
    monday: ["10:00 am - 12:00 pm", "2:00 pm - 4:00 pm", "6:00 pm - 8:00 pm"],
    tuesday: ["11:00 am - 1:00 pm"],
  }

   const properties: PropertyProps[] = [
    {
      name: "Skyline Heights",
      price: "₹1.8 Crores",
      area: "1200 sq.ft",
      location: { city: "Chennai", mapUrl: "https://www.google.com/maps/embed?pb=..." },
      mainImage: "/media/image.jpg",
      galleryImages: [
        { url: "/media/image.jpg", alt: "Thumbnail 1" },
        { url: "/media/image1.jpg", alt: "Thumbnail 2" },
        { url: "/media/image2.png", alt: "Thumbnail 3" },
        { url: "/media/image3.png", alt: "Thumbnail 4" },
      ],
      units: [{ type: "2 BHK" }, { type: "3 BHK" }],
      amenities: [{ name: "Parking" }, { name: "Gym" }, { name: "Pool" }],
      onClose: () => {},
    },
    {
      name: "Ocean View",
      price: "₹2.5 Crores",
      area: "1200 sqft",
      location: { city: "Mumbai", mapUrl: "https://www.google.com/maps/embed?pb=..." },
      mainImage: "/placeholder.svg?height=150&width=300",
      galleryImages: [
        { url: "/media/image.jpg", alt: "Thumbnail 1" },
        { url: "/media/image1.jpg", alt: "Thumbnail 2" },
        { url: "/media/image2.png", alt: "Thumbnail 3" },
        { url: "/media/image3.png", alt: "Thumbnail 4" },
      ],
      units: [{ type: "3 BHK" }, { type: "4 BHK" }],
      amenities: [{ name: "Parking" }, { name: "Gym" }, { name: "Terrace" }],
      onClose: () => {},
    },
  ]

  const toggleInput = () => {
    setInputVisible(!inputVisible)
    if (!inputVisible) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 300)
    }
  }

  const toggleMic = () => {
    setMicMuted(!micMuted)
  }

  const handleSend = () => {
    if (inputValue.trim()) {
      setShowProperties(true)
      setInputValue("")
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSend()
    }
  }

  const handleScheduleVisit = (property: PropertyProps) => {
    setShowProperties(false)
    setSelectedProperty(property)
    setAppointment(true)
    setSelectedTime(null) // Reset time selection
    setIsConfirmed(false) // Reset confirmation
  }

  const handleTimeClick = (time: string) => {
    setSelectedTime(time)
  }

  const handleCloseConfirmation = () => {
    setSelectedTime(null)
  }

  const handleConfirmBooking = () => {
    setIsConfirmed(true)
  }

  const handleReset = () => {
    setAppointment(false)
    setSelectedProperty(null)
    setSelectedTime(null)
    setIsConfirmed(false)
  }

  return (
    <div
      className="relative bg-blue-900 rounded-3xl overflow-hidden text-white"
      style={{ width: "329px", height: "611px" }}
    >
      {/* Header */}
      <div className="flex items-center p-4">
        <div className="flex items-center">
          <div className="bg-white rounded-full p-1 mr-2">
            <div className="text-blue-800 w-8 h-8 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="42" height="42" viewBox="0 0 42 42" fill="none">
                <circle cx="21" cy="21" r="21" fill="white" />
                <path d="M15.9833 12.687L11 16.2194V30.1284H15.9833V12.687Z" fill="#2563EB" />
                <rect width="9.58318" height="4.98325" transform="matrix(-1 0 0 1 31.3162 25.1455)" fill="#2563EB" />
                <rect width="4.79159" height="7.85821" transform="matrix(-1 0 0 1 31.3162 17.2871)" fill="#2563EB" />
                <path d="M20.4589 9.45097L16.3664 12.0161L28.2862 21.0735L31.3162 17.2868L20.4589 9.45097Z" fill="#2563EB" />
                <g filter="url(#filter0_i_3978_26224)">
                  <path d="M15.9833 12.687L16.7499 13.262V29.5534L15.9833 30.1284V12.687Z" fill="#6193FF" />
                </g>
                <g filter="url(#filter1_i_3978_26224)">
                  <path d="M16.2157 12.7009L16.3665 12.0161L26.5735 19.773L25.8041 20.0584L16.2157 12.7009Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter2_i_3978_26224)">
                  <path d="M25.7582 19.9701L26.5248 19.6826V25.145H25.7582V19.9701Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter3_i_3978_26224)">
                  <path d="M21.7331 25.1455L20.9665 24.3789H25.7581L26.5247 25.1455H21.7331Z" fill="#3B71E6" />
                </g>
                <g filter="url(#filter4_i_3978_26224)">
                  <path d="M20.9665 24.3779L21.7331 25.1446V30.1278L20.9665 29.5528V24.3779Z" fill="#6193FF" />
                </g>
                <path d="M25.7582 24.3779L26.5248 25.1446" stroke="#4B83FC" strokeWidth="0.0134678" strokeLinecap="round" />
                <path d="M25.7582 19.9701L26.5248 19.6826" stroke="#4B83FC" strokeWidth="0.0134678" strokeLinecap="round" />
                <defs>
                  <filter id="filter0_i_3978_26224" x="15.9833" y="12.687" width="0.766663" height="17.8005" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter1_i_3978_26224" x="16.2156" y="12.0161" width="10.3578" height="8.40162" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter2_i_3978_26224" x="25.7582" y="19.6826" width="0.766663" height="5.82154" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter3_i_3978_26224" x="20.9665" y="24.3789" width="5.55823" height="1.12574" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                  <filter id="filter4_i_3978_26224" x="20.9665" y="24.3779" width="0.766663" height="6.10914" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                    <feFlood floodOpacity="0" result="BackgroundImageFix" />
                    <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha" />
                    <feOffset dy="0.359141" />
                    <feGaussianBlur stdDeviation="0.17957" />
                    <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
                    <feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.4 0" />
                    <feBlend mode="normal" in2="shape" result="effect1_innerShadow_3978_26224" />
                  </filter>
                </defs>
              </svg>
            </div>
          </div>
          <span className="font-medium">Real Estate AI Agent</span>
        </div>
        <button className="ml-auto">
          <X size={20} />
        </button>
      </div>
      <div className="border-1 h-10 rounded-3xl w-72 p-4 justify-evenly ml-5">
       <VoiceWaveform/>
       </div>
      {/* Content Area */}
        {appointment && selectedProperty && (
      <div className="h-[400px]">
           <PropertyConfirmation
           onClose={handleCloseConfirmation}
           selectedTime={selectedTime || ""}
           selectedDay={selectedDay}
           onConfirm={handleConfirmBooking}
           property={selectedProperty}
         />
        </div>
        )}

        {/* {!showProperties && (
          <div className="text-center">
            <div className="flex justify-center space-x-1">
              {Array(15)
                .fill(0)
                .map((_, i) => (
                  <div key={i} className="w-1 h-1 bg-white rounded-full opacity-50"></div>
                ))}
            </div>
          </div>
        )} */}

        <AnimatePresence mode="wait">
          {showProperties && (
        <div className="flex-1 flex flex-col items-center justify-center h-[350px] relative mt-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="absolute inset-0 overflow-auto px-4 py-2"
            >
              <PropertyList properties={properties} onScheduleVisit={handleScheduleVisit}/>
            </motion.div>
          </div>
          )}
        </AnimatePresence>

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0">
        <AnimatePresence>
          {inputVisible && (
            <motion.div
              initial={{ y: 60 }}
              animate={{ y: 0 }}
              exit={{ y: 60 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="rounded-xl w-[320px] -mb-1 ml-1 h-[48px] shadow-lg bg-[#47679D]" // Added shadow for glass effect
            >
              <div className="flex items-center justify-between w-full px-4 py-2 rounded-lg">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Show me some properties in Dubai"
                  className="flex-1 mt-1 bg-transparent outline-none text-white placeholder:text-white  placeholder:opacity-50"
                />
                <button onClick={handleSend} className="ml-2 mt-2 text-white">
                  <Send size={18} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex justify-between items-center p-3">
          <button onClick={toggleInput} className="bg-[#47679D] p-3 rounded-full">
            <MessageSquare size={20} />
          </button>

          <div className="flex justify-center space-x-1">
            {Array(15)
              .fill(0)
              .map((_, i) => (
                <div key={i} className="w-1 h-1 bg-white rounded-full opacity-50"></div>
              ))}
          </div>

          <button onClick={toggleMic} className="bg-[#47679D] p-3 rounded-full">
            {micMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <button className="bg-red-500 p-3 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 9" fill="none">
              <path d="M3.4 8.4L1.1 6.15C0.900003 5.95 0.800003 5.71667 0.800003 5.45C0.800003 5.18333 0.900003 4.95 1.1 4.75C2.56667 3.16667 4.25834 1.97933 6.175 1.188C8.09167 0.396667 10.0333 0.000667507 12 8.40337e-07C13.9667 -0.000665826 15.9043 0.395334 17.813 1.188C19.7217 1.98067 21.4173 3.168 22.9 4.75C23.1 4.95 23.2 5.18333 23.2 5.45C23.2 5.71667 23.1 5.95 22.9 6.15L20.6 8.4C20.4167 8.58333 20.204 8.68334 19.962 8.7C19.72 8.71667 19.4993 8.65 19.3 8.5L16.4 6.3C16.2667 6.2 16.1667 6.08333 16.1 5.95C16.0333 5.81667 16 5.66667 16 5.5V2.65C15.3667 2.45 14.7167 2.29167 14.05 2.175C13.3833 2.05833 12.7 2 12 2C11.3 2 10.6167 2.05833 9.95 2.175C9.28334 2.29167 8.63334 2.45 8 2.65V5.5C8 5.66667 7.96667 5.81667 7.9 5.95C7.83334 6.08333 7.73334 6.2 7.6 6.3L4.7 8.5C4.5 8.65 4.279 8.71667 4.037 8.7C3.795 8.68334 3.58267 8.58333 3.4 8.4ZM6 3.45C5.51667 3.7 5.05 3.98767 4.6 4.313C4.15 4.63833 3.68334 5.00067 3.2 5.4L4.2 6.4L6 5V3.45ZM18 3.5V5L19.8 6.4L20.8 5.45C20.3167 5.01667 19.85 4.64167 19.4 4.325C18.95 4.00833 18.4833 3.73333 18 3.5Z" fill="#F9FAFB" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}