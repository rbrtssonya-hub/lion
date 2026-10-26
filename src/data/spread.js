import { homeCultureStories } from './home-culture.js';

// Place names index the photographs already in this collection. Coordinates
// locate the cities approximately; neither ordering nor photo years is a route.
const stories = (...ids) => ids.map(id => homeCultureStories.find(story => story.id === id));

export const spreadPlaces = [
  {
    id: 'lingnan', name: '岭南', location: '广州 · 佛山', english: 'LINGNAN',
    context: '制作与表演', coordinates: [113.26, 23.13], labelPosition: [781, 138],
    stories: stories('living-tradition', 'lion-head-craft'), photoYears: [2008, 2020],
  },
  {
    id: 'hong-kong', name: '香港', location: '九龙公园', english: 'HONG KONG',
    context: '狮队与现场', coordinates: [114.17, 22.3], labelPosition: [919, 216],
    stories: stories('shared-rhythm'), photoYears: [2009],
  },
  {
    id: 'singapore', name: '新加坡', location: '街巷 · 会馆 · 社区', english: 'SINGAPORE',
    context: '生活中的锣鼓', coordinates: [103.82, 1.35], labelPosition: [748, 303],
    stories: stories('drum-language', 'expressive-lion', 'community-celebration'), photoYears: [2023, 2009, 2023],
  },
  {
    id: 'san-francisco', name: '旧金山', location: '唐人街', english: 'SAN FRANCISCO',
    context: '高台与桩上身法', coordinates: [-122.42, 37.77], labelPosition: [125, 208],
    stories: stories('balance-in-air'), photoYears: [2022],
  },
  {
    id: 'edmonton', name: '埃德蒙顿', location: '文化节香港馆', english: 'EDMONTON',
    context: '节庆中的相聚', coordinates: [-113.49, 53.55], labelPosition: [246, 90],
    stories: stories('cai-qing'), photoYears: [2013],
  },
];

export const spreadMapLevels = [
  { id: 'guangdong', name: '广东', subtitle: '从这里出发', count: '广州 · 佛山', nextLabel: '查看中国范围' },
  { id: 'china', name: '中国', subtitle: '把视野拉远', count: '广东 · 香港', nextLabel: '走向世界' },
  { id: 'world', name: '世界', subtitle: '万里相逢', count: '五地 · 八幅实景' },
];

// Regional pins index the same photographs; changing scale adds no new cases.
export const spreadMapPoints = {
  guangdong: [
    { id: 'foshan', name: '佛山', placeId: 'lingnan', photoIndex: 0, coordinates: [113.12, 23.02], labelPosition: [350, 365] },
    { id: 'guangzhou', name: '广州', placeId: 'lingnan', photoIndex: 1, coordinates: [113.26, 23.13], labelPosition: [620, 215] },
  ],
  china: [
    { id: 'guangdong', name: '广东', placeId: 'lingnan', coordinates: [113.26, 23.13], labelPosition: [455, 450] },
    { id: 'hong-kong', name: '香港', placeId: 'hong-kong', coordinates: [114.17, 22.3], labelPosition: [715, 420] },
  ],
  world: spreadPlaces.map(place => ({ ...place, placeId: place.id, labelPosition: [place.labelPosition[0], place.labelPosition[1] + 50] })),
};
