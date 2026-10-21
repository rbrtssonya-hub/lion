import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

const SERIF = "'Noto Serif SC', 'Source Han Serif SC', 'Songti SC', 'STSong', 'SimSun', serif";
const CLOUD = 'M2 52V19Q2 2 19 2h33M7 42V20Q7 7 20 7h22M3 28q17 0 17-14 0-8-7-8M8 33q20 0 20-20M14 27q-8-5-3-10t10 0M28 3q0 17-14 17M33 8q0 20-20 20M22 33q-1-12 11-11-1 12-11 11Z';

function text(context, value, x, y, size, color, spacing = 0, align = 'left') {
  context.font = `${size}px ${SERIF}`;
  context.fillStyle = color;
  const characters = [...value];
  const widths = characters.map(character => context.measureText(character).width);
  const width = widths.reduce((sum, next) => sum + next, 0) + Math.max(0, characters.length - 1) * spacing;
  let cursor = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  characters.forEach((character, index) => { context.fillText(character, cursor, y); cursor += widths[index] + spacing; });
}

function wrapped(context, value, x, y, width, size, color, lineHeight, spacing = 0) {
  context.font = `${size}px ${SERIF}`;
  let line = '', length = 0, row = 0;
  for (const character of value) {
    const next = context.measureText(character).width + (line ? spacing : 0);
    if (line && length + next > width) { text(context, line, x, y + row++ * lineHeight, size, color, spacing); line = ''; length = 0; }
    line += character; length += next;
  }
  if (line) text(context, line, x, y + row * lineHeight, size, color, spacing);
}

function plaque(context, width, height) {
  const fill = context.createLinearGradient(0, 0, width, height);
  fill.addColorStop(0, 'rgba(66,31,16,.94)'); fill.addColorStop(1, 'rgba(30,13,8,.88)');
  context.fillStyle = fill; context.strokeStyle = '#e9af5c'; context.lineWidth = 1;
  context.beginPath(); context.roundRect(1, 1, width - 2, height - 2, [16, 4, 18, 4]);
  context.fill(); context.shadowColor = 'rgba(255,202,124,.7)'; context.shadowBlur = 3; context.stroke(); context.shadowBlur = 0;
  context.strokeStyle = 'rgba(214,158,79,.45)'; context.beginPath(); context.roundRect(6, 6, width - 12, height - 12, [11, 2, 13, 2]); context.stroke();
  const path = new Path2D(CLOUD);
  [[0, 0, 0], [width, 0, Math.PI / 2], [width, height, Math.PI], [0, height, Math.PI * 1.5]].forEach(([x, y, angle]) => {
    context.save(); context.translate(x, y); context.rotate(angle); context.scale(.75, .75); context.strokeStyle = '#f6c579'; context.lineWidth = 1.1; context.stroke(path); context.restore();
  });
}

/** Static semantic content is rasterized once; screen states are pre-cached. */
export function createActionPanelTextures(element, kind, width, height) {
  const create = active => {
    const canvas = document.createElement('canvas');
    canvas.width = width * 2; canvas.height = height * 2;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('悬浮面板绘制不可用');
    context.scale(2, 2);
    if (kind === 'screen') {
      const fill = context.createLinearGradient(0, 0, width, 0);
      fill.addColorStop(0, 'rgba(34,13,7,.86)'); fill.addColorStop(1, 'rgba(34,13,7,.12)');
      context.fillStyle = fill; context.fillRect(0, 0, width, height);
      context.strokeStyle = active ? '#ffce83' : 'rgba(231,172,88,.65)'; context.beginPath(); context.moveTo(.5, 0); context.lineTo(.5, height); context.stroke();
      text(context, element.querySelector('.theater-screen-number')?.textContent?.trim() || '', 18, 40, 26, '#f6e1ba');
      text(context, element.querySelector('h3')?.textContent?.trim() || '', 18, 73, 22, '#f9e4bd', .8);
      context.fillStyle = '#f9dfad'; context.beginPath(); context.arc(36, 112, 18, 0, Math.PI * 2); context.fill();
      context.fillStyle = '#3b2113'; context.beginPath(); context.moveTo(32, 104); context.lineTo(44, 112); context.lineTo(32, 120); context.closePath(); context.fill();
      text(context, active ? '正在观赏' : '转向此幕', 18, 152, 11, active ? '#ffe3a7' : '#d8b985', 1.1);
    } else {
      plaque(context, width, height);
      if (kind === 'title') {
        text(context, element.querySelector('p')?.textContent?.trim() || '', 28, 33, 11, '#dcb980', 1.8);
        text(context, element.querySelector('h2')?.textContent?.trim() || '', 28, 84, 42, '#fff0d1', 6.7);
        text(context, element.querySelector('.theater-gesture-hint')?.textContent?.trim() || '', 28, 122, 14, '#ffe9c4', .7);
      } else {
        text(context, '当前巨幕', 27, 36, 12, '#d9b780', 1.4);
        text(context, element.querySelector('.theater-caption-kicker span')?.textContent?.trim() || '', width - 27, 39, 18, '#f9e5c3', .7, 'right');
        text(context, element.querySelector('h2')?.textContent?.trim() || '', 27, 91, 34, '#fff0d0', 2.7);
        wrapped(context, element.querySelector('.theater-description')?.textContent?.trim() || '', 27, 136, width - 54, 16, '#f2e0c4', 29.6, .48);
        context.strokeStyle = 'rgba(225,170,87,.4)'; context.beginPath(); context.moveTo(27, height - 52); context.lineTo(width - 27, height - 52); context.stroke();
        text(context, element.querySelector('.theater-keywords')?.textContent?.trim() || '', width / 2, height - 24, 13, '#dfc294', 2.0, 'center');
        context.save(); context.translate(width - 44, 75); context.rotate(-.16); context.strokeStyle = 'rgba(218,110,56,.4)'; context.strokeRect(-13, -12, 27, 47);
        text(context, '狮', -10, 7, 20, 'rgba(218,110,56,.3)'); text(context, '艺', -10, 28, 20, 'rgba(218,110,56,.3)'); context.restore();
      }
    }
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace; texture.minFilter = LinearFilter; texture.magFilter = LinearFilter; texture.generateMipmaps = false;
    return texture;
  };
  const inactive = create(false);
  return { inactive, active: kind === 'screen' ? create(true) : inactive };
}
