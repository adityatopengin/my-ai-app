// ==========================================
// API CONFIGURATION
// ==========================================
// Replace 'YOUR_API_KEY_HERE' with your free key from alphavantage.co
// Note: Alpha Vantage requires a registered key for Indian stock tickers (NSE/BSE).
const API_KEY = 'YOUR_API_KEY_HERE'; 

/**
 * 1. FETCH DATA
 * Connects to Alpha Vantage to pull the last 100 days of daily prices.
 */
export async function fetchStockData(ticker) {
    // Indian Market Logic: Default to National Stock Exchange (.NSE) if no exchange is specified
    let symbol = ticker.toUpperCase().trim();
    if (!symbol.includes('.NSE') && !symbol.includes('.BOM') && !symbol.startsWith('^')) {
        symbol = symbol + '.NSE';
        console.log(`Auto-appended .NSE. Now searching for: ${symbol}`);
    }

    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${API_KEY}`;
    
    const response = await fetch(url);
    const data = await response.json();

    // Check if the API returned an error or if the limit was reached
    if (data["Error Message"]) {
        throw new Error("Invalid Ticker Symbol. Make sure it is listed on the NSE or BSE.");
    }
    if (data["Information"] && data["Information"].includes("rate limit")) {
        throw new Error("API Limit reached (25 calls/day). Please wait or upgrade your Alpha Vantage key.");
    }

    return data["Time Series (Daily)"];
}

/**
 * 2. PROCESS & NORMALIZE DATA
 * Neural networks are highly inaccurate with large numbers (like ₹25,000 for Nifty).
 * This function scales all prices down to decimals between 0 and 1.
 */
export function processData(dailyData, timeSteps) {
    // Extract closing prices from the JSON and reverse them so the oldest date is first
    const prices = Object.values(dailyData).map(day => parseFloat(day["4. close"])).reverse();
    
    if (prices.length < timeSteps + 1) {
        throw new Error("Not enough historical data to train the AI. Choose a stock with a longer history.");
    }

    // Find the absolute highest and lowest prices to use for scaling
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    // Normalize prices: Formula -> (Price - Min) / (Max - Min)
    const normalizedPrices = prices.map(p => (p - min) / (max - min));

    // Create the "Learning Windows"
    // E.g., If timeSteps = 10, the AI looks at Day 1-10 to guess Day 11. 
    // Then it looks at Day 2-11 to guess Day 12, etc.
    const inputs = [];
    const labels = [];
    for (let i = 0; i < normalizedPrices.length - timeSteps; i++) {
        inputs.push(normalizedPrices.slice(i, i + timeSteps)); // The past sequence
        labels.push(normalizedPrices[i + timeSteps]);          // The target future price
    }
    
    // Return everything needed for training and the final prediction
    return { 
        prices, 
        normalizedPrices, 
        inputs, 
        labels, 
        min, 
        max 
    };
}
