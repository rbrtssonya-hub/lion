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
