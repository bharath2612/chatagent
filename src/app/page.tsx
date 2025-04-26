// import Image from "next/image";

import RealEstateAgent from "@/components/ChatBot/chat";

// import PropertyDetailsDemo from "@/components/PropertyDetailsDemo";
export default function Home() {
  return (
   <div>
    <div className="left-0 top-0 h-screen w-screen flex items-center justify-center">
      <RealEstateAgent/>
    </div>
   </div>
  );
}
