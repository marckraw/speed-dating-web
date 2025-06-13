type ServiceFactory<T = any> = () => T;
type ServiceInstance<T = any> = T;
import type { AudioService } from "../services/AudioService";
import type { ElevenLabsService } from "../services/ElevenLabsService";
import type { LLMService } from "../services/LLMService/llm.service";

// Service type registry - maps service names to their types
interface ServiceTypeRegistry {
  audio: AudioService;
  elevenlabs: ElevenLabsService;

  // AI services
  llm: LLMService;
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
