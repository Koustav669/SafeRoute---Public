// TOP OF SCRIPT.JS
console.log("🚀 SafePath Script is LOADED!");

import { db, collection, addDoc, getDocs } from "./firebase/config.js";
import { getRouteSafetyAnalysis } from "./backend/gemini.js";

// Check if buttons are found
document.addEventListener("DOMContentLoaded", () => {
    console.log("Static UI is ready!");
    const sosBtn = document.getElementById("sos-btn");
    if (sosBtn) {
        console.log("SOS Button found and linked!");
        sosBtn.addEventListener("click", () => alert("SOS TEST WORKING!"));
    } else {
        console.error("SOS Button NOT found. Check your HTML IDs!");
    }
});

// Global Variables
let map, directionsService, directionsRenderer;

// --- 1. INITIALIZE MAP (Attached to window for Google Maps API) ---
window.initMap = async function() {
    console.log("📍 Google Maps Initializing...");
    const defaultLoc = { lat: 28.6139, lng: 77.2090 }; 

    map = new google.maps.Map(document.getElementById("map"), {
        center: defaultLoc,
        zoom: 14,
        disableDefaultUI: true,
        styles: [ 
            { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
            { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
            { featureType: "road", elementType: "geometry", stylers: [{ color: "#38414e" }] }
        ]
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        map: map,
        polylineOptions: { strokeColor: "#00e676", strokeWeight: 5 }
    });

    // Setup Autocomplete
    new google.maps.places.Autocomplete(document.getElementById("start-input"));
    new google.maps.places.Autocomplete(document.getElementById("end-input"));

    loadSafetyIncidents();
};

// --- 2. BUTTON LOGIC (Wrapped in DOMContentLoaded) ---
document.addEventListener("DOMContentLoaded", () => {
    console.log("✅ DOM Fully Loaded");

    // Route Button
    const findRouteBtn = document.getElementById("find-route-btn");
    if (findRouteBtn) {
        findRouteBtn.addEventListener("click", handleRouting);
    }

    // Modal Controls
    const reportBtn = document.getElementById("report-btn");
    const closeModal = document.getElementById("close-modal");
    const submitReport = document.getElementById("submit-report");

    if (reportBtn) {
        reportBtn.addEventListener("click", () => {
            document.getElementById("report-modal").classList.remove("hidden");
        });
    }

    if (closeModal) {
        closeModal.addEventListener("click", () => {
            document.getElementById("report-modal").classList.add("hidden");
        });
    }

    if (submitReport) {
        submitReport.addEventListener("click", submitIncident);
    }

    // SOS Button
    const sosBtn = document.getElementById("sos-btn");
    if (sosBtn) {
        sosBtn.addEventListener("click", () => {
            alert("🚨 SOS TRIGGERED: Sending Location to Emergency Contacts...");
        });
    }
});

// --- 3. HELPER FUNCTIONS ---

async function handleRouting() {
    const start = document.getElementById("start-input").value;
    const end = document.getElementById("end-input").value;

    if (!start || !end) return alert("Please enter both locations.");

    directionsService.route(
        { origin: start, destination: end, travelMode: google.maps.TravelMode.WALKING },
        async (response, status) => {
            if (status === "OK") {
                directionsRenderer.setDirections(response);
                
                const route = response.routes[0];
                const summary = route.summary;
                const steps = route.legs[0].steps.map(s => s.instructions.replace(/<[^>]*>?/gm, '')).join(" ").substring(0, 300);
                
                document.getElementById("ai-insight").classList.remove("hidden");
                document.getElementById("ai-text").innerText = "Consulting Gemini AI...";
                
                const safetyData = await getRouteSafetyAnalysis(summary, steps);
                
                const scoreBadge = document.getElementById("safety-score");
                scoreBadge.innerText = `Score: ${safetyData.score}/10`;
                document.getElementById("ai-text").innerText = safetyData.advisory;
                
                scoreBadge.style.background = safetyData.score > 7 ? "#00e676" : (safetyData.score > 4 ? "#ffea00" : "#ff3d00");
                
            } else {
                alert("Route not found.");
            }
        }
    );
}

async function submitIncident() {
    const type = document.getElementById("issue-type").value;
    const center = map.getCenter();

    try {
        await addDoc(collection(db, "incidents"), {
            type: type,
            lat: center.lat(),
            lng: center.lng(),
            timestamp: new Date()
        });
        alert("Report Submitted Successfully!");
        document.getElementById("report-modal").classList.add("hidden");
        loadSafetyIncidents();
    } catch (e) {
        console.error("Firebase Error:", e);
    }
}

async function loadSafetyIncidents() {
    try {
        const querySnapshot = await getDocs(collection(db, "incidents"));
        querySnapshot.forEach((doc) => {
            const data = doc.data();
            new google.maps.Marker({
                position: { lat: data.lat, lng: data.lng },
                map: map,
                title: data.type
            });
        });
    } catch (e) {
        console.error("Error loading incidents:", e);
    }
}
