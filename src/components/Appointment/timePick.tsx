"use client"

import React, { useState, useEffect, useCallback } from "react"
import BookingConfirmation from "./BookingConfirmation"
import AppointmentConfirmed from "./Confirmations"
import { motion, AnimatePresence, Variants } from "framer-motion"
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Import calendar CSS

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
  [day: string]: string[] // Format: "Weekday, Month Day" -> ["11:00 AM", "4:00 PM"]
}

interface TimePickProps {
  schedule: Schedule
  property: PropertyProps
  onTimeSelect?: (date: string, time: string) => void
  showVerification?: boolean
  onVerificationSubmit?: (name: string, phone: string) => void
}

export default function TimePick({ 
  schedule, 
  property,
  onTimeSelect,
  showVerification = false,
  onVerificationSubmit
}: TimePickProps) {

  // --- Helper Functions Inside Component ---
  const getAvailableDates = useCallback((currentSchedule: Schedule): Date[] => {
    return Object.keys(currentSchedule).map(dateStr => new Date(dateStr.split(', ')[1] + ", " + new Date().getFullYear()));
  }, []);

  const tileDisabled = useCallback(({ date, view }: { date: Date, view: string }): boolean => {
    if (view === 'month') {
      const availableDates = getAvailableDates(schedule); 
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) return true;
      return !availableDates.some(availableDate => 
        availableDate.getFullYear() === date.getFullYear() &&
        availableDate.getMonth() === date.getMonth() &&
        availableDate.getDate() === date.getDate()
      );
    }
    return false;
  }, [schedule, getAvailableDates]);

  const formatDateForSchedule = useCallback((date: Date): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${days[date.getDay()]}, ${monthNames[date.getMonth()]} ${date.getDate()}`;
  }, []);
  
  // --- Component State ---
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [showVerificationForm, setShowVerificationForm] = useState<boolean>(false);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState(true);

  // Update loading state and find first available date when schedule arrives
  useEffect(() => {
    if (Object.keys(schedule).length > 0) {
      setIsLoading(false);
      // Find the first available date in the schedule to pre-select
      const firstAvailableDateStr = Object.keys(schedule)[0];
      if (firstAvailableDateStr && !selectedDate) { // Only set if not already selected
        const initialDate = new Date(firstAvailableDateStr.split(', ')[1] + ", " + new Date().getFullYear());
        // Check if this initial date is valid before setting
        if (!tileDisabled({ date: initialDate, view: 'month' })) {
          setSelectedDate(initialDate);
        }
      }
    } else {
      setIsLoading(true);
      setSelectedDate(null); // Clear date if schedule becomes empty
    }
  }, [schedule, selectedDate, tileDisabled]); // Added tileDisabled as dependency

  // Handle date selection from calendar
  const handleDateChange = (value: any) => {
    if (value instanceof Date) {
      setSelectedDate(value);
      setSelectedTime(null); // Reset time when date changes
    }
  };

  // Handle time button click
  const handleTimeClick = (time: string) => {
    setSelectedTime(time);
    if (onTimeSelect && selectedDate) {
      const formattedDate = formatDateForSchedule(selectedDate);
      onTimeSelect(formattedDate, time);
    }
    if (showVerification) {
      setShowVerificationForm(true);
    }
  };

  // Handle verification form submit
  const handleVerificationSubmit = (name: string, phone: string) => {
    if (onVerificationSubmit) {
      onVerificationSubmit(name, phone);
      setIsConfirmed(true); // Move to confirmation screen after submit
    }
  };
  
  // Get available times for the selected date
  const availableTimes = selectedDate ? schedule[formatDateForSchedule(selectedDate)] || [] : [];

  return (
    <div className="p-4 absolute top-36 bg-[#0b3d91] text-white rounded-xl space-y-4 w-[calc(100%-2rem)] mx-auto">
      <AnimatePresence mode="wait">
        {isConfirmed ? (
          <motion.div key="appointment-confirmed" variants={containerVariants} initial="hidden" animate="visible" exit="exit">
            <AppointmentConfirmed 
              property={property} 
              date={selectedDate ? formatDateForSchedule(selectedDate) : ""}
              time={selectedTime || ""}
            />
          </motion.div>
        ) : (
          <motion.div key="time-pick-calendar" variants={containerVariants} initial="hidden" animate="visible" exit="exit" className="flex flex-col items-center">
            <motion.h3 variants={childVariants} className="text-lg font-semibold mb-2 text-center">
              Select a Date & Time for {property.name}
            </motion.h3>
            
            <motion.div variants={childVariants} className="mb-4 w-full calendar-container">
              <Calendar
                onChange={handleDateChange}
                value={selectedDate}
                minDate={new Date()}
                tileDisabled={tileDisabled}
                className="bg-blue-800 border-none rounded-lg text-white"
              />
            </motion.div>

            {selectedDate && !isLoading && (
              <motion.div variants={childVariants} className="w-full flex justify-center space-x-4">
                {availableTimes.length > 0 ? (
                  availableTimes.map((time) => (
                    <button
                      key={time}
                      onClick={() => handleTimeClick(time)}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors 
                        ${selectedTime === time ? 'bg-white text-blue-900' : 'bg-blue-600 hover:bg-blue-700'}`}
                    >
                      {time}
                    </button>
                  ))
                ) : (
                  <p className="text-sm italic opacity-75">No slots available for this date.</p>
                )}
              </motion.div>
            )}
            
            {isLoading && (
               <p className="text-sm italic opacity-75 mt-4">Loading available dates...</p>
            )}

          </motion.div>
        )}
      </AnimatePresence>
      {/* Add some basic styling for the calendar */}
      <style jsx global>{`
        .calendar-container .react-calendar {
          border: none;
          background-color: transparent;
          font-family: inherit;
          width: 100%;
        }
        .calendar-container .react-calendar__navigation button {
          color: white;
          min-width: 34px;
          background: none;
          font-size: 1rem;
        }
        .calendar-container .react-calendar__navigation button:enabled:hover,
        .calendar-container .react-calendar__navigation button:enabled:focus {
          background-color: #1e4db7; /* Slightly lighter blue */
        }
        .calendar-container .react-calendar__month-view__weekdays__weekday abbr {
          text-decoration: none;
          font-weight: normal;
          color: #a0aec0; /* Lighter gray */
        }
        .calendar-container .react-calendar__tile {
          color: white;
          background: none;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          height: 36px; 
        }
        .calendar-container .react-calendar__tile:enabled:hover,
        .calendar-container .react-calendar__tile:enabled:focus {
          background-color: #1e4db7;
        }
        .calendar-container .react-calendar__tile--now {
          background: #2a5dd8; /* Highlight current day */
        }
        .calendar-container .react-calendar__tile--active {
          background: #4a90e2; /* Highlight selected day */
          color: white;
        }
         .calendar-container .react-calendar__tile--disabled {
          background-color: transparent;
          color: #4a5568; /* Darker gray for disabled */
          cursor: not-allowed;
        }
      `}</style>
    </div>
  )
}