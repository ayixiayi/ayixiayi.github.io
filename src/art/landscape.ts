import type P5 from 'p5';

export const DEFAULT_SEED = 1847;

type LandscapeOptions = {
  seed: number;
  width: number;
  height: number;
  onComplete?: () => void;
};

type RGB = [number, number, number];

/** An original, finite painting. All geometry uses a 1600 × 1000 design space. */
export function createLandscapeSketch(
  options: LandscapeOptions,
): (p: P5) => void {
  return (p) => {
    const W = 1600;
    const H = 1000;
    const mist = 0.58;
    let valleyX: number;
    let valleyWidth: number;
    let horizon: number;
    const jobs: (() => void)[] = [];
    let cursor = 0;

    const mix = (a: RGB, b: RGB, t: number): RGB => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    const bell = (x: number, center: number, spread: number) =>
      Math.exp(-(((x - center) / spread) ** 2));

    // Small fixed work units preserve random-call order regardless of frame timing.
    const marks = (count: number, paint: () => void) => {
      for (let start = 0; start < count; start += 320) {
        const size = Math.min(320, count - start);
        jobs.push(() => {
          for (let i = 0; i < size; i++) paint();
        });
      }
    };

    const ridge = (layer: number, base: number, color: RGB, count: number) => {
      const heights: number[] = [];
      for (let x = 0; x <= W; x += 2) {
        const valley = bell(x, valleyX - layer * 29, valleyWidth + layer * 13);
        const massif = 0.5 + p.noise(x * 0.0026, layer * 5.7) * 0.8;
        const crags =
          (p.noise(x * 0.009, layer * 13.2) - 0.45) * 90 +
          (p.noise(x * 0.047, layer * 8.1) - 0.5) * 15;
        const spur = layer === 2 ? bell(x, valleyX + 70, 125) * 88 : 0;
        heights.push(
          base - (1 - valley) * massif * (205 + layer * 17) + crags - spur,
        );
      }
      const at = (x: number) =>
        heights[Math.min(heights.length - 1, Math.max(0, Math.floor(x / 2)))];
      const air = Math.max(0, 0.34 - layer * 0.048) * mist;
      const pigment = mix(color, [154, 168, 171], air);
      jobs.push(() => {
        p.noStroke();
        p.fill(...pigment);
        p.beginShape();
        heights.forEach((y, i) => p.vertex(i * 2, y));
        p.vertex(W, H);
        p.vertex(0, H);
        p.endShape(p.CLOSE);
      });

      // A continuous field of broken pigment gives the slopes volume before
      // the finer marks. Column batches keep even dense paint interruptible.
      for (let start = 0; start < W; start += 24) {
        jobs.push(() => {
          for (let x = start; x < start + 24; x += 4) {
            const top = at(x);
            for (let y = top + 3; y < Math.min(H, top + 370); y += 5) {
              const depth = Math.min(1, (y - top) / 310);
              const fold = p.noise(x * 0.009 + y * 0.002, layer * 9);
              const stone = p.noise(x * 0.035, y * 0.022, layer * 3);
              const light = bell(x, valleyX + 100, 470) * (1 - depth);
              const change =
                (fold - 0.5) * (85 + layer * 13) +
                (stone - 0.5) * 24 +
                light * 17 -
                depth * 15;
              p.stroke(
                pigment[0] + change,
                pigment[1] + change * 0.92,
                pigment[2] + change * 0.77,
                130,
              );
              p.strokeWeight(p.random(3, 7));
              const px = x + p.random(-2, 2);
              const py = y + p.random(-2, 2);
              p.line(px, py, px + p.random(1, 5), py + p.random(2, 7));
            }
          }
        });
      }
      marks(count, () => {
        const x = p.random(W);
        const top = at(x);
        const y = top + p.random() ** 1.7 * (H - top);
        const depth = Math.min(1, (y - top) / 240);
        const stone = p.noise(x * 0.016, y * 0.009, layer * 3);
        const light = bell(x, valleyX + 60, 460) * (1 - depth * 0.55);
        const change =
          (stone - 0.49) * (28 + layer * 6) + light * 15 - depth * 9;
        p.stroke(
          pigment[0] + change,
          pigment[1] + change,
          pigment[2] + change * 0.78,
          48 + layer * 5,
        );
        p.strokeWeight(p.random(0.6, 2.2 + layer * 0.23));
        const length = p.random(2, 8 + layer * 2);
        // Broken mineral strokes follow the local fall of the mountain face.
        const slope = Math.max(
          -1.5,
          Math.min(1.5, (at(x + 16) - at(x - 16)) / 32),
        );
        p.line(x, y, x + length * 0.55, y + length * (0.25 + slope * 0.6));
      });
      return at;
    };

    const palace = (ground: (x: number) => number) => {
      // Find the local crest so the walls meet rock rather than hanging down a slope.
      let x = valleyX + 40;
      for (let candidate = x + 2; candidate <= valleyX + 140; candidate += 2) {
        if (ground(candidate) < ground(x)) x = candidate;
      }
      const y = ground(x) + 2;
      p.noStroke();
      for (let i = 8; i > 0; i--) {
        p.fill(215, 185, 111, 2.2);
        p.ellipse(x + 7, y - 19, i * 10, i * 6);
      }
      for (let i = 0; i < 11; i++) {
        const tx = x - 25 + i * 4.8;
        const tall = [9, 12, 20, 14, 29, 40, 17, 26, 13, 18, 9][i];
        const foot = Math.max(y, ground(tx));
        const ty = y - tall;
        p.fill(192 + p.random(27), 157 + p.random(20), 86);
        p.rect(tx, ty, 5, foot - ty);
        p.fill(244, 214, 143);
        p.rect(tx, ty, 1.5, foot - ty);
        p.fill(76, 89, 90);
        p.triangle(tx - 1, ty, tx + 2, ty - 6, tx + 5, ty);
        p.stroke(221, 190, 112, 200);
        p.strokeWeight(0.7);
        p.line(tx + 2, ty - 6, tx + 2, ty - 11);
        p.noStroke();
        for (let wy = ty + 6; wy < y - 2; wy += 7) {
          p.fill(75, 78, 65);
          p.rect(tx + 2, wy, 1.1, 2.1);
        }
      }
      p.stroke(186, 156, 90, 170);
      p.strokeWeight(2);
      for (let dx = -28; dx < 32; dx += 2) {
        p.line(x + dx, ground(x + dx), x + dx + 2, ground(x + dx + 2));
      }
    };

    p.setup = () => {
      p.pixelDensity(1);
      p.createCanvas(options.width, options.height);
      p.randomSeed(options.seed);
      p.noiseSeed(options.seed);
      p.noiseDetail(3, 0.5);
      // One shared geography keeps the light, architecture and water connected.
      valleyX = p.random(890, 1180);
      valleyWidth = p.random(230, 330);
      horizon = p.random(385, 440);
      p.frameRate(60);
      p.background(46, 61, 65);

      jobs.push(() => {
        p.noStroke();
        for (let y = 0; y < 600; y += 3) {
          const color = mix([47, 61, 71], [144, 160, 164], (y / 600) ** 0.85);
          p.fill(...color);
          p.rect(0, y, W, 4);
        }
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        const glow = ctx.createRadialGradient(
          valleyX + 70,
          horizon - 94,
          0,
          valleyX + 70,
          horizon - 94,
          460,
        );
        glow.addColorStop(0, 'rgba(180, 193, 194, 0.2)');
        glow.addColorStop(1, 'rgba(180, 193, 194, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, 600);
      });
      marks(11500, () => {
        const x = p.random(W);
        const y = p.random(580);
        const cloud = p.noise(x * 0.002, y * 0.006);
        const glow = bell(x, valleyX + 60, 480) * bell(y, horizon - 94, 220);
        p.stroke(
          153 + glow * 24,
          166 + glow * 21,
          175 + glow * 16,
          5 + cloud * 14,
        );
        p.strokeWeight(p.random(1, 7));
        p.line(x, y, x + p.random(3, 36), y + p.random(-3, 3));
      });

      ridge(0, horizon, [111, 130, 140], 3800);
      ridge(1, horizon + 65, [85, 105, 119], 4700);
      const palaceGround = ridge(2, horizon + 138, [66, 87, 101], 5700);
      jobs.push(() => palace(palaceGround));
      ridge(3, horizon + 236, [54, 72, 84], 6600);
      ridge(4, horizon + 382, [37, 54, 65], 8500);

      // Broken reflections suggest water without outlining a bright ribbon.
      marks(6700, () => {
        const t = p.random();
        const top = horizon + 213;
        const y = top + t * (H - top);
        const center = valleyX - 86 - t * 203 + Math.sin(t * 7) * 42 * t;
        const halfWidth = (4 + t ** 1.5 * 85) * (0.7 + p.noise(t * 6) * 0.7);
        const x = center + p.random(-halfWidth, halfWidth);
        const shine = p.noise(x * 0.027, y * 0.049);
        p.stroke(
          91 + shine * 24,
          116 + shine * 20,
          116 + shine * 11,
          p.random(8, 38) * bell(x, center, halfWidth * 0.9),
        );
        p.strokeWeight(p.random(0.5, 1.5));
        p.line(x, y, x + p.random(2, 6 + t * 16), y - 0.3);
      });

      const front = ridge(5, horizon + 666, [25, 37, 45], 9500);

      marks(2300, () => {
        const x = p.random(W);
        const ground = front(x) + p.random(0, 80);
        if (
          ground > H ||
          (x > valleyX - 450 && x < valleyX + 210) ||
          p.noise(x * 0.018, ground * 0.014) < 0.46
        )
          return;
        const height = p.random(6, 37) * (0.5 + (ground - 700) / 300);
        p.stroke(20, 34, 35, 160);
        p.strokeWeight(0.8);
        p.line(x, ground, x, ground - height);
        for (let b = 0.2; b < 0.95; b += 0.17) {
          const spread = height * b * 0.21;
          const by = ground - height + height * b;
          p.line(x - spread, by + 3, x, by);
          p.line(x, by, x + spread, by + 3);
        }
      });

      marks(5800, () => {
        const y = p.random(horizon - 29, horizon + 346);
        const center = valleyX + 20 - (y - horizon + 29) * 0.36;
        const x = center + p.randomGaussian(0, 170);
        const veil =
          bell(x, center, valleyWidth - 40) * bell(y, horizon + 126, 160);
        p.stroke(168, 182, 189, mist * veil * 5.5);
        p.strokeWeight(p.random(2, 8));
        p.line(x, y, x + p.random(12, 75), y + p.random(-1, 1));
      });

      jobs.push(() => {
        // Transparent glazing makes the left-side reading field quiet, not empty.
        p.noStroke();
        for (let x = 0; x < 790; x += 5) {
          p.fill(14, 27, 30, 78 * (1 - x / 790) ** 1.4);
          p.rect(x, 0, 5, H);
        }
      });
    };

    p.draw = () => {
      if (cursor >= jobs.length) return;
      p.push();
      p.scale(options.width / W, options.height / H);
      const started = performance.now();
      do {
        jobs[cursor++]();
      } while (cursor < jobs.length && performance.now() - started < 11);
      p.pop();
      if (cursor === jobs.length) {
        p.noLoop();
        options.onComplete?.();
      }
    };
  };
}
