import { NextResponse } from "next/server";

// Define the POST handler for the session route
export async function POST() {
  console.log("POST /api/session triggered");

  // Check if the OpenAI API Key is available
  if (!process.env.OPENAI_API_KEY) {
      console.error("Error: OPENAI_API_KEY environment variable not set.");
      return NextResponse.json(
        { error: "Server configuration error: API key missing." },
        { status: 500 }
      );
  }
  
  console.log(`Using OPENAI_API_KEY: ${process.env.OPENAI_API_KEY.substring(0, 5)}...`); 

  try {
    console.log("Attempting to create OpenAI realtime session...");
    const response = await fetch(
      "https://api.openai.com/v1/realtime/sessions",
      {
        method: "POST", // This internal call is also POST
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Define session parameters as needed by OpenAI
          model: "gpt-4o-mini-realtime-preview-2024-12-17",
          // Add any other required parameters here if needed based on OpenAI docs
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
        console.error("Error response from OpenAI /sessions:", data);
        // Forward the error from OpenAI if possible, otherwise provide a generic one
        const errorMessage = data?.error?.message || `OpenAI API Error (${response.status})`;
        return NextResponse.json(
          { error: errorMessage },
          { status: response.status }
        );
    }

    console.log("Successfully received session data from OpenAI:", data);
    // Return the data received from OpenAI (e.g., { client_secret, session_id })
    return NextResponse.json(data);

  } catch (error: any) {
    console.error("Exception caught in /api/session POST handler:", error);
    return NextResponse.json(
      { error: `Internal Server Error: ${error.message}` },
      { status: 500 }
    );
  }
}

// Optional: Define a GET handler if needed for other purposes, 
// otherwise POST is sufficient for the frontend's current usage.
// export async function GET() {
//   return NextResponse.json({ message: "Use POST to create a session." }, { status: 405 });
// } 