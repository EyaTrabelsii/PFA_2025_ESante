import fetch from "node-fetch";

/**
 * Script to test Morgan logging by making a series of API requests
 *
 * Usage:
 * - Start your server: npm run dev
 * - Run this script: node scripts/test-morgan.js
 */

const BASE_URL = "http://localhost:5000/api";

async function testEndpoints() {
  console.log("Starting Morgan testing script...");
  console.log("Making a series of API requests to test logging...\n");

  try {
    // Test 200 response
    console.log("Testing a valid endpoint (should succeed):");
    await fetch(`${BASE_URL}/auth/verify`);
    console.log("✓ Request sent\n");

    // Test 404 response
    console.log("Testing a non-existent endpoint (should 404):");
    await fetch(`${BASE_URL}/non-existent-path`);
    console.log("✓ Request sent\n");

    // Test 400 response
    console.log("Testing bad request (should 400):");
    await fetch(`${BASE_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}), // Empty body to trigger validation error
    });
    console.log("✓ Request sent\n");

    // Test 500 response (would need a specific endpoint that causes server error)
    // This is just an example and might not actually cause a 500
    console.log("Testing potential server error:");
    try {
      await fetch(`${BASE_URL}/users/invalid-id-format`);
    } catch (err) {
      // Ignore any errors
    }
    console.log("✓ Request sent\n");

    console.log(
      "All test requests sent. Check your server console for Morgan logs."
    );
    console.log(
      "Note: In production mode, only errors (4xx/5xx) will be logged."
    );
    console.log("In development mode, all requests will be logged.");
  } catch (error) {
    console.error("Error running tests:", error);
  }
}

testEndpoints();
