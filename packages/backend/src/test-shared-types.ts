// Test file to demonstrate using shared types from @/thecore
import { 
  ProgressMessage, 
  validateProgressMessage,
  SharedUser,
  SharedApiResponse,
} from 'core.mrck.dev';

// Example usage of shared types
export function createTestUser(): SharedUser {
  return {
    id: '123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export function createApiResponse<T>(data: T): SharedApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date()
  };
}

export function handleProgressMessage(rawData: unknown): SharedApiResponse<ProgressMessage> {
  const validation = validateProgressMessage(rawData);
  
  if (!validation.success) {
    return {
      success: false,
      error: validation.error,
      timestamp: new Date()
    };
  }

  return {
    success: true,
    data: validation.data,
    timestamp: new Date()
  };
}

// Example usage
const testUser = createTestUser();
const apiResponse = createApiResponse(testUser);

const progressData = {
  type: 'processing',
  content: 'Processing user data...',
  metadata: { userId: testUser.id }
};

const progressResponse = handleProgressMessage(progressData);

console.log('Test User:', testUser);
console.log('API Response:', apiResponse);
console.log('Progress Response:', progressResponse); 