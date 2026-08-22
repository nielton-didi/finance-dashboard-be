// Prints a fresh base64-encoded 32-byte key suitable for CREDENTIALS_ENCRYPTION_KEY.
import { randomBytes } from 'crypto';

console.log(randomBytes(32).toString('base64'));
