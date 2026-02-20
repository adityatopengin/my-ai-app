// Import the tools we built in the other files
import { fetchStockData, processData } from './api.js';
import { createModel, trainModel, predictTomorrow } from './model.js';

const API_KEY = 'YOUR_ALPHA_VANTAGE_KEY';
const SYMBOL = 'AAPL';
const TIME_STEPS = 10;

// Listen for the button click
document.getElementById('predict-btn').addEventListener('click', async () => {
    const status = document.getElementById('status');
    const output = document.getElementById('output');
    
    try {
        // Step 1: Data
        status.innerText = "Fetching data...";
        const rawData = await fetchStockData(SYMBOL, API_KEY);
        const { prices, normalizedPrices, inputs, labels, min, max } = processData(rawData, TIME_STEPS);
        
        // Step 2: AI Setup & Training
        status.innerText = "Training AI (This takes a moment)...";
        const model = createModel(TIME_STEPS);
        await trainModel(model, inputs, labels, TIME_STEPS);
        
        // Step 3: Prediction
        status.innerText = "Calculating prediction...";
        const finalPrice = predictTomorrow(model, normalizedPrices, TIME_STEPS, min, max);
        
        status.innerText = "Complete!";
        output.innerHTML = `<strong>Predicted ${SYMBOL}:</strong> $${finalPrice}`;
        
    } catch (error) {
        status.innerText = "Error occurred!";
        console.error("Make sure your API key is correct:", error);
    }
});
