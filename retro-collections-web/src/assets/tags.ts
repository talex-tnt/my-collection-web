export const AVAILABLE_TAG_IMAGES = [
  // SEGA
  {
    id: 'sega-retro',
    path: '/tag-icons/sega-logo.png',
    label: 'Sega (1975)',
  },
  {
    id: 'sega-genesis',
    path: '/tag-icons/sega-genesis.png',
    label: 'Sega Genesis',
  },
  {
    id: 'master-system',
    path: '/tag-icons/master-system.png',
    label: 'Master System',
  },
  {
    id: 'mega-drive-jp',
    path: '/tag-icons/megadrive-jap.png',
    label: 'Mega Drive JP',
  },
  {
    id: 'mega-drive-eu',
    path: '/tag-icons/sega-mega-drive-logo-png-transparent.png',
    label: 'Mega Drive EU',
  },
  {
    id: 'mega-drive-eu-bw',
    path: '/tag-icons/sega-mega-drive-logo-black-and-white.png',
    label: 'Mega Drive EU B&W',
  },
  {
    id: 'game-gear-jp-usa',
    path: '/tag-icons/game-gear-us.png',
    label: 'Game Gear JP/USA',
    bgColor: 'bg-white',
  },
  {
    id: 'game-gear-eu',
    path: '/tag-icons/game-gear-eu.png',
    label: 'Game Gear EU',
  },
  {
    id: 'mega-cd-jp',
    path: '/tag-icons/mega-cd-jp.png',
    label: 'Mega CD JP',
  },
  {
    id: 'mega-cd-eu',
    path: '/tag-icons/mega-cd-eu.png',
    label: 'Mega CD EU',
  },
  {
    id: 'sega-cd-us',
    path: '/tag-icons/sega-cd-us.png',
    label: 'Sega CD US',
  },
  {
    id: 'saturn-jp',
    path: '/tag-icons/saturn-jap.png',
    label: 'Saturn JP',
    bgColor: 'bg-white',
  },
  {
    id: 'saturn-eu',
    path: '/tag-icons/saturn-usa.png',
    label: 'Saturn USA',
  },
  {
    id: 'dreamcast',
    path: '/tag-icons/sega-dreamcast.png',
    label: 'Dreamcast',
    bgColor: 'bg-white',
  },

  // NINTENDO
  {
    id: 'nintendo-logo',
    path: '/tag-icons/nintendo-logo.png',
    label: 'Nintendo',
  },
  {
    id: 'super-nintendo',
    path: '/tag-icons/super-nintendo-logo.png',
    label: 'Super Nintendo',
  },
  {
    id: 'super-famicom',
    path: '/tag-icons/super-famicom-logo.png',
    label: 'Super Famicom',
    bgColor: 'bg-white',
  },
  { id: 'nes', path: '/tag-icons/nes.png', label: 'NES' },
  { id: 'game-boy', path: '/tag-icons/game-boy.png', label: 'Game Boy' },
  {
    id: 'nintendo-64',
    path: '/tag-icons/nintendo-64.png',
    label: 'Nintendo 64',
  },
  {
    id: 'nintendo-gamecube',
    path: '/tag-icons/nintendo-gamecube.png',
    label: 'Nintendo GameCube',
  },
  {
    id: 'nintendo-ds',
    path: '/tag-icons/nintendo-ds.svg',
    label: 'Nintendo DS',
    bgColor: 'bg-white',
  },
  { id: 'nintendo-wii', path: '/tag-icons/nintendo-wii.png', label: 'Wii' },
  { id: 'wii-u', path: '/tag-icons/wii-u.png', label: 'Wii U' },
  {
    id: 'nintendo-switch',
    path: '/tag-icons/nintendo-switch.png',
    label: 'Nintendo Switch',
  },

  // PLAYSTATION
  {
    id: 'sony',
    path: '/tag-icons/sony.png',
    label: 'SONY',
    bgColor: 'bg-white',
  },
  {
    id: 'playstation-retro',
    path: '/tag-icons/ps1.png',
    label: 'PlayStation (Classic)',
  },
  {
    id: 'ps2',
    path: '/tag-icons/ps2.png',
    label: 'PlayStation 2',
    bgColor: 'bg-white',
  },
  {
    id: 'ps3',
    path: '/tag-icons/ps3.png',
    label: 'PlayStation 3',
    bgColor: 'bg-white',
  },
  {
    id: 'ps4',
    path: '/tag-icons/ps4.png',
    label: 'PlayStation 4',
    bgColor: 'bg-white',
  },
  {
    id: 'ps5',
    path: '/tag-icons/ps5.png',
    label: 'PlayStation 5',
    bgColor: 'bg-white',
  },

  // XBOX
  {
    id: 'microsoft',
    path: '/tag-icons/microsoft.png',
    label: 'Miscrosoft',
    bgColor: 'bg-white',
  },
  {
    id: 'xbox-classic',
    path: '/tag-icons/xbox-logo-2001-2005.png',
    label: 'Xbox (Classic)',
  },
  { id: 'xbox-360', path: '/tag-icons/xbox-360-logo.png', label: 'Xbox 360' },
  {
    id: 'xbox-2010',
    path: '/tag-icons/xbox-logo-2010-2013.png',
    label: 'Xbox (2010)',
  },

  // publisher logos
  {
    id: 'capcom',
    path: '/tag-icons/capcom-logo.png',
    label: 'Capcom',
  },
  {
    id: 'namco',
    path: '/tag-icons/namco-logo.png',
    label: 'Namco',
  },

  // regions
  {
    id: 'pal',
    path: '/tag-icons/pal-region.png',
    label: 'PAL Region',
  },

  // flags
  {
    id: 'italian',
    path: '/tag-icons/ita.png',
    label: 'Italian',
  },
  {
    id: 'japanese',
    path: '/tag-icons/jap.png',
    label: 'Japanese',
  },
  {
    id: 'uk',
    path: '/tag-icons/uk-flag.png',
    label: 'British',
  },
  {
    id: 'usa',
    path: '/tag-icons/usa-flag.png',
    label: 'American',
  },
  {
    id: 'french',
    path: '/tag-icons/fr-flag.png',
    label: 'French',
  },
];

