// Test setup file for Jest
import { jest } from '@jest/globals';

// Global test timeout
jest.setTimeout(10000);

// Suppress console logs during tests unless explicitly needed
const originalLog = console.log;
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
  // Suppress console output during tests
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  // Restore console output
  console.log = originalLog;
  console.error = originalError;
  console.warn = originalWarn;
});

// Global test utilities
global.testUtils = {
  // Helper to create mock preferences
  createMockPreferences: (overrides = {}) => ({
    firstName: 'TestUser',
    gender: 'male',
    age: 25,
    favoriteColor: '#FF6B6B',
    foodBackgroundColor: '#4ECDC4',
    activitiesBackgroundColor: '#45B7D1',
    likedFoods: [],
    dislikedFoods: [],
    likedDrinks: [],
    dislikedDrinks: [],
    likedFunActivities: [],
    dislikedFunActivities: [],
    likedExerciseActivities: [],
    dislikedExerciseActivities: [],
    environmentNumber: 1,
    environments: [],
    expressionsStyle: 'Kawaii',
    ...overrides
  }),

  // Helper to create mock customizations
  createMockCustomizations: (overrides = {}) => ({
    theme: 'light',
    appName: 'TestApp',
    customAssets: {},
    ...overrides
  }),

  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
}; 