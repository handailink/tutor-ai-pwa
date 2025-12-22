/**
 * Generate a unique ID that works in both secure and insecure contexts.
 * Falls back to crypto.getRandomValues or Math.random if crypto.randomUUID is not available.
 */
export function generateId(): string {
  // Try crypto.randomUUID first (available in secure contexts)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch (e) {
      // Fall through to fallback methods
    }
  }

  // Fallback: Use crypto.getRandomValues if available
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    try {
      // Generate UUID v4 format using crypto.getRandomValues
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      
      // Set version (4) and variant bits
      bytes[6] = (bytes[6] & 0x0f) | 0x40; // Version 4
      bytes[8] = (bytes[8] & 0x3f) | 0x80; // Variant 10
      
      // Convert to UUID string format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const hex = Array.from(bytes)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      
      return [
        hex.slice(0, 8),
        hex.slice(8, 12),
        hex.slice(12, 16),
        hex.slice(16, 20),
        hex.slice(20, 32),
      ].join('-');
    } catch (e) {
      // Fall through to Math.random fallback
    }
  }

  // Last resort: Use Math.random (less secure but always available)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}



