/**
 * 1. THE DUAL-ENGINE FETCHER
 * Fetches both numerical market data and text-based news sentiment.
 */
export async function fetchMarketData(ticker, apiKey) {
    let symbol = ticker.toUpperCase().trim();
    if (!symbol.includes('.') && !symbol.startsWith('^')) symbol += '.BSE';

    console.log(`[SYSTEM]: Fetching Market Data for ${symbol}...`);
    const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&outputsize=compact&apikey=${apiKey}`;
    
    const response = await fetch(url);
    const data = await response.json();

    if (!data || !data["Time Series (Daily)"]) {
        throw new Error(data["Note"] || data["Error Message"] || "Empty market data returned.");
    }
    return { symbol, dailyData: data["Time Series (Daily)"] };
}

export async function fetchNewsSentiment(ticker, apiKey) {
    let baseSymbol = ticker.toUpperCase().trim();
    // The News API sometimes prefers tickers without the exchange suffix
    if (baseSymbol.includes('.')) baseSymbol = baseSymbol.split('.')[0]; 

    console.log(`[SYSTEM]: Analyzing News Sentiment for ${baseSymbol}...`);
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${baseSymbol}&apikey=${apiKey}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        // Calculate average sentiment from recent articles
        let totalSentiment = 0;
        let articleCount = 0;

        if (data.feed && data.feed.length > 0) {
            data.feed.forEach(article => {
                const tickerData = article.ticker_sentiment.find(t => t.ticker === baseSymbol);
                if (tickerData) {
                    totalSentiment += parseFloat(tickerData.ticker_sentiment_score);
                    articleCount++;
                }
            });
        }
        
        // If we found news, average it. If not, return 0.15 (slightly positive/neutral market drift)
        return articleCount > 0 ? (totalSentiment / articleCount) : 0.15;
    } catch (err) {
        console.error("News API failed, defaulting to neutral sentiment.", err);
        return 0.15; // Fallback so the AI doesn't crash if the news API times out
    }
}

/**
 * 2. TECHNICAL INDICATOR MATH
 * Helper functions to calculate SMA and RSI.
 */
function calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(prices[i]); // Not enough data yet, just use the price
        } else {
            const slice = prices.slice(i - period + 1, i + 1);
            const average = slice.reduce((a, b) => a + b, 0) / period;
            sma.push(average);
        }
    }
    return sma;
}

function calculateRSI(prices, period) {
    const rsi = [];
    let gains = 0, losses = 0;

    for (let i = 0; i < prices.length; i++) {
        if (i === 0) {
            rsi.push(50); // Default neutral RSI for day 1
            continue;
        }
        
        const difference = prices[i] - prices[i - 1];
        if (difference >= 0) gains += difference;
        else losses -= difference;

        if (i < period) {
            rsi.push(50); // Calibrating
        } else {
            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
            
            // Remove the oldest data point from our running total
            const oldDiff = prices[i - period + 1] - prices[i - period];
            if (oldDiff >= 0) gains -= oldDiff;
            else losses += oldDiff;
        }
    }
    return rsi;
}

/**
 * 3. MULTI-DIMENSIONAL DATA PROCESSING
 * Syncs Price, Volume, SMA, RSI, and News into a 0-1 scaled tensor.
 */
export function processMultiFeatureData(dailyData, sentimentScore, timeSteps) {
    // 1. Extract and chronological sort (Oldest -> Newest)
    const rawDates = Object.keys(dailyData).reverse();
    const rawPrices = rawDates.map(date => parseFloat(dailyData[date]["4. close"]));
    const rawVolumes = rawDates.map(date => parseFloat(dailyData[date]["5. volume"]));

    // 2. Calculate Technical Indicators
    const smaArray = calculateSMA(rawPrices, 20);
    const rsiArray = calculateRSI(rawPrices, 14);

    // 3. Find Min/Max for Normalization
    const minPrice = Math.min(...rawPrices);
    const maxPrice = Math.max(...rawPrices);
    const minVol = Math.min(...rawVolumes);
    const maxVol = Math.max(...rawVolumes);

    const inputs = [];
    const labels = [];
    const displayData = []; // To send back to Chart.js

    // 4. Build the Learning Windows (Aligning all 5 features)
    for (let i = 0; i < rawPrices.length - timeSteps; i++) {
        const windowFeatures = [];
        
        for (let j = 0; j < timeSteps; j++) {
            const idx = i + j;
            
            // Normalize every feature to a 0.0 - 1.0 scale
            const normPrice = (rawPrices[idx] - minPrice) / (maxPrice - minPrice || 1);
            const normVol = (rawVolumes[idx] - minVol) / (maxVol - minVol || 1);
            const normSMA = (smaArray[idx] - minPrice) / (maxPrice - minPrice || 1);
            const normRSI = rsiArray[idx] / 100;
            // Sentiment is usually -0.5 to +0.5, we shift it to 0-1
            const normSentiment = (sentimentScore + 1) / 2; 

            // This creates a 5-Feature Array for a single day
            windowFeatures.push([normPrice, normVol, normSMA, normRSI, normSentiment]);
        }
        
        inputs.push(windowFeatures);
        
        // The label (what the AI must guess) is just the price of the next day
        const targetPriceNorm = (rawPrices[i + timeSteps] - minPrice) / (maxPrice - minPrice || 1);
        labels.push(targetPriceNorm);
        
        // Save the raw data so we can draw it on the chart later
        displayData.push({
            date: rawDates[i + timeSteps],
            price: rawPrices[i + timeSteps],
            rsi: rsiArray[i + timeSteps].toFixed(2),
            sma: smaArray[i + timeSteps].toFixed(2)
        });
    }

    return { 
        inputs, 
        labels, 
        displayData, 
        minPrice, 
        maxPrice, 
        recentVolume: rawVolumes[rawVolumes.length-1],
        recentRSI: rsiArray[rsiArray.length-1].toFixed(2),
        recentSMA: smaArray[smaArray.length-1].toFixed(2),
        sentimentScore: sentimentScore.toFixed(3)
    };
}
