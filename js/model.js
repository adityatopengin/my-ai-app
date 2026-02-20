/**
 * 1. BUILD THE NEURAL NETWORK
 * This creates the architecture of the LSTM model.
 */
export function createModel(timeSteps) {
    // A sequential model means data flows straight from input -> hidden layers -> output
    const model = tf.sequential();

    // The LSTM Layer: The "Memory" of the network
    // units: 50 means 50 artificial neurons working together
    model.add(tf.layers.lstm({
        units: 50, 
        inputShape: [timeSteps, 1], // [Number of past days to look at, Number of features (just price)]
        returnSequences: false      // We only want one final prediction, not a sequence of predictions
    }));

    // The Dense Layer: The "Output"
    // units: 1 means it will spit out exactly one number (tomorrow's normalized price)
    model.add(tf.layers.dense({
        units: 1
    }));

    // Compile the model with an optimizer and a loss function
    // 'adam' is the best all-around optimizer for adjusting weights
    // 'meanSquaredError' tells the AI to heavily penalize large wrong guesses
    model.compile({
        optimizer: 'adam', 
        loss: 'meanSquaredError'
    });

    return model;
}

/**
 * 2. TRAIN THE NEURAL NETWORK
 * This pushes the historical data through the model over and over so it can learn.
 */
export async function trainModel(model, inputs, labels, timeSteps, updateStatusCallback) {
    // Convert our raw JavaScript arrays into TensorFlow "Tensors" (optimized mathematical matrices)
    const xs = tf.tensor2d(inputs, [inputs.length, timeSteps]).reshape([inputs.length, timeSteps, 1]);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    // Train the model for 50 "epochs" (rounds of learning)
    await model.fit(xs, ys, {
        epochs: 50,
        batchSize: 32, // Process 32 days at a time to speed up GPU calculation
        callbacks: {
            // This allows us to update the UI on the website after every round
            onEpochEnd: async (epoch, logs) => {
                updateStatusCallback(`Training... Epoch ${epoch + 1}/50 (Loss: ${logs.loss.toFixed(4)})`);
            }
        }
    });
    
    // Memory Management: Web browsers crash if you don't delete old tensors!
    xs.dispose(); 
    ys.dispose();
}

/**
 * 3. MAKE THE PREDICTION
 * Takes the trained brain and asks it to guess tomorrow's price.
 */
export function predictTomorrow(model, normalizedPrices, timeSteps, min, max) {
    // Get the most recent chunk of days (e.g., the last 10 days)
    const lastWindow = normalizedPrices.slice(-timeSteps);
    
    // Convert it into a Tensor
    const inputPredict = tf.tensor2d([lastWindow], [1, timeSteps]).reshape([1, timeSteps, 1]);
    
    // Run the prediction
    const predictionNormalized = model.predict(inputPredict).dataSync()[0];
    
    // Memory Management
    inputPredict.dispose(); 
    
    // De-normalize: Convert the 0-1 scale back into actual Indian Rupees (₹)
    const finalPrice = (predictionNormalized * (max - min)) + min;
    
    return finalPrice.toFixed(2);
}
