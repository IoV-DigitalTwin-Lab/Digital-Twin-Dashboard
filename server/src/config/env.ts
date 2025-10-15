import { config } from 'dotenv';

let loaded = false;

export function loadEnv(): void {
  if (loaded) {
    return;
  }

  const result = config();

  if (result.error) {
    console.warn('Warning: unable to load .env file:', result.error);
  }

  loaded = true;
}
