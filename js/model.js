/**
 * 1. BUILD THE "PRO" ARCHITECTURE
 * A Stacked LSTM with Dropout to handle multi-feature intelligence.
 */
export function createModel(timeSteps, featureCount) {
    const model = tf.sequential();

    // Layer 1: The First LSTM (Extracts initial patterns from the 5 features)
    // returnSequences: true is REQUIRED when stacking LSTMs so it passes the full sequence to the next layer
    model.add(tf.layers.lstm({
        units: 64, 
        inputShape: [timeSteps, featureCount], 
        returnSequences: true
    }));

    // Layer 2: Dropout (The "Anti-Memorization" Layer)
    // Randomly ignores 20% of the neurons during training so the AI is forced to find generalized trends
    model.add(tf.layers.dropout({
        rate: 0.2
    }));

    // Layer 3: The Second LSTM (Refines the patterns into a solid prediction)
    model.add(tf.layers.lstm({
        units: 32,
        returnSequences: false
    }));

    // Layer 4: The Output (Compresses the 32 neurons down to 1 final price guess)
    model.add(tf.layers.dense({
        units: 1
    }));

    // Compile using a slightly slower but more precise learning rate
    model.compile({
        optimizer: tf.train.adam(0.001), 
        loss: 'meanSquaredError'
    });

    return model;
}

/**
 * 2. TRAIN THE MULTI-DIMENSIONAL NETWORK
 * Pushes the 3D array (Samples x TimeSteps x Features) into the GPU.
 */
export async function trainModel(model, inputs, labels, timeSteps, featureCount, progressCallback) {
    // Convert arrays to 3D Tensors: [Number of Windows, 10 Days, 5 Features]
    const xs = tf.tensor3d(inputs, [inputs.length, timeSteps, featureCount]);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    const totalEpochs = 50;

    await model.fit(xs, ys, {
        epochs: totalEpochs,
        batchSize: 32,
        callbacks: {
            // This now sends both the Loss Rate and the Percentage to power your visual Progress Bar
            onEpochEnd: async (epoch, logs) => {
                const progressPct = Math.round(((epoch + 1) / totalEpochs) * 100);
                progressCallback(progressPct, logs.loss.toFixed(4));
            }
        }
    });
    
    // Crucial memory cleanup for browser-based ML
    xs.dispose(); 
    ys.dispose();
}

/**
 * 3. EXECUTE THE FORWARD PREDICTION
 * Feeds the most recent 10 days of the 5 features to guess tomorrow.
 */
export function predictTomorrow(model, lastWindow, timeSteps, featureCount, minPrice, maxPrice) {
    // Ensure the input is formatted exactly like the training data: [1 Sample, 10 Days, 5 Features]
    const inputPredict = tf.tensor3d([lastWindow], [1, timeSteps, featureCount]);
    
    // Run the inference
    const predictionNormalized = model.predict(inputPredict).dataSync()[0];
    
    inputPredict.dispose(); 
    
    // Scale the 0-1 result back into real Indian Rupees
    const finalPrice = (predictionNormalized * (maxPrice - minPrice)) + minPrice;
    
    return finalPrice.toFixed(2);
}
