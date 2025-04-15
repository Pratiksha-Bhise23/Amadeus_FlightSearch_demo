const express = require("express");
const axios = require("axios");
require("dotenv").config();
const bodyParser = require("body-parser");
const ejs = require("ejs");
const moment = require("moment");

function formatDateTime(isoString) {
  return moment(isoString).format("dddd, D MMM YYYY - hh:mm A"); // e.g., Wednesday, 7 Mar 2025 - 05:45 PM
}

function convertToINR(usdPrice) {
  const exchangeRate = 83.0; // Approximate USD to INR conversion rate
  return Math.round(usdPrice * exchangeRate); // Converts USD to INR
}

const app = express();
const PORT = process.env.PORT || 3000;
const APIKey = process.env.APIKey;
const APISecret = process.env.APISecret;

console.log(" API Key:", APIKey);
console.log(" API Secret:", APISecret);
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
let accessToken = "";
const AMADEUS_AUTH_URL =
  "https://test.api.amadeus.com/v1/security/oauth2/token";

async function getAmadeusToken() {
  try {
    const response = await axios.post(
      "https://test.api.amadeus.com/v1/security/oauth2/token",
      new URLSearchParams({
        grant_type: "client_credentials",
        client_id: APIKey,
        client_secret: APISecret,
      }).toString(),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    accessToken = response.data.access_token;
    console.log(" Amadeus Token Acquired!");
  } catch (error) {
    console.error(
      " Error fetching Amadeus Token:",
      error.response?.data || error.message
    );
  }
}

// Fetch flights from Amadeus API
async function fetchFlights(from, to, date) {
  try {
    const response = await axios.get(
      "https://test.api.amadeus.com/v2/shopping/flight-offers",
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
          originLocationCode: from,
          destinationLocationCode: to,
          departureDate: date,
          adults: 1,
          max: 10,
        },
      }
    );

    let flights = response.data.data.map((flight) => {
      return {
        airline: flight.itineraries[0].segments[0].carrierCode,
        departure: flight.itineraries[0].segments[0].departure.at,
        departure: formatDateTime(
          flight.itineraries[0].segments.slice(-1)[0].departure.at
        ),
        arrival:
          flight.itineraries[0].segments[
            flight.itineraries[0].segments.length - 1
          ].arrival.at,
        duration: flight.itineraries[0].duration,
        price: flight.price.total,
        arrival: formatDateTime(
          flight.itineraries[0].segments.slice(-1)[0].arrival.at
        ),
        duration: flight.itineraries[0].duration
          .replace("PT", "")
          .toLowerCase(), // Converts "PT2H30M" -> "2h30m"
        price: convertToINR(flight.price.total), // Convert USD to INR
      };
    });

    // Sort flights from lowest to highest price
    flights.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));

    return flights;
  } catch (error) {
    console.error(
      " Error fetching flights:",
      error.response?.data || error.message
    );
    return [];
  }
}

// Route to render homepage
// app.get("/", (req, res) => {
//   res.render("index", { flights: null });
// });
app.get("/", (req, res) => {
  res.render("index", { flights: [], from: "", to: "", date: "" }); // Ensure values are always passed
});

app.post("/search", async (req, res) => {
  const { from, to, date } = req.body; // Get user input

  // Fetch flight data (your existing logic)
  const flights = await fetchFlights(from, to, date); // Example function

  res.render("index", { flights, from, to, date }); // Pass values to EJS
});

// Start server and get API token
app.listen(3000, async () => {
  console.log(" Server running at http://localhost:3000");
  await getAmadeusToken();
});