export const TAG_COLOR_PAIRS = [
  { name: 'Default', backgroundColor: null, foregroundColor: null },
  {
    name: 'Transparent',
    backgroundColor: 'transparent',
    foregroundColor: 'transparent',
  },
  // Base colors
  { name: 'Red', backgroundColor: '#f87171', foregroundColor: '#fff' },
  { name: 'Amber', backgroundColor: '#fbbf24', foregroundColor: '#222' },
  { name: 'Green', backgroundColor: '#34d399', foregroundColor: '#222' },
  { name: 'Blue', backgroundColor: '#60a5fa', foregroundColor: '#fff' },
  { name: 'Purple', backgroundColor: '#a78bfa', foregroundColor: '#fff' },
  { name: 'Pink', backgroundColor: '#f472b6', foregroundColor: '#222' },
  { name: 'Yellow', backgroundColor: '#facc15', foregroundColor: '#222' },
  { name: 'Gray', backgroundColor: '#d1d5db', foregroundColor: '#222' },
  { name: 'Black', backgroundColor: '#000000', foregroundColor: '#fff' },
  { name: 'White', backgroundColor: '#ffffff', foregroundColor: '#222' },
  { name: 'Dark Blue', backgroundColor: '#1e293b', foregroundColor: '#fff' },

  // 🎮 Console / gaming brand colors
  { name: 'Nintendo', backgroundColor: '#e60012', foregroundColor: '#ffffff' },
  {
    name: 'PlayStation',
    backgroundColor: '#003791',
    foregroundColor: '#ffffff',
  },
  { name: 'Xbox', backgroundColor: '#107C10', foregroundColor: '#ffffff' },
  { name: 'Sega', backgroundColor: '#006db6', foregroundColor: '#ffffff' },
  { name: 'Steam', backgroundColor: '#1b2838', foregroundColor: '#c7d5e0' },
  {
    name: 'Epic Games',
    backgroundColor: '#111111',
    foregroundColor: '#ffffff',
  },
  { name: 'Atari', backgroundColor: '#000000', foregroundColor: '#ff4f00' },
];
