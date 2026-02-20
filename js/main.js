// ==========================================
// 1. IMPORTS & CONFIGURATION
// ==========================================
import { fetchMarketData, fetchNewsSentiment, processMultiFeatureData } from './api.js';
import { createModel, trainModel, predictTomorrow } from './model.js';

const TIME_STEPS = 10;      // Days of memory per training window
const FEATURE_COUNT = 5;    // Price, Volume, SMA, RSI, Sentiment
let priceChart = null;      // Holds the Chart.js instance

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const apiKeyInput = document.getElementById('api-key');
const tickerInput = document.getElementById('ticker');
const predictBtn = document.getElementById('predict-btn');

// Status & Progress
const progressBar = document.getElementById('ai-progress');
const statusText = document.getElementById('status');
const finalPredictionEl = document.getElementById('final-prediction');
const chartStatus = document.getElementById('chart-status');

// Indicator Cards
const valRSI = document.getElementById('val-rsi');
const valSMA = document.getElementById('val-sma');
const valNews = document.getElementById('val-news');
const valVol = document.getElementById('val-vol');

// ==========================================
// 3. MAIN EXECUTION LOOP
// ==========================================
predictBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();
    const ticker = tickerInput.value.trim();

    if (!apiKey) return alert("Please enter your Alpha Vantage API Key.");
    if (!ticker) return alert("Please enter a stock ticker.");

    try {
        // UI Reset & Lock
        predictBtn.disabled = true;
        progressBar.style.width = '0%';
        finalPredictionEl.innerText = "Calculating...";
        chartStatus.innerText = "Fetching Live Data...";
        chartStatus.className = "badge badge-neutral";

        // --- PHASE 1: PARALLEL DATA FETCHING ---
        statusText.innerText = "Connecting to Market and News APIs...";
        console.log("[SYSTEM]: Initiating parallel fetch for Market Data & News Sentiment.");
        
        // Fetch both at the same time to save waiting time
        const [marketResponse, sentimentScore] = await Promise.all([
            fetchMarketData(ticker, apiKey),
            fetchNewsSentiment(ticker, apiKey)
        ]);

        // --- PHASE 2: FEATURE ENGINEERING ---
        statusText.innerText = "Calculating Technical Indicators (RSI, SMA)...";
        const processed = processMultiFeatureData(marketResponse.dailyData, sentimentScore, TIME_STEPS);

        // Update Dashboard Indicator Cards
        valRSI.innerText = processed.recentRSI;
        valSMA.innerText = `₹${processed.recentSMA}`;
        valNews.innerText = processed.sentimentScore;
        valVol.innerText = Number(processed.recentVolume).toLocaleString('en-IN'); // Format for India

        // Draw Historical Chart
        drawChart(processed.displayData, ticker);

        // --- PHASE 3: BUILD & TRAIN THE AI ---
        chartStatus.innerText = "Training Neural Network";
        chartStatus.className = "badge";
        chartStatus.style.backgroundColor = "var(--accent-blue)";
        
        const model = createModel(TIME_STEPS, FEATURE_COUNT);

        await trainModel(
            model, 
            processed.inputs, 
            processed.labels, 
            TIME_STEPS, 
            FEATURE_COUNT, 
            (progressPct, loss) => {
                // Live UI Updates during GPU Training
                progressBar.style.width = `${progressPct}%`;
                statusText.innerText = `Training AI... Epochs: ${progressPct}% | Error Loss: ${loss}`;
            }
        );

        // --- PHASE 4: PREDICT & DISPLAY ---
        statusText.innerText = "Running final inference sequence...";
        
        // Grab the most recent training window to predict the next step
        const lastWindow = processed.inputs[processed.inputs.length - 1];
        const finalPrice = predictTomorrow(model, lastWindow, TIME_STEPS, FEATURE_COUNT, processed.minPrice, processed.maxPrice);

        // Update UI
        finalPredictionEl.innerText = `₹${finalPrice}`;
        statusText.innerText = "Analysis Complete. Model ready for next ticker.";
        chartStatus.innerText = "Prediction Rendered";
        chartStatus.style.backgroundColor = "var(--accent-green)";

        // Add the prediction to the Chart
        addPredictionToChart(processed.displayData, finalPrice);

        // Enable action buttons (Dummy functionality for future)
        document.querySelector('.btn-buy').disabled = false;
        document.querySelector('.btn-sell').disabled = false;
        document.querySelector('.btn-outline').disabled = false;

    } catch (error) {
        statusText.innerText = "Execution Halted due to Error.";
        chartStatus.innerText = "Error";
        chartStatus.style.backgroundColor = "var(--accent-red)";
        console.error("Pipeline Failure:", error.message);
    } finally {
        predictBtn.disabled = false;
    }
});

// ==========================================
// 4. CHART.JS INTEGRATION
// ==========================================
function drawChart(displayData, ticker) {
    const ctx = document.getElementById('priceChart').getContext('2d');
    
    // Destroy previous chart if user searches a new ticker
    if (priceChart) priceChart.destroy();

    const dates = displayData.map(d => d.date);
    const prices = displayData.map(d => d.price);

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: `${ticker.toUpperCase()} Close Price`,
                data: prices,
                borderColor: '#3b82f6', // Accent Blue
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                pointRadius: 0,
                fill: true,
                tension: 0.1 // Slight curve
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#94a3b8' } }
            },
            scales: {
                x: { ticks: { color: '#94a3b8', maxTicksLimit: 10 }, grid: { color: '#334155' } },
                y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
            }
        }
    });
}

function addPredictionToChart(displayData, prediction) {
    // Add a new "Tomorrow" label
    priceChart.data.labels.push("Tomorrow (AI)");
    
    // Create a new dataset just for the prediction point to style it differently
    const predictionData = Array(displayData.length).fill(null);
    predictionData.push(prediction);

    priceChart.data.datasets.push({
        label: 'AI Projection',
        data: predictionData,
        borderColor: '#10b981', // Accent Green
        backgroundColor: '#10b981',
        pointRadius: 6,
        pointHoverRadius: 8,
        borderDash: [5, 5], // Dotted line connecting to the actual price
        showLine: true
    });

    // Connect the last real price to the predicted price
    priceChart.data.datasets[1].data[displayData.length - 1] = displayData[displayData.length - 1].price;

    priceChart.update();
}
