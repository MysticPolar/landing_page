// Owlry landing — responsive image build.
//
// Re-encodes the heavy source PNGs into modern, right-sized variants so phones
// stop downloading ~9 MB of desktop-resolution art. Outputs are committed and
// served statically (no runtime cost). Run with: npm run images
//
// Variant naming: <basename>-<width>.<ext> next to the source file.
//   - WebP everywhere (primary; ~97% browser support)
//   - JPEG fallback for the opaque photographic art (hero + illustrations)
//   - PNG fallback for the flat wordmarks (they have transparency)

import sharp from 'sharp';
import { dirname, join, basename, extname } from 'node:path';

// Flatten colour for opaque art that may carry a stray alpha channel — matches
// the dark tone behind the hero so JPEG fallbacks never show white edges.
const FLATTEN = { r: 20, g: 16, b: 10 };

const JOBS = [
  {
    src: 'hero-bg.png',
    widths: [768, 1195],
    webp: { quality: 72 },
    fallback: { format: 'jpeg', quality: 72, widths: [768, 1195], flatten: true },
  },
  {
    src: 'illustrations/story-crowded-shelf.png',
    widths: [480, 768, 1122],
    webp: { quality: 74 },
    fallback: { format: 'jpeg', quality: 74, widths: [768], flatten: true },
  },
  {
    src: 'illustrations/story-owlry-secretary.png',
    widths: [480, 768, 1122],
    webp: { quality: 74 },
    fallback: { format: 'jpeg', quality: 74, widths: [768], flatten: true },
  },
  {
    src: 'illustrations/story-reading-with-minds.png',
    widths: [480, 768, 1122],
    webp: { quality: 74 },
    fallback: { format: 'jpeg', quality: 74, widths: [768], flatten: true },
  },
  {
    src: 'logos/owlry-wordmark-gold.png',
    widths: [240, 480],
    webp: { quality: 86, alpha: true },
    fallback: { format: 'png', widths: [480], palette: true },
  },
  {
    src: 'logos/owlry-wordmark-black.png',
    widths: [240, 480],
    webp: { quality: 86, alpha: true },
    fallback: { format: 'png', widths: [480], palette: true },
  },
];

const outName = (src, width, ext) =>
  join(dirname(src), `${basename(src, extname(src))}-${width}.${ext}`);

let totalSrc = 0;
let totalOut = 0;

async function run() {
  for (const job of JOBS) {
    const meta = await sharp(job.src).metadata();
    const srcBytes = (await sharp(job.src).toBuffer()).length;
    totalSrc += srcBytes;
    console.log(`\n${job.src}  (${meta.width}x${meta.height}, ${kb(srcBytes)})`);

    // WebP variants
    for (const w of job.widths) {
      if (w > meta.width) continue;
      const out = outName(job.src, w, 'webp');
      let pipe = sharp(job.src).resize({ width: w });
      if (!job.webp.alpha) pipe = pipe.flatten({ background: FLATTEN });
      const info = await pipe
        .webp({ quality: job.webp.quality, effort: 6 })
        .toFile(out);
      totalOut += info.size;
      console.log(`  -> ${out}  ${kb(info.size)}`);
    }

    // Fallback variants
    const fb = job.fallback;
    for (const w of fb.widths) {
      if (w > meta.width) continue;
      const out = outName(job.src, w, fb.format === 'jpeg' ? 'jpg' : 'png');
      let pipe = sharp(job.src).resize({ width: w });
      if (fb.flatten) pipe = pipe.flatten({ background: FLATTEN });
      if (fb.format === 'jpeg') pipe = pipe.jpeg({ quality: fb.quality, mozjpeg: true });
      else pipe = pipe.png({ palette: fb.palette === true, compressionLevel: 9 });
      const info = await pipe.toFile(out);
      totalOut += info.size;
      console.log(`  -> ${out}  ${kb(info.size)}`);
    }
  }

  console.log(
    `\nSource total: ${kb(totalSrc)}   Generated total: ${kb(totalOut)}` +
      `   (${Math.round((1 - totalOut / totalSrc) * 100)}% smaller)`
  );
}

const kb = (b) => `${(b / 1024).toFixed(0)} KB`;

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
