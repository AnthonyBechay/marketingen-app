import { chromium, type Browser } from "playwright";
import { type Brand, type Slide, renderSlide } from "./slides";
import { uploadPng, r2KeyForSlide } from "./r2";

let _browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (_browser && _browser.isConnected()) return _browser;
  _browser = await chromium.launch({
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  return _browser;
}

export async function renderAndUploadPost({
  brand,
  projectId,
  postName,
  slides,
}: {
  brand: Brand;
  projectId: string;
  postName: string;
  slides: Slide[];
}): Promise<string[]> {
  const browser = await getBrowser();
  const urls: string[] = [];

  for (let i = 0; i < slides.length; i++) {
    const { w, h, html } = renderSlide(brand, slides[i]);
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    try {
      await page.setContent(html, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const buf = await page.screenshot({ type: "png", clip: { x: 0, y: 0, width: w, height: h } });
      const key = r2KeyForSlide(projectId, postName, i, slides.length);
      const url = await uploadPng(key, Buffer.from(buf));
      urls.push(url);
    } finally {
      await page.close();
    }
  }

  return urls;
}
