// 1. IMPORT THE MODULES
// We import the specific tools we need from our other files.
import { fetchStockData, processData } from './api.js';
import { createModel, trainModel, predictTomorrow } from './model.js';

// Configuration
const TIME_STEPS = 10; // The AI will look at 10-day patterns

// 2. CONNECT TO THE HTML INTERFACE
const predictBtn = document.getElementById('predict-btn');
const tickerInput = document.getElementById('ticker');
const statusDisplay = document.getElementById('status');
const outputDisplay = document.getElementById('output');

// 3. THE MAIN EXECUTION LOOP
predictBtn.addEventListener('click', async () => {
    const ticker = tickerInput.value.trim();
    
    // Basic validation
    if (!ticker) {
        alert("Please enter a valid Indian stock ticker (e.g., RELIANCE.NSE)");
        return;
    }

    try {
        // Disable the button so the user doesn't click it twice and crash the browser
        predictBtn.disabled = true;
        outputDisplay.innerHTML = "";

        // --- STEP A: FETCH & CLEAN DATA ---
        statusDisplay.innerText = `Fetching historical data for ${ticker.toUpperCase()}...`;
        const rawData = await fetchStockData(ticker);
        
        statusDisplay.innerText = "Normalizing data for the neural network...";
        const { 
            prices, 
            normalizedPrices, 
            inputs, 
            labels, 
            min, 
            max 
        } = processData(rawData, TIME_STEPS);

        // --- STEP B: BUILD & TRAIN THE AI ---
        statusDisplay.innerText = "Building LSTM Architecture...";
        const model = createModel(TIME_STEPS);

        // We pass a callback function here so model.js can update the HTML after every epoch
        const updateUiCallback = (message) => {
            statusDisplay.innerText = message;
        };
        
        await trainModel(model, inputs, labels, TIME_STEPS, updateUiCallback);

        // --- STEP C: PREDICT THE FUTURE ---
        statusDisplay.innerText = "Analyzing recent momentum...";
        const finalPrice = predictTomorrow(model, normalizedPrices, TIME_STEPS, min, max);

        // --- STEP D: DISPLAY RESULT ---
        statusDisplay.innerText = "Analysis Complete!";
        outputDisplay.innerHTML = `
            <strong>Target Stock:</strong> ${ticker.toUpperCase()} <br>
            <strong>Last Close Price:</strong> ₹${prices[prices.length - 1].toFixed(2)} <br><br>
            <span style="font-size: 1.2em; color: #007bff;">
                <strong>AI Predicted Next Close:</strong> ₹${finalPrice}
            </span>
        `;

    } catch (error) {
        // If anything fails (API limits, bad ticker, etc.), show it on the screen
        statusDisplay.innerText = "Error Occurred";
        outputDisplay.innerHTML = `<span style="color: red;">${error.message}</span>`;
        console.error("AI Predictor Error:", error);
    } finally {
        // Always re-enable the button when finished or if it crashes
        predictBtn.disabled = false;
    }
});
