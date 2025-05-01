import { createClient } from "@supabase/supabase-js";
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
/* ------------------------------------------------------------------ */ /*  0.  Environment + Supabase client                                 */ /* ------------------------------------------------------------------ */ const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
/** Wrap the response with permissive CORS headers (Edge Function). */ function withCORS(body, status = 200) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, X-Client-Info",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (status === 204) {
    return new Response(null, {
      status,
      headers
    });
  }
  return new Response(JSON.stringify(body), {
    status,
    headers
  });
}
/* ------------------------------------------------------------------ */ /*  2.  Action handlers                                               */ /* ------------------------------------------------------------------ */ /* ---------- Action 1: lookupProperty ------------------------------ */ async function handleLookupProperty(data) {
  const { query, project_ids, k = 3 } = data;
  if (!query || !project_ids?.length) {
    return {
      error: "Missing required parameters: query and project_ids"
    };
  }
  const embeddings = new OpenAIEmbeddings({
    openAIApiKey: OPENAI_API_KEY,
    modelName: "text-embedding-3-small"
  });
  try {
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabaseClient,
      tableName: "document_sections",
      queryName: "match_document_sections",
      filter: {
        project_ids
      }
    });
    const results = await vectorStore.similaritySearch(query, k);
    return {
      properties: results
    };
  } catch (err) {
    console.error("Error in handleLookupProperty:", err);
    return {
      error: "Error querying vector store"
    };
  }
}
/* ---------- Action 2: calculateRoute ------------------------------ */ async function handleCalculateRoute(data) {
  const { origin, destination } = data;
  if (!origin || !destination) {
    return {
      error: "Missing required parameters: origin and destination"
    };
  }
  const [originLat, originLng] = origin.split(",").map(parseFloat);
  const [destLat, destLng] = destination.split(",").map(parseFloat);
  const payload = {
    origin: {
      location: {
        latLng: {
          latitude: originLat,
          longitude: originLng
        }
      }
    },
    destination: {
      location: {
        latLng: {
          latitude: destLat,
          longitude: destLng
        }
      }
    },
    travelMode: "DRIVE",
    routingPreference: "TRAFFIC_AWARE",
    computeAlternativeRoutes: false,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false
    },
    languageCode: "en-US",
    units: "IMPERIAL"
  };
  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": "routes.legs.distanceMeters,routes.legs.duration,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters"
      },
      body: JSON.stringify(payload)
    });
    const responseData = await response.json();
    if (responseData.routes?.length) {
      const leg = responseData.routes[0].legs?.[0];
      const summary = `Route Summary:\nLeg Distance: ${leg?.distanceMeters} m\nDuration: ${leg?.duration}\n`;
      return {
        routeSummary: summary
      };
    }
    return {
      error: "No route found."
    };
  } catch (err) {
    console.error("Error in handleCalculateRoute:", err);
    return {
      error: "Error calculating route."
    };
  }
}
/* ---------- Action 3: fetchOrgMetadata --------------------------- */ async function handleFetchOrgMetadata(data) {
  const { session_id, chatbot_id } = data;
  if (!session_id || !chatbot_id) {
    return {
      error: "Missing required parameters: session_id and chatbot_id"
    };
  }
  try {
    // Session metadata
    const { data: sessionMeta, error: sessionErr } = await supabaseClient.from("session_metadata").select("*").eq("session_id", session_id).maybeSingle();
    if (sessionErr) throw sessionErr;
    // Defaults
    let org_id = null;
    let org_name = "the company";
    let active_project = "N/A";
    let project_names = [];
    let property_location = "N/A";
    let project_ids = [];
    const project_locations = {};
    let is_verified = false;
    let customer_name = "";
    let phone_number = "";
    // Phone verifications
    const { data: verifications, error: vErr } = await supabaseClient.from("phone_verifications").select("is_verified, name, phone_number").eq("session_id", session_id);
    if (vErr) throw vErr;
    if (verifications?.length) {
      is_verified = verifications.some((v)=>v.is_verified);
      const rec = verifications.find((v)=>v.is_verified) ?? verifications[0];
      customer_name = rec.name;
      phone_number = rec.phone_number;
    }
    // Apply session overrides or fallback to chatbot → org
    if (sessionMeta) {
      org_name = sessionMeta.org_name;
      active_project = sessionMeta.active_project;
      project_names = sessionMeta.project_names || [];
      property_location = sessionMeta.property_location;
      org_id = sessionMeta.org_id;
      project_ids = sessionMeta.project_ids || [];
    } else {
      const { data: chatbotRow, error: cbErr } = await supabaseClient.from("chatbot").select("org_id").eq("id", chatbot_id).maybeSingle();
      if (cbErr) throw cbErr;
      org_id = chatbotRow?.org_id || null;
      if (org_id) {
        const { data: orgRow, error: orgErr } = await supabaseClient.from("organization").select("org_name").eq("org_id", org_id).maybeSingle();
        if (orgErr) throw orgErr;
        org_name = orgRow.org_name;
      }
    }
    // Fetch project_ids via chatbot_projects if still missing
    if (!project_ids.length) {
      const { data: cbProjects, error: cbProjErr } = await supabaseClient.from("chatbot_projects").select("project_id").eq("chatbot_id", chatbot_id);
      if (cbProjErr) throw cbProjErr;
      project_ids = cbProjects.map((item)=>item.project_id);
    }
    // Build project_names & locations
    if (project_ids.length) {
      const { data: projects, error: projErr } = await supabaseClient.from("projects").select("property_name, latitude_longitude").in("id", project_ids);
      if (projErr) throw projErr;
      for (const p of projects){
        project_names.push(p.property_name);
        project_locations[p.property_name] = p.latitude_longitude;
      }
      if (property_location === "N/A" && Object.values(project_locations).length) {
        property_location = Object.values(project_locations)[0];
      }
    }
    return {
      org_id,
      org_name,
      active_project,
      project_names,
      property_location,
      chatbot_id,
      is_verified,
      project_ids,
      project_locations,
      customer_name,
      phone_number
    };
  } catch (err) {
    console.error("Error in handleFetchOrgMetadata:", err);
    return {
      error: "Error fetching organizational metadata."
    };
  }
}
/* ---------- Action 4: getPropertyImages ------------------------- */ async function handleGetPropertyImages(data) {
  const { property_name, query, project_ids } = data;
  if (!property_name || property_name === "N/A") {
    return {
      error: "Please specify a property name"
    };
  }
  const searchQuery = query ? `${property_name} ${query} image photos pictures` : `${property_name} image photos pictures views`;
  try {
    const embeddings = new OpenAIEmbeddings({
      openAIApiKey: OPENAI_API_KEY,
      modelName: "text-embedding-3-small"
    });
    const vectorStore = await SupabaseVectorStore.fromExistingIndex(embeddings, {
      client: supabaseClient,
      tableName: "document_sections",
      queryName: "match_document_sections",
      filter: {
        project_ids
      }
    });
    const results = await vectorStore.similaritySearch(searchQuery, 10);
    const imageResults = results.filter((doc)=>doc.metadata?.image_url).map((doc)=>({
        image_url: doc.metadata.image_url,
        description: doc.pageContent || "Property image",
        metadata: doc.metadata
      }));
    if (!imageResults.length) {
      return {
        message: `No images found for ${property_name}. You can view the property details on the official website.`,
        images: []
      };
    }
    return {
      property_name,
      images: imageResults,
      message: `Here are ${imageResults.length} images for ${property_name}.`
    };
  } catch (err) {
    console.error("Error in handleGetPropertyImages:", err);
    return {
      error: "Failed to retrieve property images."
    };
  }
}
/* ---------- Action 5: getProjectDetails ------------------------- */ async function handleGetProjectDetails(data) {
  const { project_ids } = data;
  console.log("getProjectDetails → incoming project_ids:", project_ids);
  if (!Array.isArray(project_ids) || project_ids.length === 0) {
    return {
      error: "Missing or empty required parameter: project_ids (array of UUIDs)"
    };
  }
  try {
    // 1) fetch all matching rows
    const { data: rows, error } = await supabaseClient.from("projects").select(`
        id,
        property_name,
        market_price_per_sqft,
        our_price,
        location,
        locality,
        amenities,
        latitude_longitude,
        types_of_units,
        total_land_area,
        website_url,
        images
      `).in("id", project_ids);
    console.log("Raw fetched rows:", rows, "error:", error);
    if (error) {
      console.error("Supabase error in getProjectDetails:", error);
      throw error;
    }
    if (!rows || rows.length === 0) {
      return {
        error: "No projects found for the provided project_ids"
      };
    }
    // 2) map each row to your API shape
    const formatted = rows.map((row)=>({
        id: row.id,
        name: row.property_name || "Unnamed property",
        price: row.our_price != null ? `${row.our_price}` : row.market_price_per_sqft != null ? `${row.market_price_per_sqft} per sqft` : "Price on request",
        area: row.total_land_area != null ? `${row.total_land_area}` : "Area information unavailable",
        location: {
          city: row.locality || row.location || "Location unavailable",
          coords: row.latitude_longitude || ""
        },
        description: "N/A",
        amenities: row.amenities || [],
        units: row.types_of_units || [],
        websiteUrl: row.website_url || "",
        images: Array.isArray(row.images) ? row.images.map((img)=>({
            url: img.url || "",
            alt: img.description || "Property image"
          })) : []
      }));
    console.log("Formatted project details:", formatted);
    return {
      properties: formatted
    };
  } catch (err) {
    console.error("Error in handleGetProjectDetails:", err);
    return {
      error: "Failed to retrieve project details."
    };
  }
}
/* ------------------------------------------------------------------ */ /*  3.  Edge-function entry point                                     */ /* ------------------------------------------------------------------ */ Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return withCORS({}, 204);
  }
  try {
    if (req.method !== "POST") {
      return withCORS({
        error: "Method not allowed"
      }, 405);
    }
    const body = await req.json();
    const { action } = body;
    let result;
    switch(action){
      case "lookupProperty":
        result = await handleLookupProperty(body);
        break;
      case "calculateRoute":
        result = await handleCalculateRoute(body);
        break;
      case "fetchOrgMetadata":
        result = await handleFetchOrgMetadata(body);
        break;
      case "getPropertyImages":
        result = await handleGetPropertyImages(body);
        break;
      case "getProjectDetails":
        result = await handleGetProjectDetails(body);
        break;
      default:
        result = {
          error: "Invalid action."
        };
    }
    return withCORS(result);
  } catch (err) {
    console.error("Error in edge function:", err);
    return withCORS({
      error: "Internal Server Error"
    }, 500);
  }
});
