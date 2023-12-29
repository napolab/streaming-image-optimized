import { Hono } from "hono";
import { optimizeImage } from "wasm-image-optimization";
import { cache } from "hono/cache";

type Bindings = {
  IMAGE_URL: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
  return c.html(`
    <html lang="ja">
      <head>
        <meta charset="UTF-8">
        <title>Streaming Image Demo</title>
      </head>
      <main>
        <section>
          <h1>Streaming Image Demo</h1>
          <p><code>multipart/x-mixed-replace</code> を使ってサイズの大きい画像を分割して配信する。</p>

          <img src=\"/images/icon2.jpg\" width=\"300px\" height=\"300px\" alt="optimized naporitan のアイコン"/>
          <img src=\"/icon2\" width=\"300px\" height=\"300px\" alt="naporitan のアイコン"/>
        </section>
      </main>
    </html>
  `);
});

app.get("/icon2", cache({ cacheName: "images" }), async (c) => {
  const url = new URL("icon2.jpg", c.env.IMAGE_URL)
  return fetch(url.href);
})

app.get("/images/:id", cache({ cacheName: "images" }), async (c) => {
  const url = new URL(c.req.param("id"), c.env.IMAGE_URL);
  const res = await fetch(url.href);
  const mimeType = res.headers.get("content-type");
  const buffer = await res.arrayBuffer();
  const origin = new Uint8Array(buffer);
  const image = await optimizeImage({ image: buffer, width: 150, format: "webp", quality: 0.5 });
  if (!image) return res;

  return c.stream(
    async (stream) => {
      await stream.writeln("--frame");
      await stream.writeln("Content-Type: image/webp");
      await stream.writeln(`Content-Length: ${image.length}\n`);
      await stream.write(image);

      await stream.writeln("--frame");
      await stream.writeln(`Content-Type: ${mimeType}`);
      await stream.writeln(`Content-Length: ${origin.length}\n`);
      await stream.write(origin);
    },
    {
      headers: {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
      },
    },
  );
});

export default app;
