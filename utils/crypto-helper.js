import bcrypt from "bcryptjs";

// Function to hash password
export async function hashPassword(password) {
  try {
    if (!password || typeof password !== 'string') {
      throw new Error("Password must be a non-empty string");
    }
    
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
  } catch (error) {
    console.error("Error hashing password:", error.message);
    throw error;
  }
}

// Function to compare password
export async function comparePassword(password, hash) {
  try {
    // Validate inputs
    if (!password || typeof password !== 'string') {
      console.error("Invalid password provided for comparison");
      return false;
    }
    
    if (!hash || typeof hash !== 'string') {
      console.error("Invalid hash provided for comparison");
      return false;
    }
    
    // Use bcrypt.compare to compare the password with the hash
    return await bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Password comparison error:", error.message);
    return false;
  }
}

// Generate salt (if needed for other purposes)
export function generateSalt() {
  return bcrypt.genSaltSync(10);
}

// Export default object
export default {
  hashPassword,
  comparePassword,
  generateSalt
};