// Confirmations.tsx
"use client"

import { motion, Variants } from "framer-motion"

// Animation variants for child elements
const childVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

export default function AppointmentConfirmed() {
  return (
    <div className="space-y-6 max-w-sm w-full">
      <motion.p
        variants={childVariants}
        className="text-2xl font-semibold text-center"
      >
        Appointment Confirmed
      </motion.p>
      <motion.div variants={childVariants} className="space-y-3">
        <div className="flex items-center justify-between px-4 py-2 bg-[#1e4db7] rounded-4xl text-lg font-normal">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="16"
            viewBox="0 0 20 16"
            fill="none"
          >
            <path
              d="M20 2C20 0.9 19.1 0 18 0H2C0.9 0 0 0.9 0 2V14C0 15.1 0.9 16 2 16H18C19.1 16 20 15.1 20 14V2ZM18 2L10 7L2 2H18ZM18 14H2V4L10 9L18 4V14Z"
              fill="#ffffff"
            />
          </svg>
          <span>Confirmation Email</span>
          <span className="text-green-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21 6.99984L9 18.9998L3.5 13.4998L4.91 12.0898L9 16.1698L19.59 5.58984L21 6.99984Z"
                fill="#12B76A"
              />
            </svg>
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-2 bg-[#1e4db7] rounded-3xl text-lg font-normal">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M19 4H17V3C17 2.73478 16.8946 2.48043 16.7071 2.29289C16.5196 2.10536 16.2652 2 16 2C15.7348 2 15.4804 2.10536 15.2929 2.29289C15.1054 2.48043 15 2.73478 15 3V4H9V3C9 2.73478 8.89464 2.48043 8.70711 2.29289C8.51957 2.10536 8.26522 2 8 2C7.73478 2 7.48043 2.10536 7.29289 2.29289C7.10536 2.48043 7 2.73478 7 3V4H5C4.20435 4 3.44129 4.31607 2.87868 4.87868C2.31607 5.44129 2 6.20435 2 7V19C2 19.7956 2.31607 20.5587 2.87868 21.1213C3.44129 21.6839 4.20435 22 5 22H19C19.7956 22 20.5587 21.6839 21.1213 21.1213C21.6839 20.5587 22 19.7956 22 19V7C22 6.20435 21.6839 5.44129 21.1213 4.87868C20.5587 4.31607 19.7956 4 19 4ZM20 19C20 19.2652 19.8946 19.5196 19.7071 19.7071C19.5196 19.8946 19.2652 20 19 20H5C4.73478 20 4.48043 19.8946 4.29289 19.7071C4.10536 19.5196 4 19.2652 4 19V12H20V19ZM20 10H4V7C4 6.73478 4.10536 6.48043 4.29289 6.29289C4.48043 6.10536 4.73478 6 5 6H7V7C7 7.26522 7.10536 7.51957 7.29289 7.70711C7.48043 7.89464 7.73478 8 8 8C8.26522 8 8.51957 7.89464 8.70711 7.70711C8.89464 7.51957 9 7.26522 9 7V6H15V7C15 7.26522 15.1054 7.51957 15.2929 7.70711C15.4804 7.89464 15.7348 8 16 8C16.2652 8 16.5196 7.89464 16.7071 7.70711C16.8946 7.51957 17 7.26522 17 7V6H19C19.2652 6 19.5196 6.10536 19.7071 6.29289C19.8946 6.48043 20 6.73478 20 7V10Z"
              fill="#FFFFFF"
            />
          </svg>
          <span>Calendar Invite</span>
          <span className="text-green-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="M21 6.99984L9 18.9998L3.5 13.4998L4.91 12.0898L9 16.1698L19.59 5.58984L21 6.99984Z"
                fill="#12B76A"
              />
            </svg>
          </span>
        </div>
      </motion.div>
      {/* <motion.button
        variants={childVariants}
        onClick={() => window.location.reload()}
        className="w-full bg-[#1e4db7] text-white py-2 rounded-lg text-lg font-normal hover:bg-[#2a5dd8] transition-colors"
      >
        Close
      </motion.button> */}
    </div>
  )
}