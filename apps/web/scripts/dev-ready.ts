import { copyFileSync, existsSync } from 'node:fs';

// Ensure .env.local exists
if (!existsSync('.env.local')) {
  if (existsSync('.env.example')) {
    copyFileSync('.env.example', '.env.local');
    console.log('✓ Created .env.local from .env.example');
  }
}
