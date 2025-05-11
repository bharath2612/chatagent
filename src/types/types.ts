// Copied from oldCode/src/app/types.ts

export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED";

export interface ToolParameterProperty {
  type: string;
  description?: string;
  enum?: string[];
  pattern?: string;
  properties?: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
  items?: ToolParameterProperty;
}

export interface ToolParameters {
  type: string;
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface Tool {
  type: "function";
  name: string;
  description: string;
  parameters: ToolParameters;
}

export interface AgentMetadata {
  org_id?: string;
  org_name?: string;
  active_project?: string;
  property_location?: string;
  project_names?: string[];
  chatbot_id?: string;
  session_id?: string;
  is_verified?: boolean;
  customer_name?: string;
  phone_number?: string;
  project_ids?: string[];
  project_locations?: Record<string, string>;
  has_scheduled?: boolean;
  language?: string;
  came_from?: string;
  property_id_to_schedule?: string;
  lastReturnedPropertyId?: string;
}

export interface AgentConfig {
  name: string;
  publicDescription: string; // gives context to agent transfer tool
  instructions: string;
  tools: Tool[];
  toolLogic?: Record<
    string,
    (args: any, transcriptLogsFiltered: TranscriptItem[]) => Promise<any> | any
  >;
  downstreamAgents?: AgentConfig[] | { name: string; publicDescription: string }[];
  metadata?: AgentMetadata; // Use the defined interface
}

export type AllAgentConfigsType = Record<string, AgentConfig[]>;

export interface TranscriptItem {
  itemId: string;
  type: "MESSAGE" | "BREADCRUMB"; // Assuming BREADCRUMB might be deprecated or handled differently
  role?: "user" | "assistant" | "system"; // Added system role possibility
  text?: string; // Simplified primary content field
  title?: string; // For BREADCRUMB if kept
  data?: Record<string, any>; // For BREADCRUMB if kept
  expanded?: boolean; // UI state, might move elsewhere
  timestamp?: string; // Consider using Date object
  createdAtMs: number;
  status?: "IN_PROGRESS" | "DONE" | "ERROR"; // Added ERROR status
  isHidden?: boolean; // UI state, might move elsewhere
  agentName?: string; // Track which agent sent this message
}

export interface Log {
  id: number;
  timestamp: string;
  direction: string;
  eventName: string;
  data: any;
  expanded: boolean;
  type: string;
}

export interface ServerEventContent {
    type?: string;
    transcript?: string | null;
    text?: string;
}

export interface ServerEventItem {
    id?: string;
    object?: string;
    type?: string;
    status?: string;
    name?: string; // For function calls
    arguments?: string; // For function calls
    role?: "user" | "assistant";
    content?: ServerEventContent[];
}

export interface ServerEventResponseOutput {
    type?: string;
    name?: string; // For function calls
    arguments?: any; // For function calls
    call_id?: string; // For function calls
}

export interface ServerEventResponse {
    output?: ServerEventResponseOutput[];
    status_details?: {
      error?: any;
    };
}

export interface ServerEvent {
  type: string;
  event_id?: string;
  item_id?: string;
  transcript?: string; // For transcription events
  delta?: string; // For transcription delta events
  session?: {
    id?: string;
  };
  item?: ServerEventItem;
  response?: ServerEventResponse;
}

// Kept from old types, might be replaced by simpler logging or context
export interface LoggedEvent {
  id: number;
  direction: "client" | "server";
  expanded: boolean;
  timestamp: string;
  eventName: string;
  eventData: Record<string, any>; // can have arbitrary objects logged
} 