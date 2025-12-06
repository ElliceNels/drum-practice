class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 128; // To be confirmed
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;

    // input[0] = Float32Array of PCM samples
    const frame = input[0];  

    // Send raw PCM frame to main thread
    this.port.postMessage(frame);

    return true;
  }
}

registerProcessor("pcm-processor", PCMProcessor);
