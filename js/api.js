// Fetch the raw data from the API
export async function fetchStockData(symbol, apiKey) {
    const response = await fetch(`https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=${apiKey}`);
    const data = await response.json();
    return data["Time Series (Daily)"];
}

// Format and normalize the data for the neural network
export function processData(dailyData, timeSteps) {
    const prices = Object.values(dailyData).map(d => parseFloat(d["4. close"])).reverse();
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
