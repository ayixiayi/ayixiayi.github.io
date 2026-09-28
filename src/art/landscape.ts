import type P5 from 'p5';

export const DEFAULT_SEED = 1847;

type LandscapeOptions = {
  seed: number;
  width: number;
  height: number;
  onProgress?: (done: number) => void;
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
    const haze: RGB = [156, 170, 174];
    let valleyX: number;
    let valleyWidth: number;
    let horizon: number;
    // The light sits low in the far valley, so every range is backlit.
    let lightX: number;
    let lightY: number;
    const jobs: (() => void)[] = [];
    let cursor = 0;

    const mix = (a: RGB, b: RGB, t: number): RGB => [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
    const shade = (c: RGB, amount: number): RGB => [
      c[0] + amount * 0.92,
      c[1] + amount * 0.97,
      c[2] + amount,
    ];
    const rgba = (c: RGB, alpha: number) =>
      `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${alpha})`;
    const bell = (x: number, center: number, spread: number) =>
      Math.exp(-(((x - center) / spread) ** 2));
    const clamp = (v: number, lo: number, hi: number) =>
      Math.min(hi, Math.max(lo, v));
    const ctx = () => p.drawingContext as CanvasRenderingContext2D;

    // Small fixed work units preserve random-call order regardless of frame timing.
    const marks = (
      count: number,
      paint: (c: CanvasRenderingContext2D) => void,
    ) => {
      for (let start = 0; start < count; start += 320) {
        const size = Math.min(320, count - start);
        jobs.push(() => {
          const c = ctx();
          c.lineCap = 'round';
          c.lineJoin = 'round';
          for (let i = 0; i < size; i++) paint(c);
        });
      }
    };

    const sky = () => {
      jobs.push(() => {
        const c = ctx();
        const fall = c.createLinearGradient(0, 0, 0, horizon + 120);
        fall.addColorStop(0, 'rgb(34,47,57)');
        fall.addColorStop(0.45, 'rgb(76,92,103)');
        fall.addColorStop(0.82, 'rgb(136,150,156)');
        fall.addColorStop(1, 'rgb(160,172,174)');
        c.fillStyle = fall;
        c.fillRect(0, 0, W, horizon + 120);
        const glow = c.createRadialGradient(
          lightX,
          lightY,
          0,
          lightX,
          lightY,
          560,
        );
        glow.addColorStop(0, 'rgba(214,206,184,0.34)');
        glow.addColorStop(0.35, 'rgba(190,192,184,0.14)');
        glow.addColorStop(1, 'rgba(180,190,192,0)');
        c.fillStyle = glow;
        c.fillRect(0, 0, W, horizon + 120);
      });
      // Soft cloud banks: long, low-contrast strokes that thin toward the light.
      marks(1700, (c) => {
        const y = p.random() ** 1.35 * (horizon + 10);
        const x = p.random(-100, W);
        const bank = p.noise(x * 0.0016, y * 0.011);
        if (bank < 0.47) return;
        const light = bell(x, lightX, 520) * bell(y, lightY, 240);
        const tone = (y / horizon) * 38 + light * 30 + (bank - 0.5) * 60;
        c.strokeStyle = rgba(shade([66, 80, 90], tone), p.random(0.025, 0.06));
        c.lineWidth = p.random(6, 22);
        const length = p.random(60, 320);
        c.beginPath();
        c.moveTo(x, y);
        c.quadraticCurveTo(
          x + length / 2,
          y + p.random(-3, 3),
          x + length,
          y + p.random(-2, 2),
        );
        c.stroke();
      });
    };

    const ridge = (
      layer: number,
      base: number,
      color: RGB,
      strokes: number,
    ) => {
      const heights: number[] = [];
      for (let x = 0; x <= W; x += 2) {
        const valley = bell(x, valleyX - layer * 29, valleyWidth + layer * 13);
        const massif = 0.5 + p.noise(x * 0.0021, layer * 5.7) * 0.8;
        // Ridged noise gives summits and saddles; a slower field decides which
        // stretches rise into peaks and which stay as rounded shoulders.
        const fold = p.noise(x * 0.0048, layer * 11.3) * 2 - 1;
        const crest = 1 - Math.sqrt(fold * fold + 0.006);
        const lift = clamp(
          (p.noise(x * 0.0017, layer * 2.9) - 0.35) * 2.4,
          0,
          1,
        );
        const crag =
          (p.noise(x * 0.024, layer * 8.1) - 0.5) * 11 +
          (p.noise(x * 0.08, layer * 3.3) - 0.5) * 3;
        const spur = layer === 2 ? bell(x, valleyX + 70, 125) * 88 : 0;
        heights.push(
          base -
            (1 - valley) *
              (massif * (150 + layer * 16) +
                crest ** 4 * lift * (95 + layer * 10)) +
            crag * (0.5 + layer * 0.12) -
            spur,
        );
      }
      const at = (x: number) =>
        heights[Math.min(heights.length - 1, Math.max(0, Math.floor(x / 2)))];
      const slopeAt = (x: number) =>
        clamp((at(x + 12) - at(x - 12)) / 24, -2, 2);
      // Faces turned toward the far light catch it; the others fall into shadow.
      // The side toward the light eases over across the valley instead of
      // flipping, so no seam runs down from the light source.
      const facing = (x: number) =>
        clamp(
          ((slopeAt(x) * (lightX - x)) / (Math.abs(lightX - x) + 160)) * 1.4,
          -1,
          1,
        );
      // Aerial perspective: far ranges dissolve into the haze.
      const air = Math.max(0, 0.46 - layer * 0.085);
      const pigment = mix(color, haze, air);
      const top = Math.min(...heights);
      const foot = base + 200;

      jobs.push(() => {
        const c = ctx();
        c.save();
        c.beginPath();
        c.moveTo(0, H);
        heights.forEach((y, i) => c.lineTo(i * 2, y));
        c.lineTo(W, H);
        c.closePath();
        c.clip();
        // Tone: crests hold the light, the foot of each range sinks into mist.
        const tone = c.createLinearGradient(0, top, 0, foot);
        tone.addColorStop(0, rgba(shade(pigment, 8), 1));
        tone.addColorStop(0.5, rgba(pigment, 1));
        tone.addColorStop(1, rgba(mix(pigment, haze, 0.34 - layer * 0.04), 1));
        c.fillStyle = tone;
        c.fillRect(0, top - 2, W, H - top + 2);
        // Planes of light and shadow, washed in narrow overlapping columns.
        for (let x = 0; x < W; x += 3) {
          const light = facing(x + 1.5);
          const near = 0.45 + bell(x, lightX, 520) * 0.55;
          const y = at(x);
          const depth = 150 + layer * 18;
          const wash = c.createLinearGradient(0, y, 0, y + depth);
          const colour = light > 0 ? [206, 214, 214] : [14, 22, 28];
          const strength = Math.abs(light) * near * (light > 0 ? 0.16 : 0.2);
          wash.addColorStop(0, `rgba(${colour},${strength})`);
          wash.addColorStop(1, `rgba(${colour},0)`);
          c.fillStyle = wash;
          c.fillRect(x, y - 2, 3, depth);
        }
        const lamp = c.createRadialGradient(
          lightX,
          lightY,
          0,
          lightX,
          lightY,
          640,
        );
        lamp.addColorStop(0, `rgba(200,202,190,${0.2 - layer * 0.03})`);
        lamp.addColorStop(1, 'rgba(200,202,190,0)');
        c.fillStyle = lamp;
        c.fillRect(0, top - 2, W, H - top + 2);
        c.restore();
      });

      // Brushwork down the fall line: short, soft and spread over the whole face.
      marks(strokes, (c) => {
        const x = p.random(-20, W + 20);
        const crestY = at(x);
        const y = crestY + p.random() ** 1.3 * 230 + 3;
        const near = bell(x, lightX, 560);
        const grain = p.noise(x * 0.012, y * 0.009, layer * 4.1) - 0.5;
        const amount =
          facing(x) * (8 + near * 12) + grain * 30 - ((y - crestY) / 230) * 6;
        c.strokeStyle = rgba(shade(pigment, amount), p.random(0.05, 0.13));
        c.lineWidth = p.random(1.2, 3.6) + layer * 0.3;
        const drift = slopeAt(x) * 0.7;
        let px = x;
        let py = y;
        c.beginPath();
        c.moveTo(px, py);
        const steps = 2 + Math.floor(p.random(3));
        const step = p.random(8, 22) * (0.85 + layer * 0.1);
        for (let s = 0; s < steps; s++) {
          px += drift * step + (p.noise(px * 0.05, py * 0.05) - 0.5) * 6;
          py += step;
          c.lineTo(px, py);
        }
        c.stroke();
      });

      // Rim light on the crest, broken by noise and fading away from the valley.
      jobs.push(() => {
        const c = ctx();
        c.lineCap = 'butt';
        const glow = mix(haze, [230, 228, 214], 0.5);
        for (let x = 0; x < W; x += 3) {
          const lit =
            Math.max(0, facing(x) + 0.2) *
            bell(x, lightX, 420) *
            clamp((p.noise(x * 0.03, layer * 6.6) - 0.3) * 2.5, 0, 1);
          if (lit < 0.04) continue;
          c.strokeStyle = rgba(
            glow,
            Math.min(0.55, lit * (0.6 - layer * 0.08)),
          );
          c.lineWidth = 0.8 + lit * 1.4;
          c.beginPath();
          c.moveTo(x, at(x) + 1);
          c.lineTo(x + 3, at(x + 3) + 1);
          c.stroke();
        }
      });

      // Fine tooth of the paint, following the same fall line.
      marks(Math.round(strokes * 0.6), (c) => {
        const x = p.random(W);
        const crestY = at(x);
        const y = crestY + p.random() ** 1.6 * (H - crestY);
        const grain = p.noise(x * 0.02, y * 0.02, layer * 7) - 0.5;
        c.strokeStyle = rgba(
          shade(pigment, grain * 26 + facing(x) * 6),
          p.random(0.05, 0.12),
        );
        c.lineWidth = p.random(0.6, 1.5);
        const length = p.random(3, 9);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + slopeAt(x) * length * 0.6, y + length);
        c.stroke();
      });
      return at;
    };

    // Mist pools in the valley below each range and separates it from the next.
    const fog = (y: number, strength: number) => {
      jobs.push(() => {
        const c = ctx();
        const band = c.createLinearGradient(0, y - 90, 0, y + 70);
        band.addColorStop(0, rgba(haze, 0));
        band.addColorStop(0.6, rgba(haze, strength));
        band.addColorStop(1, rgba(haze, 0));
        c.fillStyle = band;
        c.fillRect(0, y - 90, W, 160);
      });
      marks(260, (c) => {
        const x = p.random(-150, W);
        const wy = y + p.randomGaussian(0, 24);
        const veil = p.noise(x * 0.004, wy * 0.02);
        if (veil < 0.45) return;
        c.strokeStyle = rgba(mix(haze, [205, 212, 212], 0.3), strength * 0.22);
        c.lineWidth = p.random(2, 7);
        const length = p.random(120, 360);
        c.beginPath();
        c.moveTo(x, wy);
        c.quadraticCurveTo(
          x + length / 2,
          wy + p.random(-5, 5),
          x + length,
          wy + p.random(-2, 2),
        );
        c.stroke();
      });
    };

    const palace = (ground: (x: number) => number) => {
      // Find the local crest so the walls meet rock rather than hanging down a slope.
      let x = valleyX + 40;
      for (let candidate = x + 2; candidate <= valleyX + 140; candidate += 2) {
        if (ground(candidate) < ground(x)) x = candidate;
      }
      const y = ground(x) + 2;
      // Towers from the back pair to the keep: offset, width, height, spire.
      const towers: [number, number, number, number][] = [
        [-31, 6, 15, 9],
        [31, 6, 17, 10],
        [-22, 7, 25, 12],
        [22, 7, 23, 12],
        [-12, 8, 35, 15],
        [12, 8, 33, 15],
        [0, 12, 47, 21],
      ].map(([dx, w, h, s]) => [
        dx,
        w,
        h + p.random(-2, 2),
        s + p.random(-1, 2),
      ]);

      jobs.push(() => {
        const c = ctx();
        const halo = c.createRadialGradient(x, y - 28, 0, x, y - 28, 130);
        halo.addColorStop(0, 'rgba(236,200,128,0.26)');
        halo.addColorStop(0.4, 'rgba(214,186,130,0.1)');
        halo.addColorStop(1, 'rgba(200,180,140,0)');
        c.fillStyle = halo;
        c.fillRect(x - 140, y - 170, 280, 260);

        const body = (left: number, width: number) => {
          const g = c.createLinearGradient(left, 0, left + width, 0);
          g.addColorStop(0, 'rgb(252,226,158)');
          g.addColorStop(0.35, 'rgb(226,184,104)');
          g.addColorStop(1, 'rgb(150,112,60)');
          return g;
        };

        // Curtain wall with crenellations.
        c.fillStyle = body(x - 34, 68);
        c.fillRect(x - 34, y - 10, 68, 14);
        c.fillStyle = 'rgb(246,214,146)';
        for (let cx = x - 34; cx < x + 34; cx += 4)
          c.fillRect(cx, y - 12, 2, 2);

        for (const [dx, w, h, spire] of towers) {
          const tx = x + dx;
          const left = tx - w / 2;
          const foot = Math.max(y, ground(tx)) + 3;
          const top = y - h;
          c.fillStyle = body(left, w);
          c.fillRect(left, top, w, foot - top);
          // Cornice.
          c.fillStyle = 'rgba(90,66,40,0.7)';
          c.fillRect(left - 0.5, top, w + 1, 1.2);
          // Slate spire, lit on the valley side, with a gold finial.
          c.fillStyle = 'rgb(58,72,82)';
          c.beginPath();
          c.moveTo(left - 1.5, top);
          c.quadraticCurveTo(
            tx - w * 0.15,
            top - spire * 0.45,
            tx,
            top - spire,
          );
          c.quadraticCurveTo(
            tx + w * 0.15,
            top - spire * 0.45,
            left + w + 1.5,
            top,
          );
          c.closePath();
          c.fill();
          c.strokeStyle = 'rgba(214,190,132,0.75)';
          c.lineWidth = 0.7;
          c.beginPath();
          c.moveTo(left - 1.2, top);
          c.quadraticCurveTo(
            tx - w * 0.15,
            top - spire * 0.45,
            tx,
            top - spire,
          );
          c.stroke();
          c.strokeStyle = 'rgb(236,204,128)';
          c.beginPath();
          c.moveTo(tx, top - spire);
          c.lineTo(tx, top - spire - 5);
          c.stroke();
          // Lit windows in the upper storeys.
          c.fillStyle = 'rgb(255,240,196)';
          const columns = w >= 8 ? [tx - w / 4, tx + w / 4 - 1] : [tx - 0.6];
          for (let wy = top + 5; wy < y - 6; wy += 7) {
            for (const wx of columns) c.fillRect(wx, wy, 1.3, 2.4);
          }
        }
        // Seat the palace on the rock.
        c.strokeStyle = 'rgba(40,46,44,0.8)';
        c.lineWidth = 1.5;
        c.beginPath();
        for (let dx = -36; dx <= 36; dx += 2)
          c.lineTo(x + dx, ground(x + dx) + 2);
        c.stroke();
      });
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
      lightX = valleyX + 70;
      lightY = horizon - 70;
      p.frameRate(60);
      p.background(46, 61, 65);

      sky();
      ridge(0, horizon, [120, 136, 146], 1100);
      fog(horizon + 60, 0.3);
      ridge(1, horizon + 65, [92, 110, 124], 1300);
      fog(horizon + 130, 0.28);
      const palaceGround = ridge(2, horizon + 138, [68, 88, 103], 1500);
      palace(palaceGround);
      fog(horizon + 215, 0.24);
      ridge(3, horizon + 236, [48, 66, 80], 1700);
      fog(horizon + 330, 0.18);
      ridge(4, horizon + 382, [33, 48, 60], 1900);

      // Broken reflections suggest water without outlining a bright ribbon.
      marks(3600, (c) => {
        const t = p.random();
        const top = horizon + 213;
        const y = top + t * (H - top);
        const center = valleyX - 86 - t * 203 + Math.sin(t * 7) * 42 * t;
        const halfWidth = (4 + t ** 1.5 * 85) * (0.7 + p.noise(t * 6) * 0.7);
        const x = center + p.random(-halfWidth, halfWidth);
        const shine = p.noise(x * 0.027, y * 0.049);
        c.strokeStyle = rgba(
          [100 + shine * 30, 122 + shine * 26, 124 + shine * 16],
          p.random(0.03, 0.14) * bell(x, center, halfWidth * 0.9),
        );
        c.lineWidth = p.random(0.6, 1.6);
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x + p.random(3, 8 + t * 18), y - 0.3);
        c.stroke();
      });

      const front = ridge(5, horizon + 666, [21, 31, 39], 2000);

      // Dark spruce stand on the near slope, kept clear of the valley.
      marks(1100, (c) => {
        const x = p.random(W);
        const ground = front(x) + p.random(-4, 80);
        if (
          ground > H + 10 ||
          (x > valleyX - 450 && x < valleyX + 210) ||
          p.noise(x * 0.016, ground * 0.012) < 0.48
        )
          return;
        const height = p.random(8, 40) * (0.55 + (ground - 700) / 320);
        const width = height * p.random(0.2, 0.28);
        c.fillStyle = rgba([15 + p.random(6), 26 + p.random(6), 28], 0.92);
        c.beginPath();
        c.moveTo(x, ground - height);
        for (let k = 1; k <= 6; k++) {
          const t = k / 6;
          const reach = width * t * (k % 2 ? 1 : 0.62);
          c.lineTo(x + reach, ground - height * (1 - t) + 1);
        }
        for (let k = 6; k >= 1; k--) {
          const t = k / 6;
          const reach = width * t * (k % 2 ? 1 : 0.62);
          c.lineTo(x - reach, ground - height * (1 - t) + 1);
        }
        c.closePath();
        c.fill();
      });

      jobs.push(() => {
        // A light glaze keeps the left side quiet under the page's own shading.
        const c = ctx();
        const glaze = c.createLinearGradient(0, 0, 820, 0);
        glaze.addColorStop(0, 'rgba(14,24,28,0.22)');
        glaze.addColorStop(1, 'rgba(14,24,28,0)');
        c.fillStyle = glaze;
        c.fillRect(0, 0, 820, H);
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
      options.onProgress?.(cursor / jobs.length);
      if (cursor === jobs.length) {
        p.noLoop();
        options.onComplete?.();
      }
    };
  };
}
