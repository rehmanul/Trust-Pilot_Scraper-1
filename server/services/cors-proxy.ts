import axios from 'axios';

export class CorsProxyService {
  private proxies = [
    {
      name: 'allorigins',
      url: 'https://api.allorigins.win/get?url=',
      transform: (data: any) => JSON.parse(data).contents
    },
    {
      name: 'cors-anywhere',
      url: 'https://cors-anywhere.herokuapp.com/',
      transform: (data: any) => data
    },
    {
      name: 'thingproxy',
      url: 'https://thingproxy.freeboard.io/fetch/',
      transform: (data: any) => data
    },
    {
      name: 'codetabs',
      url: 'https://api.codetabs.com/v1/proxy?quest=',
      transform: (data: any) => data
    }
  ];

  private currentProxyIndex = 0;

  async fetchWithCorsProxy(url: string, options: { timeout?: number, maxRetries?: number } = {}): Promise<string> {
    const { timeout = 30000, maxRetries = this.proxies.length } = options;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const proxy = this.proxies[this.currentProxyIndex];
      this.currentProxyIndex = (this.currentProxyIndex + 1) % this.proxies.length;

      try {
        const proxyUrl = proxy.url + encodeURIComponent(url);
        
        const response = await axios.get(proxyUrl, {
          timeout,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
          }
        });

        const htmlContent = proxy.transform(response.data);
        
        if (htmlContent && htmlContent.length > 100) {
          return htmlContent;
        }
        
        throw new Error(`Proxy ${proxy.name} returned empty or invalid content`);

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(`Unknown error with proxy ${proxy.name}`);
        
        if (attempt < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('All proxy attempts failed');
  }

  async testProxies(testUrl: string): Promise<{ working: string[], failed: string[] }> {
    const working: string[] = [];
    const failed: string[] = [];

    for (const proxy of this.proxies) {
      try {
        await this.fetchWithCorsProxy(testUrl, { timeout: 10000, maxRetries: 1 });
        working.push(proxy.name);
      } catch (error) {
        failed.push(proxy.name);
      }
    }

    return { working, failed };
  }
}