"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion } from "framer-motion"

interface OTPInputProps {
  onSubmit: (otp: string) => void
  onCancel?: () => void
}

export default function OTPInput({ onSubmit, onCancel }: OTPInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Set up refs array
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6)
  }, [])

  // Focus first input on mount
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
    const value = e.target.value
    
    // Only allow numbers
    if (!/^[0-9]*$/.test(value)) return
    
    // Handle pasting full OTP
    if (value.length > 1) {
      // If pasting a code, split it into the boxes
      const pastedOtp = value.slice(0, 6).split("")
      const newOtp = [...otp]
      
      pastedOtp.forEach((digit, idx) => {
        if (index + idx < 6) {
          newOtp[index + idx] = digit
        }
      })
      
      setOtp(newOtp)
      
      // Focus on appropriate box or last box if filled
      const nextIndex = Math.min(index + pastedOtp.length, 5)
      inputRefs.current[nextIndex]?.focus()
      return
    }
    
    // Normal single digit input
    const newOtp = [...otp]
    newOtp[index] = value
    setOtp(newOtp)
    
    // Auto-focus next input if available
    if (value !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
    // Handle backspace and delete
    if ((e.key === "Backspace" || e.key === "Delete") && !otp[index]) {
      // Move to previous input if current is empty
      if (index > 0) {
        e.preventDefault()
        inputRefs.current[index - 1]?.focus()
      }
    }
    
    // Arrow navigation
    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      inputRefs.current[index - 1]?.focus()
    }
    
    if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault()
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleSubmit = async () => {
    const otpValue = otp.join("")
    
    // Validate OTP length
    if (otpValue.length !== 6) return
    
    setIsSubmitting(true)
    
    try {
      await onSubmit(otpValue)
    } catch (error) {
      console.error("Error submitting OTP:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Check if all digits are filled
  const isComplete = otp.every(digit => digit !== "")
  
  return (
    <div className="bg-blue-800 rounded-xl p-4 sm:p-6 w-full max-w-md mx-auto text-white shadow-lg">
      <h2 className="text-xl font-semibold mb-2 text-center">Enter Verification Code</h2>
      <p className="text-sm opacity-80 mb-6 text-center">
        We sent a 6-digit code to your phone number. Please enter it below to continue.
      </p>
      
      <div className="grid grid-cols-6 gap-1 sm:gap-2 mb-6 px-2">
        {Array.from({ length: 6 }, (_, i) => (
          <input
            key={i}
            type="text"
            maxLength={6} // Allow pasting full code
            value={otp[i]}
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            ref={(el) => {
              inputRefs.current[i] = el
            }}
            className="w-full aspect-square text-center text-xl bg-blue-700 border-2 border-blue-600 
                      rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                      text-white min-w-0"
            autoComplete="one-time-code"
            inputMode="numeric"
            pattern="[0-9]*"
            aria-label={`Digit ${i + 1} of verification code`}
          />
        ))}
      </div>
      
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 px-2">
        {onCancel && (
          <button
            onClick={onCancel}
            className="w-full sm:flex-1 px-4 py-3 bg-blue-700 hover:bg-blue-600 transition-colors rounded-md"
            disabled={isSubmitting}
            type="button"
          >
            Cancel
          </button>
        )}
        
        <motion.button
          onClick={handleSubmit}
          className={`w-full sm:flex-1 px-4 py-3 rounded-md transition-colors ${
            isComplete 
              ? 'bg-blue-500 hover:bg-blue-400' 
              : 'bg-blue-700 opacity-50 cursor-not-allowed'
          }`}
          disabled={!isComplete || isSubmitting}
          type="button"
          whileTap={{ scale: isComplete && !isSubmitting ? 0.95 : 1 }}
          whileHover={{ scale: isComplete && !isSubmitting ? 1.02 : 1 }}
        >
          {isSubmitting ? 'Verifying...' : 'Verify'}
        </motion.button>
      </div>
      
      <p className="text-xs text-center mt-6 opacity-70">
        Didn't receive the code? <button className="text-blue-300 underline">Resend</button>
      </p>
    </div>
  )
}
