import { media } from '../config/media.js';

// Regional edition of 炫技3; names describe AI-assisted postal artwork.
const artworkStamps = Object.freeze([
  {
    id: 'foshan', series: 'guangdong', number: '01', place: '佛山', english: 'FOSHAN',
    title: '狮起南海', name: '佛山 · 狮起南海', caption: '南狮根脉 · 武艺之乡',
    story: '从佛山祖庙的灰塑屋脊，到南拳与醒狮相伴的节庆记忆。',
    design: '黑面张飞狮以低机位近景入画，黑毛与深金纹样衬出沉着威势。',
    ratio: 45 / 65, image: media.spreadStampFoshan,
  },
  {
    id: 'guangzhou', series: 'guangdong', number: '02', place: '广州', english: 'GUANGZHOU',
    title: '花城采青', name: '广州 · 花城采青', caption: '广府年俗 · 木棉花城',
    story: '醒狮循着红绳采青，穿过骑楼与木棉花相映的广州街景。',
    design: '金黄狮身向上探身，鲜红木棉与翠绿生菜把画面串成纵向动势。',
    ratio: 45 / 65, image: media.spreadStampGuangzhou,
  },
  {
    id: 'heshan', series: 'guangdong', number: '03', place: '鹤山', english: 'HESHAN',
    title: '灵狮猫步', name: '鹤山 · 灵狮猫步', caption: '七星鼓韵 · 水乡竹影',
    story: '鹤山狮舞的机敏步伐，在鼓点与水乡景致间轻巧展开。',
    design: '青绿与鹅黄狮身低伏回望，前爪轻落鼓面，形成舒展的横向曲线。',
    ratio: 45 / 65, image: media.spreadStampHeshan,
  },
  {
    id: 'suixi', series: 'guangdong', number: '04', place: '遂溪', english: 'SUIXI',
    title: '高桩腾跃', name: '遂溪 · 高桩腾跃', caption: '雷州半岛 · 勇气与速度',
    story: '遂溪高桩醒狮在高低错落的桩阵之间完成腾跃。',
    design: '紫银狮身斜向冲出，金橙飘带与朱红高桩把速度延伸到海天之间。',
    ratio: 45 / 65, image: media.spreadStampSuixi,
  },
  {
    id: 'beijing', series: 'china', number: '05', place: '北京', english: 'BEIJING',
    title: '京华太狮', name: '北京 · 京华太狮', caption: '庙会花会 · 黄蓝双狮',
    story: '北京传统庙会中的双狮相戏，连起古建、铜铃与节庆人群。',
    design: '金黄与靛蓝两只太狮围绕绣球错位互动，横向展开庙会场景。',
    ratio: 60 / 45, image: media.spreadStampBeijing,
  },
  {
    id: 'tianyang', series: 'china', number: '06', place: '田阳', english: 'TIANYANG',
    title: '壮乡飞狮', name: '田阳 · 壮乡飞狮', caption: '壮锦纹样 · 铜鼓山河',
    story: '黄绿双狮跃过高台，铜鼓与壮乡山水构成节庆背景。',
    design: '前后错位的双狮沿着台柱飞跃，靛蓝壮锦纹样连接舞台和服饰。',
    ratio: 60 / 45, image: media.spreadStampTianyang,
  },
  {
    id: 'quanzhou', series: 'china', number: '07', place: '泉州', english: 'QUANZHOU',
    title: '闽南狮阵', name: '泉州 · 闽南狮阵', caption: '红砖古厝 · 武艺传承',
    story: '狮头低伏穿行武阵，周围的阵法表演让泉州街巷成为舞台。',
    design: '朱红狮身横向推进，红砖厝与燕尾脊托住前景狮阵的力量感。',
    ratio: 60 / 45, image: media.spreadStampQuanzhou,
  },
  {
    id: 'hongkong', series: 'china', number: '08', place: '香港', english: 'HONG KONG',
    title: '港城狮跃', name: '香港 · 港城狮跃', caption: '都市节庆 · 双狮竞舞',
    story: '醒狮在唐楼与港岛天际线之间穿行，街头节庆充满城市活力。',
    design: '宝蓝狮前探采青，洋红狮随后跃起；前后景动作彼此呼应。',
    ratio: 60 / 45, image: media.spreadStampHongkong,
  },
  {
    id: 'singapore', series: 'world', number: '09', place: '新加坡', english: 'SINGAPORE',
    title: '狮庆南洋', name: '新加坡 · 狮庆南洋', caption: '牛车水 · 南洋花砖',
    story: '采青舞步落在牛车水街巷，热带植物与节庆灯笼相互映衬。',
    design: '薄荷绿、柠檬黄与暖红醒狮沿红绳向上采青，形成长幅节奏。',
    ratio: 40 / 75, image: media.spreadStampSingapore,
  },
  {
    id: 'kualalumpur', series: 'world', number: '10', place: '吉隆坡', english: 'KUALA LUMPUR',
    title: '雄狮竞跃', name: '吉隆坡 · 雄狮竞跃', caption: '高桩竞技 · 城市天际',
    story: '高桩腾跃在热带城市节庆中展开，双子塔远远映入天际。',
    design: '紫黑狮身以银金刺绣提亮，朱红桩阵与竖向都市轮廓强化速度。',
    ratio: 40 / 75, image: media.spreadStampKualalumpur,
  },
  {
    id: 'sanfrancisco', series: 'world', number: '11', place: '旧金山', english: 'SAN FRANCISCO',
    title: '金山狮影', name: '旧金山 · 金山狮影', caption: '华埠巡游 · 社群记忆',
    story: '华埠巡游把狮舞、鼓乐和街坊人群连在一起，金门桥隐约入景。',
    design: '橘金狮回望观者，身体继续向前，灯笼沿华埠街道延伸至城市远景。',
    ratio: 40 / 75, image: media.spreadStampSanfrancisco,
  },
  {
    id: 'london', series: 'world', number: '12', place: '伦敦', english: 'LONDON',
    title: '伦敦狮韵', name: '伦敦 · 伦敦狮韵', caption: '唐人街 · 文化交流',
    story: '伦敦唐人街的狮舞在中式牌楼与英伦街景之间延续。',
    design: '蓝银醒狮昂首而立，红灯笼、牌楼与钟楼在同一街道纵深相遇。',
    ratio: 40 / 75, image: media.spreadStampLondon,
  },
]);

const mapPlaceIds = { hongkong: 'hong-kong', kualalumpur: 'kuala-lumpur', sanfrancisco: 'san-francisco' };
export const spreadStamps = Object.freeze(artworkStamps.map(stamp => Object.freeze({
  ...stamp, placeId: mapPlaceIds[stamp.id] ?? stamp.id,
})));
export const stampsForLevel = level => spreadStamps.filter(stamp => stamp.series === level);
export const stampForPlace = placeId => spreadStamps.find(stamp => stamp.placeId === placeId);
