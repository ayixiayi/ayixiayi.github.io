import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { Resvg } from '@resvg/resvg-js';
import satori from 'satori';
import base from '../assets/og-base.jpg?inline';

type Font = Parameters<typeof satori>[1]['fonts'][number];

const require = createRequire(import.meta.url);
const file = (path: string) => readFile(require.resolve(path));

/**
 * Noto Serif SC ships as ~100 unicode-range slices. Only the slices that
 * cover a card's text are loaded, read from the same stylesheet the site uses.
 */
let slices: Promise<{ file: string; ranges: [number, number][] }[]>;
function cjkSlices() {
  slices ??= file('@fontsource/noto-serif-sc/400.css').then((css) =>
    [...css.toString().matchAll(/@font-face\s*{([^}]*)}/g)].map(([, rule]) => ({
      file: rule.match(/url\(\.\/files\/([^)]+\.woff)\)/)![1],
      ranges: rule
        .match(/unicode-range:\s*([^;]+);/)![1]
        .split(',')
        .map((range) => {
          const [from, to = from] = range.trim().slice(2).split('-');
          return [parseInt(from, 16), parseInt(to, 16)] as [number, number];
        }),
    })),
  );
  return slices;
}

/**
 * Satori keeps one font per name, so each slice gets its own family name and
 * the stack lists them all; every glyph then finds the slice that holds it.
 */
async function fontsFor(text: string) {
  const codes = [...new Set([...text].map((char) => char.codePointAt(0)!))];
  const needed = (await cjkSlices()).filter(({ ranges }) =>
    ranges.some(([from, to]) => codes.some((c) => c >= from && c <= to)),
  );
  const font = async (name: string, path: string): Promise<Font> => ({
    name,
    data: await file(path),
    weight: 400,
    style: 'normal',
  });
  const cjk = needed.map((_, index) => `Noto Serif SC ${index}`);
  const fonts = await Promise.all([
    font(
      'Instrument Serif',
      '@fontsource/instrument-serif/files/instrument-serif-latin-400-normal.woff',
    ),
    font(
      'Plex Mono',
      '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff',
    ),
    ...needed.map(({ file: slice }, index) =>
      font(cjk[index], `@fontsource/noto-serif-sc/files/${slice}`),
    ),
  ]);
  return { fonts, cjk: cjk.join(', ') };
}

// A minimal element builder, so the card reads as a layout rather than JSON.
const h = (
  type: string,
  style: Record<string, unknown>,
  ...children: unknown[]
) => ({
  type,
  props: {
    style,
    children: children.length === 1 ? children[0] : children,
  },
});

/** A 1200 × 630 share card: the painting, the post title and its date. */
export async function shareCard(title: string, meta: string) {
  const size = title.length > 22 ? 54 : 64;
  const { fonts, cjk } = await fontsFor(`${title}${meta}`);
  const card = h(
    'div',
    {
      width: 1200,
      height: 630,
      display: 'flex',
      position: 'relative',
      backgroundColor: '#0b1012',
      fontFamily: `Instrument Serif, ${cjk}`,
    },
    {
      type: 'img',
      props: {
        src: base,
        width: 1200,
        height: 630,
        style: { position: 'absolute', top: 0, left: 0 },
      },
    },
    h('div', {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 1200,
      height: 630,
      backgroundImage:
        'linear-gradient(90deg, rgba(11,16,18,0.94) 0%, rgba(11,16,18,0.78) 48%, rgba(11,16,18,0.12) 100%)',
    }),
    h(
      'div',
      {
        position: 'absolute',
        top: 64,
        left: 76,
        width: 780,
        height: 502,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
      },
      h(
        'div',
        { display: 'flex', alignItems: 'baseline', gap: 18 },
        h(
          'div',
          { display: 'flex', fontSize: 44, color: '#eaeff0' },
          'ayixiayi',
          h('span', { color: '#c9a767' }, '.'),
        ),
        h(
          'div',
          { fontFamily: 'Plex Mono', fontSize: 18, color: '#8e9ea4' },
          'II · 博客',
        ),
      ),
      h(
        'div',
        { display: 'flex', flexDirection: 'column' },
        h('div', {
          width: 56,
          height: 2,
          backgroundColor: '#c9a767',
          marginBottom: 30,
        }),
        h(
          'div',
          {
            fontSize: size,
            lineHeight: 1.32,
            color: '#eaeff0',
            letterSpacing: '0.01em',
          },
          title,
        ),
        h(
          'div',
          {
            marginTop: 28,
            fontFamily: `Plex Mono, ${cjk}`,
            fontSize: 20,
            color: '#c9a767',
          },
          meta,
        ),
      ),
    ),
  );
  const svg = await satori(card as Parameters<typeof satori>[0], {
    width: 1200,
    height: 630,
    fonts,
  });
  return new Resvg(svg).render().asPng();
}
