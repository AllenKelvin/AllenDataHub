import { scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import bcrypt from "bcrypt";

const scryptAsync = promisify(scrypt);

const storedHash = "$2b$10$D4RGNMzUB0WkvqrucVluJOQCJ95/MtN3axstHghmkStqsc7QaW8i.";

async function comparePassword(supplied, stored) {
  if (!stored) return false;

  // Format 1: scrypt format (hex.salt)
  if (stored.includes(".")) {
    // Check if it's bcrypt format (starts with $2) or scrypt (hex.salt)
    if (stored.startsWith("$2")) {
      // bcrypt format
      try {
        return await bcrypt.compare(supplied, stored);
      } catch (e) {
        console.log("bcrypt error:", e);
        return false;
      }
    }
    // else scrypt format - skip for now
  }

  return false;
}

const result = await comparePassword("123456", storedHash);
console.log("Result:", result);