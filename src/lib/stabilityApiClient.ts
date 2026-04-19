export class StabilityApiClient {
  isAvailable: boolean = true;
  isStubMode: boolean = false;

  constructor() {
    const key = localStorage.getItem('stabilityApiKey');
    if (!key) {
      this.isAvailable = false;
    }
  }

  async generateImage(prompt: string, apiKey: string, options: any = {}): Promise<any[]> {
    if (this.isStubMode) {
      console.log('Stub mode: returning dummy image');
      return [{ imageDataB64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' }];
    }

    const {
      samples = 1,
      height = 1024,
      width = 1024,
      style_preset = 'fantasy-art',
    } = options;

    const body = {
      text_prompts: [
        {
          text: prompt,
        },
      ],
      cfg_scale: 7,
      height,
      width,
      samples,
      steps: 30,
      style_preset,
    };

    const response = await fetch(
      'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      throw new Error(`Stability API error: ${response.status} ${await response.text()}`);
    }

    const responseJSON = await response.json();
    return responseJSON.artifacts.map((artifact: any) => ({
      imageDataB64: artifact.base64,
      finishReason: artifact.finishReason,
      seed: artifact.seed,
    }));
  }
}
