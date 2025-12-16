class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.frameSize = 128; // To be confirmed
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    let frame;

    if (input.length === 1) {
      // Mono input (good)
      frame = input[0];
    } else {
      // Stereo input (common)
      let L = input[0];
      let R = input[1];

      // Mix stereo → mono
      frame = new Float32Array(L.length);
      for (let i = 0; i < L.length; i++) {
        frame[i] = (L[i] + R[i]) * 0.5;
      }
    }

    // Copy so the buffer doesn't get reused internally
    const copy = new Float32Array(frame);
    this.port.postMessage(copy, [copy.buffer]);

    return true;
  }

}

registerProcessor("pcm-processor", PCMProcessor);
