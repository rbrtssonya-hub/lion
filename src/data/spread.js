import { homeCultureStories } from './home-culture.js';

// Map locations index the collection's twelve places. Coordinates are
// approximate city-center positions; a photo is attached only where this
// project already has a sourced local case.
const stories = (...ids) => ids.map(id => homeCultureStories.find(story => story.id === id)).filter(Boolean);

export const spreadMapLevels = [
  { id: 'guangdong', name: '广东', subtitle: '狮醒岭南', collection: 'COLLECTION 001', count: '4 个地点', nextLabel: '查看中国范围' },
  { id: 'china', name: '中国', subtitle: '狮舞九州', collection: 'COLLECTION 002', count: '4 个地点', nextLabel: '走向世界' },
  { id: 'world', name: '世界', subtitle: '狮跃四海', collection: 'COLLECTION 003', count: '4 个地点' },
];

export const spreadPlaces = [
  {
    id: 'foshan', level: 'guangdong', serial: '01', name: '佛山', location: '广东省佛山市', english: 'FOSHAN',
    coordinates: [113.12, 23.02], stories: stories('living-tradition'), photoYears: [2008],
  },
  {
    id: 'guangzhou', level: 'guangdong', serial: '02', name: '广州', location: '广东省广州市', english: 'GUANGZHOU',
    coordinates: [113.26, 23.13], stories: stories('lion-head-craft'), photoYears: [2020],
  },
  {
    id: 'heshan', level: 'guangdong', serial: '03', name: '鹤山', location: '广东省江门市鹤山市', english: 'HESHAN',
    coordinates: [112.96, 22.77], stories: [], photoYears: [],
  },
  {
    id: 'suixi', level: 'guangdong', serial: '04', name: '遂溪', location: '广东省湛江市遂溪县', english: 'SUIXI',
    coordinates: [110.25, 21.38], stories: [], photoYears: [],
  },
  {
    id: 'beijing', level: 'china', serial: '05', name: '北京', location: '北京市', english: 'BEIJING',
    // Source: https://www.beijing.gov.cn/renwen/bjgk/ (116°20′E, 39°56′N).
    coordinates: [116.33, 39.93], stories: [], photoYears: [],
  },
  {
    id: 'tianyang', level: 'china', serial: '06', name: '田阳', location: '广西壮族自治区百色市田阳区', english: 'TIANYANG',
    coordinates: [106.91, 23.74], stories: [], photoYears: [],
  },
  {
    id: 'quanzhou', level: 'china', serial: '07', name: '泉州', location: '福建省泉州市', english: 'QUANZHOU',
    coordinates: [118.67, 24.87], stories: [], photoYears: [],
  },
  {
    id: 'hong-kong', level: 'china', serial: '08', name: '香港', location: '中国香港特别行政区', english: 'HONG KONG',
    coordinates: [114.17, 22.30], stories: stories('shared-rhythm'), photoYears: [2009],
  },
  {
    id: 'singapore', level: 'world', serial: '09', name: '新加坡', location: '新加坡 · 新加坡', english: 'SINGAPORE',
    coordinates: [103.82, 1.35], stories: stories('drum-language', 'expressive-lion', 'community-celebration'), photoYears: [2023, 2009, 2023],
  },
  {
    id: 'kuala-lumpur', level: 'world', serial: '10', name: '吉隆坡', location: '马来西亚 · 吉隆坡', english: 'KUALA LUMPUR',
    coordinates: [101.69, 3.14], stories: [], photoYears: [],
  },
  {
    id: 'san-francisco', level: 'world', serial: '11', name: '旧金山', location: '美国 · 旧金山', english: 'SAN FRANCISCO',
    coordinates: [-122.42, 37.77], stories: stories('balance-in-air'), photoYears: [2022],
  },
  {
    id: 'london', level: 'world', serial: '12', name: '伦敦', location: '英国 · 伦敦', english: 'LONDON',
    coordinates: [-0.13, 51.51], stories: [], photoYears: [],
  },
];

export const spreadMapPoints = Object.fromEntries(spreadMapLevels.map(level => [
  level.id,
  spreadPlaces.filter(place => place.level === level.id).map(place => ({
    id: place.id,
    level: place.level,
    serial: place.serial,
    name: place.name,
    placeId: place.id,
    coordinates: place.coordinates,
  })),
]));
