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

interface VerificationFormProps {
  onSubmit?: (name: string, phone: string) => void;
}

const VerificationForm = ({ onSubmit }: VerificationFormProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Basic validation
    if (!name.trim() || !phone.trim()) {
      alert("Please enter both name and phone number.");
      return;
    }
    if (!/^\+\d{10,15}$/.test(phone.trim())) {
        alert("Please enter phone number in E.164 format (e.g., +1234567890).");
        return;
    }
    if (onSubmit) {
      onSubmit(name.trim(), phone.trim());
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className="p-4 bg-[#0b3d91] text-white rounded-xl"
      style={{ margin: 'auto', maxWidth: 'calc(100% - 2rem)' }}
    >
      <motion.h3 variants={childVariants} className="text-lg font-semibold mb-3 text-center">
        Verification Required
      </motion.h3>
      <motion.p variants={childVariants} className="text-sm mb-4 text-center">
        Please provide your contact details:
      </motion.p>
      <form onSubmit={handleSubmit}>
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
          <label className="block text-sm mb-1">Phone Number (e.g., +1...)</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full p-2 text-gray-900 rounded bg-white placeholder-gray-500"
            placeholder="+1234567890"
            required
            pattern="^\+\d{10,15}$"
            title="Phone number must start with + and country code (e.g., +1234567890)"
          />
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