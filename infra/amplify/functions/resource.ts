import { defineFunction } from '@aws-amplify/backend';

// Create a function which creates an auth challenge
export const createAuthChallenge = defineFunction({
  name: 'create-auth-challenge',
  entry: 'handler.ts',
});
