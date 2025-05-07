"use client"

import React, { useState, useEffect, useCallback } from "react"
import BookingConfirmation from "./BookingConfirmation"
import AppointmentConfirmed from "./Confirmations"
import { motion, AnimatePresence, Variants } from "framer-motion"
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Import calendar CSS
import { X, ChevronLeft, ChevronRight } from "lucide-react"

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
  property: PropertyProps;
  schedule: Record<string, string[]>;
  onTimeSelect: (date: string, time: string) => void;
  timeSlots?: string[];
}

export default function TimePick({ schedule, property, onTimeSelect, timeSlots }: TimePickProps) {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableTimes, setAvailableTimes] = useState<string[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const defaultTimeSlots = ["11:00 AM", "4:00 PM"];
  const actualTimeSlots = timeSlots || defaultTimeSlots;
  
  // Format the date for display and storage
  const formatDate = (date: Date): string => {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    
    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };
  
  // When a date is selected, update the selectedDate state and set available times
  const handleDateClick = (date: Date) => {
    const formattedDate = formatDate(date);
    console.log(`[TimePick] Selected date: ${formattedDate}`);
    
    setSelectedDate(date);
    
    // Always use the standardized time slots for any date
    setAvailableTimes(actualTimeSlots);
    
    // Clear any previously selected time
    setSelectedTime(null);
    
    // IMPORTANT: Notify the parent component about date selection ONLY
    // This triggers the agent to respond with a prompt to select time
    onTimeSelect(formattedDate, '');
  };
  
  // When a time is selected, update the selectedTime state and call the onTimeSelect callback
  const handleTimeClick = (time: string) => {
    console.log(`[TimePick] Selected time: ${time}`);
    setSelectedTime(time);
    
    // Call the parent component's onTimeSelect callback with the selected date and time
    if (selectedDate) {
      const formattedDate = formatDate(selectedDate);
      onTimeSelect(formattedDate, time);
    }
  };
  
  // Helper to determine if a date is selectable (for the calendar)
  // Now we'll allow all dates except past dates
  const isDateAvailable = (date: Date): boolean => {
    // Don't allow past dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    
    // Don't allow weekends
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return false;
    
    // All other dates are available
    return true;
  };
  
  // Generate calendar days for the current month
  const generateCalendarDays = () => {
    const daysInMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth() + 1,
      0
    ).getDate();
    
    const firstDayOfMonth = new Date(
      currentMonth.getFullYear(),
      currentMonth.getMonth(),
      1
    ).getDay();
    
    let days = [];
    
    // Add empty cells for days before the 1st of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(<div key={`empty-${i}`} className="h-10 w-10"></div>);
    }
    
    // Add days of the month
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i);
      const isAvailable = isDateAvailable(date);
      const isSelected = selectedDate?.getDate() === i && 
                        selectedDate?.getMonth() === currentMonth.getMonth() &&
                        selectedDate?.getFullYear() === currentMonth.getFullYear();
      
      days.push(
        <button
          key={`day-${i}`}
          className={`h-10 w-10 rounded-full flex items-center justify-center text-lg font-medium
                     ${isAvailable ? 'cursor-pointer hover:bg-blue-500 hover:text-white hover:shadow-md active:bg-blue-600' : 'opacity-30 cursor-not-allowed'}
                     ${isSelected ? 'bg-blue-600 text-white shadow-md' : isAvailable ? 'text-white' : 'text-gray-400'}`}
          onClick={() => isAvailable && handleDateClick(date)}
          disabled={!isAvailable}
          type="button"
          aria-label={`Select ${i}`}
        >
          {i}
        </button>
      );
    }
    
    return days;
  };
  
  // Navigation for the calendar
  const goToPreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  
  const goToNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };
  
  // Get month and year for display
  const monthYearDisplay = () => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  };

  return (
    <div className="bg-blue-800 rounded-xl p-6 w-full max-w-md mx-auto text-white shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{property.name}</h2>
        <button className="text-white opacity-70 hover:opacity-100 p-2 hover:bg-blue-700 rounded-full">
          <X size={20} />
        </button>
      </div>
      
      <p className="mb-6 text-sm opacity-80">{property.description || 'Schedule a visit to view this property.'}</p>
      
      {/* Calendar Section */}
      <div className="mb-6 p-4 bg-blue-900 rounded-lg shadow-inner">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={goToPreviousMonth} 
            className="text-white p-2 hover:bg-blue-800 rounded-full transition-colors"
            aria-label="Previous month"
          >
            <ChevronLeft size={24} />
          </button>
          <h3 className="text-white font-medium text-lg">{monthYearDisplay()}</h3>
          <button 
            onClick={goToNextMonth} 
            className="text-white p-2 hover:bg-blue-800 rounded-full transition-colors"
            aria-label="Next month"
          >
            <ChevronRight size={24} />
          </button>
        </div>
        
        {/* Day labels */}
        <div className="grid grid-cols-7 gap-2 mb-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
            <div key={index} className="h-10 w-10 flex items-center justify-center text-sm font-bold text-blue-300">
              {day}
            </div>
          ))}
        </div>
        
        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-2">
          {generateCalendarDays()}
        </div>
      </div>
      
      {/* Time Selection Section */}
      {selectedDate && (
        <div className="mb-4">
          <h3 className="font-medium mb-4 text-lg">Available Times for {formatDate(selectedDate)}</h3>
          <div className="grid grid-cols-2 gap-4">
            {availableTimes.length > 0 ? (
              availableTimes.map((time, index) => (
                <button
                  key={index}
                  className={`py-4 px-6 rounded-lg border text-lg font-medium transition-all
                    ${selectedTime === time
                      ? 'bg-blue-600 border-blue-500 font-bold shadow-md scale-105'
                      : 'border-blue-700 hover:bg-blue-700 hover:shadow-md active:scale-95'
                    }`}
                  onClick={() => handleTimeClick(time)}
                  type="button"
                  aria-label={`Select time ${time}`}
                >
                  {time}
                </button>
              ))
            ) : (
              <p className="col-span-2 text-center text-sm">No available times for this date.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}