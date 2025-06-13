type ServiceFactory<T = any> = () => T;
type ServiceInstance<T = any> = T;

// Import clean types from services
import type { NotificationService } from "../domains/communication/services/notification.service";
import type { SlackService } from "../domains/communication/services/slack.service";
import type { AudioService } from "../domains/communication/services/AudioService";
import type { ElevenLabsService } from "../domains/communication/services/ElevenLabsService";
import type { LLMService } from "../domains/ai/services/LLMService/llm.service";
import type { ConversationService } from "../domains/ai/services/ConversationService/conversation.service";
import type { MemoryService } from "../domains/ai/services/MemoryService/memory.service";
import type { DecisionMakerService } from "../domains/ai/services/DecisionMakerService/decision-maker.service";
import type { PipelineService } from "../domains/workflow/services/pipeline.service";
import type { ApprovalService } from "../domains/workflow/services/approval.service";
import type { SignalService } from "../domains/workflow/services/signal.service";
import type { StoryblokService } from "../domains/integration/services/StoryblokService/storyblok.service";
import type { GitHubService } from "../domains/integration/services/GithubService/github.service";
import type { ChangelogService } from "../domains/integration/services/ChangelogService/changelog.service";

// Core services - using typeof for services that don't export types
import { databaseService } from "../services/atoms/DatabaseService/database.service";
import { sessionService } from "../services/atoms/SessionService/session.service";
import { streamManager } from "../services/atoms/StreamManagerService/stream.manager.service";
import { qdrantService } from "../services/atoms/QdrantService/qdrant.service";
import { awsService } from "../domains/integration/services/AWS/aws.service";
import { imageService } from "../services/atoms/ImageService/image.service";
import { fileTransferService } from "../services/atoms/FileTransferService/file-transfer.service";

// Agent services
import { agentService } from "../agent/services/AgentService/agent.service";
import { agentFlowService } from "../agent/services/AgentFlowService/agent-flow.service";
import { evaluationService } from "../services/EvaluationService/evaluation.service";
import { toolRunnerService } from "../services/atoms/ToolRunnerService/toolRunner.service";

// Service type registry - maps service names to their types
interface ServiceTypeRegistry {
  // Communication services
  notification: NotificationService;
  slack: SlackService;
  audio: AudioService;
  elevenlabs: ElevenLabsService;

  // AI services
  llm: LLMService;
  conversation: ConversationService;
  memory: MemoryService;
  decisionMaker: DecisionMakerService;

  // Workflow services
  pipeline: PipelineService;
  approval: ApprovalService;
  signal: SignalService;

  // Integration services
  storyblok: StoryblokService;
  github: GitHubService;
  changelog: ChangelogService;

  // Core services
  database: typeof databaseService;
  session: typeof sessionService;
  stream: typeof streamManager;
  qdrant: typeof qdrantService;
  aws: typeof awsService;
  image: typeof imageService;
  fileTransfer: typeof fileTransferService;

  // Agent services
  agent: typeof agentService;
  agentFlow: typeof agentFlowService;
  evaluation: typeof evaluationService;
  toolRunner: typeof toolRunnerService;
}

const createServiceRegistry = () => {
  // Private state - using closures instead of class properties
  const factories = new Map<string, ServiceFactory>();
  const instances = new Map<string, ServiceInstance>();
  const singletons = new Set<string>();

  // Register a service factory
  const register = <K extends keyof ServiceTypeRegistry>(
    name: K,
    factory: ServiceFactory<ServiceTypeRegistry[K]>,
    options: { singleton?: boolean } = { singleton: true }
  ) => {
    factories.set(name, factory);
    if (options.singleton) {
      singletons.add(name);
    }
  };

  // Get service instance with proper typing
  const get = <K extends keyof ServiceTypeRegistry>(
    name: K
  ): ServiceTypeRegistry[K] => {
    // Check if singleton and already instantiated
    if (singletons.has(name as string) && instances.has(name as string)) {
      return instances.get(name as string) as ServiceTypeRegistry[K];
    }

    // Get factory
    const factory = factories.get(name as string);
    if (!factory) {
      throw new Error(
        `Service '${name}' not registered. Available services: ${Array.from(factories.keys()).join(", ")}`
      );
    }

    // Create instance
    const instance = factory();

    // Store if singleton
    if (singletons.has(name as string)) {
      instances.set(name as string, instance);
    }

    return instance as ServiceTypeRegistry[K];
  };

  // Register lazy service (only create when first accessed)
  const registerLazy = <K extends keyof ServiceTypeRegistry>(
    name: K,
    factory: ServiceFactory<ServiceTypeRegistry[K]>,
    options: { singleton?: boolean } = { singleton: true }
  ) => {
    register(name, factory, options);
  };

  // Health check for all services
  const healthCheck = async (): Promise<Record<string, boolean>> => {
    const results: Record<string, boolean> = {};

    for (const [name] of factories) {
      try {
        // Use getAny for internal health checks to avoid type constraints
        const factory = factories.get(name);
        if (!factory) continue;

        const service = factory();

        // Check if service has health method
        if (service && typeof (service as any).health === "function") {
          results[name] = await (service as any).health();
        } else {
          results[name] = true; // Assume healthy if no health method
        }
      } catch (error) {
        console.error(`Health check failed for service '${name}':`, error);
        results[name] = false;
      }
    }

    return results;
  };

  // List all registered services
  const list = (): string[] => {
    return Array.from(factories.keys());
  };

  // Clear all instances (useful for testing)
  const clearInstances = () => {
    instances.clear();
  };

  // Replace service for testing
  const mock = <T>(name: string, mockService: T) => {
    instances.set(name, mockService);
  };

  // Check if service is registered
  const has = (name: string): boolean => {
    return factories.has(name);
  };

  // Get service info
  const info = () => {
    return {
      registered: Array.from(factories.keys()),
      instantiated: Array.from(instances.keys()),
      singletons: Array.from(singletons),
    };
  };

  return {
    register,
    registerLazy,
    get,
    healthCheck,
    list,
    clearInstances,
    mock,
    has,
    info,
  };
};

// Single registry instance
export const serviceRegistry = createServiceRegistry();

// Type helpers for better TypeScript support
export type ServiceRegistry = ReturnType<typeof createServiceRegistry>;
export type { ServiceFactory, ServiceInstance };
