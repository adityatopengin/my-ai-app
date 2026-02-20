// ==========================================
// API CONFIGURATION
// ==========================================
const API_KEY = '98NRX1JF5O1TPGKR'; // Must be a real key

export async function fetchStockData(ticker) {
    let symbol = ticker.toUpperCase().trim();
    
    // Auto-fix for Indian Markets
    if (!symbol.includes('.') && !symbol.startsWith('^')) {
        symbol = symbol + '.NSE';
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // DEBUGGING: This prints the exact API response to your browser console (F12)
    console.log("Alpha Vantage Response:", data);

    // THE FIX: If the "Time Series" data is completely missing, stop the code
    // and throw a specific error to the screen.
    if (!data["Time Series (Daily)"]) {
        if (data["Information"]) {
            throw new Error(`API Limit Reached: ${data["Information"]}`);
        } else if (data["Error Message"]) {
            throw new Error(`Invalid Request: ${data["Error Message"]}`);
        } else if (data["Note"]) {
             throw new Error(`API Warning: ${data["Note"]}`);
        } else {
            throw new Error("No stock data returned. Open Developer Tools (F12) to see the API response.");
        }
    }

    return data["Time Series (Daily)"];
}

export function processData(dailyData, timeSteps) {
    // We also add a safeguard here just in case
    if (!dailyData) {
        throw new Error("Critical Error: The data provided to the math module is empty.");
    }

    const prices = Object.values(dailyData).map(day => parseFloat(day["4. close"])).reverse();
    
    if (prices.length < timeSteps + 2) {
        throw new Error("Insufficient data for this symbol. Try a different stock.");
    }

    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const normalizedPrices = prices.map(p => (p - min) / (max - min));

    const inputs = [];
    const labels = [];

    for (let i = 0; i < normalizedPrices.length - timeSteps; i++) {
        inputs.push(normalizedPrices.slice(i, i + timeSteps)); 
        labels.push(normalizedPrices[i + timeSteps]);          
    }
    
    return { prices, normalizedPrices, inputs, labels, min, max };
}
