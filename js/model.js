// Build the architecture
export function createModel(timeSteps) {
    const model = tf.sequential();
    model.add(tf.layers.lstm({units: 50, inputShape: [timeSteps, 1]}));
    model.add(tf.layers.dense({units: 1}));
    model.compile({optimizer: 'adam', loss: 'meanSquaredError'});
    return model;
}

// Train the network
export async function trainModel(model, inputs, labels, timeSteps) {
    const xs = tf.tensor2d(inputs, [inputs.length, timeSteps]).reshape([inputs.length, timeSteps, 1]);
    const ys = tf.tensor2d(labels, [labels.length, 1]);
    
    await model.fit(xs, ys, {epochs: 50});
    
    xs.dispose(); // Cleanup memory to prevent browser crashes
    ys.dispose();
}

// Make the final prediction
export function predictTomorrow(model, normalizedPrices, timeSteps, min, max) {
    const lastWindow = normalizedPrices.slice(-timeSteps);
    const inputPredict = tf.tensor2d([lastWindow], [1, timeSteps]).reshape([1, timeSteps, 1]);
    const predictionNormalized = model.predict(inputPredict).dataSync()[0];
    
    inputPredict.dispose(); 
    return (predictionNormalized * (max - min) + min).toFixed(2);
}
