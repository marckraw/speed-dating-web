import { serviceRegistry } from "../registry/service-registry";

import { createAudioService } from "./AudioService";
import { createElevenLabsService } from "./ElevenLabsService";
import { createLLMService } from "./LLMService/llm.service";

// Register communication services
const registerCommunicationServices = () => {
  serviceRegistry.registerLazy("audio", createAudioService);
  serviceRegistry.registerLazy("elevenlabs", createElevenLabsService);
  serviceRegistry.registerLazy("llm", createLLMService);
};

// Domain-specific service accessors (functional style)
const createCommunicationServices = () => {
  const audio = () => serviceRegistry.get("audio");
  const elevenlabs = () => serviceRegistry.get("elevenlabs");
  const llm = () => serviceRegistry.get("llm");

  return {
    audio,
    elevenlabs,
    llm,
  };
};

// Initialize services on import
registerCommunicationServices();

// Export individual service accessors for convenience
export const { audio, elevenlabs, llm } = createCommunicationServices();
