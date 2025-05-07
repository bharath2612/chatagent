"use client"

import React, { useState } from "react";
import { motion, Variants } from "framer-motion";

// Animation variants (can be shared or defined locally)
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
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// Country codes data
const countryCodes = [
  { code: "+1", country: "US/Canada" },
  { code: "+44", country: "UK" },
  { code: "+91", country: "India" },
  { code: "+61", country: "Australia" },
  { code: "+86", country: "China" },
  { code: "+81", country: "Japan" },
  { code: "+49", country: "Germany" },
  { code: "+33", country: "France" },
  { code: "+39", country: "Italy" },
  { code: "+7", country: "Russia" },
  { code: "+34", country: "Spain" },
  { code: "+55", country: "Brazil" },
  { code: "+52", country: "Mexico" },
  { code: "+65", country: "Singapore" },
  { code: "+971", country: "UAE" },
].sort((a, b) => a.country.localeCompare(b.country));

interface VerificationFormProps {
  onSubmit?: (name: string, phone: string) => void;
}

const VerificationForm = ({ onSubmit }: VerificationFormProps) => {
  const [name, setName] = useState("");
  const [selectedCountryCode, setSelectedCountryCode] = useState("+91"); // Changed default to India
  const [localNumber, setLocalNumber] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!name.trim() || !localNumber.trim()) {
      alert("Please enter both name and phone number.");
      return;
    }
    
    // Combine country code and local number
    const fullPhoneNumber = selectedCountryCode + localNumber.trim();
    
    // Validate the complete phone number
    if (!/^\+\d{10,15}$/.test(fullPhoneNumber)) {
      alert("Please enter a valid phone number.");
      return;
    }
    
    if (onSubmit) {
      onSubmit(name.trim(), fullPhoneNumber);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="p-4 bg-[#0b3d91] text-white rounded-xl w-full max-w-md mx-auto"
    >
      <motion.h3 variants={childVariants} className="text-lg font-semibold mb-3 text-center">
        Verification Required
      </motion.h3>
      <motion.p variants={childVariants} className="text-sm mb-4 text-center">
        Please provide your contact details:
      </motion.p>
      <form onSubmit={handleSubmit} className="w-full">
        <motion.div variants={childVariants} className="mb-3">
          <label className="block text-sm mb-1">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 text-gray-900 rounded bg-white placeholder-gray-500"
            placeholder="Enter your full name"
            required
          />
        </motion.div>
        <motion.div variants={childVariants} className="mb-4">
          <label className="block text-sm mb-1">Phone Number</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <select
              value={selectedCountryCode}
              onChange={(e) => setSelectedCountryCode(e.target.value)}
              className="p-2 text-gray-900 rounded bg-white w-full sm:w-32 text-sm"
            >
              {countryCodes.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.code} {country.country}
                </option>
              ))}
            </select>
            <input
              type="tel"
              value={localNumber}
              onChange={(e) => {
                // Only allow digits
                const value = e.target.value.replace(/\D/g, '');
                setLocalNumber(value);
              }}
              className="flex-1 p-2 text-gray-900 rounded bg-white placeholder-gray-500 min-w-0"
              placeholder="Enter phone number"
              required
              maxLength={10}
            />
          </div>
          <p className="text-xs mt-1 text-gray-300">
            Enter your phone number without country code (e.g., 8281840462)
          </p>
        </motion.div>
        <motion.button
          variants={childVariants}
          type="submit"
          className="w-full bg-blue-600 hover:bg-blue-700 p-2 rounded font-medium transition-colors"
        >
          Submit & Send OTP
        </motion.button>
      </form>
    </motion.div>
  );
};

export default VerificationForm; 