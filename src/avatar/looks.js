// Everything the player can customise, as plain data. The Locker screen is generated from
// LOCKER_SECTIONS, the 3D avatar and clubs read a "look" object, and new options are added here.
//
// A look is a flat object, e.g. { build: 'regular', skin: '#e0a476', hair: 'short', ... }.

const c = (hex, name) => ({ hex, name });

// ---------- palettes ----------
export const SKIN_TONES = [
  c('#ffe0c7', 'Porcelain'), c('#f7d0ae', 'Fair'), c('#efc095', 'Light'), c('#e0a476', 'Golden'),
  c('#d0915f', 'Tan'), c('#b97848', 'Caramel'), c('#9a5f36', 'Bronze'), c('#7a4527', 'Brown'),
  c('#5c3220', 'Deep'), c('#40241a', 'Ebony'),
];
export const HAIR_COLOURS = [
  c('#1c1712', 'Black'), c('#3b2618', 'Dark brown'), c('#6a4026', 'Brown'), c('#9c6a3c', 'Light brown'),
  c('#d9b26a', 'Blonde'), c('#f2dfa8', 'Platinum'), c('#a3401f', 'Auburn'), c('#d8562a', 'Ginger'),
  c('#9aa0a6', 'Grey'), c('#f2f2f0', 'White'), c('#3a63d8', 'Blue'), c('#e04f9a', 'Pink'),
  c('#2f9e6a', 'Green'), c('#7a4fd1', 'Purple'),
];
export const EYE_COLOURS = [
  c('#3b2618', 'Brown'), c('#1c1712', 'Dark'), c('#6b8e23', 'Green'), c('#3f7fbf', 'Blue'),
  c('#7a9aa8', 'Grey'), c('#a8762e', 'Hazel'), c('#8a5fc8', 'Violet'), c('#2fb5b0', 'Teal'),
];
export const CLOTHING = [
  c('#ffffff', 'White'), c('#1e2430', 'Navy'), c('#22262c', 'Black'), c('#8a929c', 'Grey'),
  c('#e04848', 'Red'), c('#f08a3c', 'Orange'), c('#f2c84b', 'Yellow'), c('#7cc24a', 'Lime'),
  c('#2f9e6a', 'Green'), c('#2fb5b0', 'Teal'), c('#3fa7e0', 'Sky'), c('#3a63d8', 'Blue'),
  c('#7a4fd1', 'Purple'), c('#e070b0', 'Pink'), c('#c9a27a', 'Khaki'), c('#7a5236', 'Brown'),
  c('#f3c58a', 'Kopi'), c('#b5d9c8', 'Mint'),
];
export const FRAME_COLOURS = [
  c('#22262c', 'Black'), c('#7a5236', 'Tortoise'), c('#d9a93a', 'Gold'), c('#c9ced4', 'Silver'),
  c('#e04848', 'Red'), c('#3a63d8', 'Blue'), c('#ffffff', 'White'), c('#e070b0', 'Pink'),
];
export const SHAFT_COLOURS = [
  c('#c9ced4', 'Steel'), c('#2a2d33', 'Graphite'), c('#d9a93a', 'Gold'), c('#e04848', 'Red'),
  c('#3a63d8', 'Blue'), c('#ffffff', 'White'), c('#2f9e6a', 'Green'), c('#f08a3c', 'Orange'),
  c('#7a4fd1', 'Purple'), c('#e070b0', 'Pink'),
];
export const GRIP_COLOURS = [
  c('#2b2f33', 'Black'), c('#8a929c', 'Grey'), c('#ffffff', 'White'), c('#e04848', 'Red'),
  c('#3a63d8', 'Blue'), c('#2f9e6a', 'Green'), c('#f08a3c', 'Orange'), c('#e070b0', 'Pink'),
  c('#f2c84b', 'Yellow'), c('#7a4fd1', 'Purple'), c('#f3c58a', 'Kopi'),
];
export const BALL_COLOURS = [
  c('#f8f8f6', 'White'), c('#f6e84a', 'Yellow'), c('#ff9a3c', 'Orange'), c('#ff6fb0', 'Pink'),
  c('#7cf05a', 'Green'), c('#5ab8ff', 'Blue'), c('#ff5050', 'Red'), c('#b28bff', 'Purple'),
];

export const METALS = [
  c('#d9a93a', 'Gold'), c('#c9ced4', 'Silver'), c('#e0a090', 'Rose gold'), c('#22262c', 'Black'),
];
export const LENS_TINTS = [
  c('#1a2230', 'Smoke'), c('#cfe8ff', 'Clear'), c('#2f6fd8', 'Blue mirror'), c('#d9a93a', 'Gold'),
  c('#e070b0', 'Rose'), c('#2f9e6a', 'Green'), c('#f08a3c', 'Orange'),
];
const PATTERN_OPTIONS = [
  ['solid', 'Plain'], ['stripes', 'Stripes'], ['pinstripe', 'Pinstripe'], ['gingham', 'Gingham'],
  ['tartan', 'Tartan'], ['argyle', 'Argyle'], ['dots', 'Polka dots'], ['camo', 'Camo'],
  ['floral', 'Hawaiian'], ['chevron', 'Chevron'], ['twotone', 'Two-tone'], ['racing', 'Racing stripe'],
];

// Club head finishes: colour plus how shiny it is.
export const HEAD_FINISHES = {
  chrome: { label: 'Chrome', hex: '#d5dbe2', shine: 90 },
  satin: { label: 'Satin', hex: '#9aa5b1', shine: 40 },
  black: { label: 'Black', hex: '#23272e', shine: 60 },
  gold: { label: 'Gold', hex: '#d9a93a', shine: 80 },
  rose: { label: 'Rose gold', hex: '#e0a090', shine: 80 },
  blue: { label: 'Blue', hex: '#3a6fd8', shine: 60 },
  red: { label: 'Red', hex: '#d23c3c', shine: 60 },
  green: { label: 'Green', hex: '#2f9e6a', shine: 60 },
  purple: { label: 'Purple', hex: '#7a4fd1', shine: 60 },
};

// ---------- the Locker layout ----------
// type 'choice' = style tiles, type 'colour' = swatches. `zoom: 'head'` frames the face in the preview.
export const LOCKER_SECTIONS = {
  golfer: [
    { id: 'quick', label: 'Quick picks', controls: [{ type: 'presets' }] },
    { id: 'body', label: 'Body', controls: [
      { type: 'choice', key: 'build', label: 'Build', options: [['slim', 'Slim'], ['regular', 'Regular'], ['broad', 'Broad'], ['chubby', 'Chubby'], ['heavy', 'Heavy'], ['muscular', 'Muscular']] },
      { type: 'choice', key: 'height', label: 'Height', options: [['short', 'Short'], ['medium', 'Medium'], ['tall', 'Tall'], ['xtall', 'Very tall']] },
      { type: 'colour', key: 'skin', label: 'Skin tone', palette: SKIN_TONES },
      { type: 'choice', key: 'tattoos', label: 'Tattoos', options: [['none', 'None'], ['arms', 'Forearms'], ['inked', 'Arms + neck']] },
    ] },
    { id: 'face', label: 'Face', zoom: 'head', controls: [
      { type: 'choice', key: 'eyes', label: 'Eyes', options: [['round', 'Round'], ['almond', 'Almond'], ['sleepy', 'Sleepy'], ['wide', 'Wide'], ['happy', 'Happy']] },
      { type: 'colour', key: 'eyeColour', label: 'Eye colour', palette: EYE_COLOURS },
      { type: 'choice', key: 'brows', label: 'Eyebrows', options: [['straight', 'Straight'], ['arched', 'Arched'], ['thick', 'Thick'], ['determined', 'Determined'], ['worried', 'Worried'], ['bushy', 'Extra bushy']] },
      { type: 'choice', key: 'nose', label: 'Nose', options: [['button', 'Button'], ['round', 'Round'], ['long', 'Long'], ['wide', 'Wide']] },
      { type: 'choice', key: 'mouth', label: 'Mouth', options: [['smile', 'Smile'], ['grin', 'Grin'], ['smirk', 'Smirk'], ['flat', 'Neutral'], ['open', 'Surprised']] },
      { type: 'choice', key: 'cheeks', label: 'Cheeks', options: [['none', 'Plain'], ['rosy', 'Rosy'], ['freckles', 'Freckles']] },
    ] },
    { id: 'hair', label: 'Hair', zoom: 'head', controls: [
      { type: 'choice', key: 'hair', label: 'Style', options: [['bald', 'Bald'], ['buzz', 'Buzz'], ['short', 'Short'], ['sidepart', 'Side part'], ['spiky', 'Spiky'], ['mohawk', 'Mohawk'], ['afro', 'Afro'], ['bun', 'Bun'], ['ponytail', 'Ponytail'], ['long', 'Long'], ['bob', 'Bob'], ['messy', 'Messy'], ['pompadour', 'Pompadour']] },
      { type: 'colour', key: 'hairColour', label: 'Hair colour', palette: HAIR_COLOURS },
      { type: 'choice', key: 'facialHair', label: 'Facial hair', options: [['none', 'None'], ['stubble', 'Stubble'], ['moustache', 'Moustache'], ['goatee', 'Goatee'], ['beard', 'Full beard']] },
    ] },
    { id: 'hat', label: 'Hat', zoom: 'head', controls: [
      { type: 'choice', key: 'hat', label: 'Style', options: [['none', 'None'], ['cap', 'Cap'], ['backwards', 'Backwards cap'], ['trucker', 'Trucker'], ['visor', 'Visor'], ['bucket', 'Bucket'], ['beanie', 'Beanie'], ['flatcap', 'Flat cap'], ['fedora', 'Fedora'], ['cowboy', 'Cowboy'], ['boater', 'Straw boater'], ['beret', 'Beret'], ['tam', 'Tam'], ['headband', 'Headband']] },
      { type: 'choice', key: 'hatPattern', label: 'Pattern', options: PATTERN_OPTIONS, preview: ['hatColour', 'hatAccent'] },
      { type: 'colour', key: 'hatColour', label: 'Hat colour', palette: CLOTHING },
      { type: 'colour', key: 'hatAccent', label: 'Band / pattern colour', palette: CLOTHING },
    ] },
    { id: 'glasses', label: 'Glasses', zoom: 'head', controls: [
      { type: 'choice', key: 'glasses', label: 'Style', options: [['none', 'None'], ['round', 'Round'], ['square', 'Square'], ['halfrim', 'Half-rim'], ['cateye', 'Cat-eye'], ['sunglasses', 'Shades'], ['aviators', 'Aviators'], ['sport', 'Sport wrap'], ['goggles', 'Goggles'], ['heart', 'Hearts']] },
      { type: 'colour', key: 'glassesColour', label: 'Frame colour', palette: FRAME_COLOURS },
      { type: 'colour', key: 'lensColour', label: 'Lens tint', palette: LENS_TINTS },
    ] },
    { id: 'top', label: 'Top', controls: [
      { type: 'choice', key: 'top', label: 'Style', options: [['polo', 'Polo'], ['tee', 'T-shirt'], ['tank', 'Tank top'], ['shirt', 'Button shirt'], ['longsleeve', 'Long sleeve'], ['rugby', 'Rugby'], ['vest', 'Sweater vest'], ['sweater', 'Sweater'], ['hoodie', 'Hoodie'], ['jacket', 'Jacket'], ['windbreaker', 'Windbreaker']] },
      { type: 'choice', key: 'topPattern', label: 'Pattern', options: PATTERN_OPTIONS, preview: ['topColour', 'topAccent'] },
      { type: 'colour', key: 'topColour', label: 'Main colour', palette: CLOTHING },
      { type: 'colour', key: 'topAccent', label: 'Trim / pattern colour', palette: CLOTHING },
    ] },
    { id: 'bottoms', label: 'Bottoms', controls: [
      { type: 'choice', key: 'bottoms', label: 'Style', options: [['trousers', 'Trousers'], ['joggers', 'Joggers'], ['cargo', 'Cargo'], ['shorts', 'Shorts'], ['skirt', 'Skirt'], ['kilt', 'Kilt'], ['plusfours', 'Plus fours']] },
      { type: 'choice', key: 'bottomsPattern', label: 'Pattern', options: PATTERN_OPTIONS, preview: ['bottomsColour', 'bottomsAccent'] },
      { type: 'colour', key: 'bottomsColour', label: 'Colour', palette: CLOTHING },
      { type: 'colour', key: 'bottomsAccent', label: 'Pattern colour', palette: CLOTHING },
    ] },
    { id: 'socks', label: 'Socks', controls: [
      { type: 'choice', key: 'socksStyle', label: 'Length', options: [['ankle', 'Ankle'], ['crew', 'Crew'], ['knee', 'Knee-high']] },
      { type: 'choice', key: 'socksPattern', label: 'Pattern', options: [['solid', 'Plain'], ['stripes', 'Stripes'], ['argyle', 'Argyle'], ['dots', 'Polka dots'], ['twotone', 'Two-tone']], preview: ['socksColour', 'socksAccent'] },
      { type: 'colour', key: 'socksColour', label: 'Colour', palette: CLOTHING },
      { type: 'colour', key: 'socksAccent', label: 'Pattern colour', palette: CLOTHING },
    ] },
    { id: 'shoes', label: 'Shoes', controls: [
      { type: 'choice', key: 'shoesStyle', label: 'Style', options: [['classic', 'Classic'], ['saddle', 'Saddle'], ['hightop', 'High-tops'], ['loafer', 'Loafers'], ['boots', 'Boots']] },
      { type: 'colour', key: 'shoesColour', label: 'Upper', palette: CLOTHING },
      { type: 'colour', key: 'shoesAccent', label: 'Saddle / laces', palette: CLOTHING },
      { type: 'colour', key: 'soleColour', label: 'Sole', palette: CLOTHING },
    ] },
    { id: 'gloves', label: 'Gloves', controls: [
      { type: 'choice', key: 'gloves', label: 'Style', options: [['none', 'None'], ['left', 'Left hand'], ['both', 'Both hands']] },
      { type: 'colour', key: 'glovesColour', label: 'Colour', palette: CLOTHING },
      { type: 'colour', key: 'glovesAccent', label: 'Cuff colour', palette: CLOTHING },
    ] },
    { id: 'extras', label: 'Extras', controls: [
      { type: 'choice', key: 'neck', label: 'Neck', options: [['none', 'None'], ['chain', 'Chain'], ['pendant', 'Pendant'], ['tie', 'Tie'], ['bowtie', 'Bow tie'], ['scarf', 'Scarf']] },
      { type: 'colour', key: 'neckColour', label: 'Neck colour', palette: [...METALS, ...CLOTHING] },
      { type: 'choice', key: 'wrist', label: 'Wrist', options: [['none', 'None'], ['watch', 'Watch'], ['sweatband', 'Sweatband'], ['bracelet', 'Bracelet']] },
      { type: 'colour', key: 'wristColour', label: 'Wrist colour', palette: [...METALS, ...CLOTHING] },
      { type: 'choice', key: 'ears', label: 'Earrings', options: [['none', 'None'], ['studs', 'Studs'], ['hoops', 'Hoops']] },
      { type: 'colour', key: 'earColour', label: 'Earring colour', palette: METALS },
    ] },
  ],
  clubs: [
    { id: 'heads', label: 'Heads', controls: [
      { type: 'choice', key: 'headFinish', label: 'Finish', options: Object.entries(HEAD_FINISHES).map(([id, f]) => [id, f.label]), swatches: true },
    ] },
    { id: 'shaft', label: 'Shaft', controls: [{ type: 'colour', key: 'shaftColour', label: 'Shaft colour', palette: SHAFT_COLOURS }] },
    { id: 'grip', label: 'Grip', controls: [{ type: 'colour', key: 'gripColour', label: 'Grip colour', palette: GRIP_COLOURS }] },
    { id: 'ball', label: 'Ball', controls: [{ type: 'colour', key: 'ballColour', label: 'Ball colour', palette: BALL_COLOURS }] },
  ],
};

export const DEFAULT_LOOK = {
  build: 'regular', height: 'medium', skin: '#e0a476', tattoos: 'none',
  eyes: 'round', eyeColour: '#3b2618', brows: 'straight', nose: 'button', mouth: 'smile', cheeks: 'none',
  hair: 'short', hairColour: '#1c1712', facialHair: 'none',
  hat: 'cap', hatColour: '#ffffff', hatPattern: 'solid', hatAccent: '#22262c',
  glasses: 'none', glassesColour: '#22262c', lensColour: '#1a2230',
  top: 'polo', topColour: '#3a63d8', topAccent: '#ffffff', topPattern: 'solid',
  bottoms: 'trousers', bottomsColour: '#c9a27a', bottomsPattern: 'solid', bottomsAccent: '#ffffff',
  socksStyle: 'crew', socksPattern: 'solid', socksColour: '#ffffff', socksAccent: '#22262c',
  shoesStyle: 'classic', shoesColour: '#ffffff', shoesAccent: '#22262c', soleColour: '#22262c',
  gloves: 'left', glovesColour: '#ffffff', glovesAccent: '#ffffff',
  neck: 'none', neckColour: '#d9a93a', wrist: 'none', wristColour: '#22262c', ears: 'none', earColour: '#d9a93a',
  headFinish: 'chrome', shaftColour: '#c9ced4', gripColour: '#2b2f33', ballColour: '#f8f8f6',
};

// Quick-pick golfers (the crew). Picking one sets the golfer's look; clubs and ball stay as they are.
export const GOLFER_PRESETS = [
  {
    id: 'garet', name: 'Garet', blurb: 'Tall, sharp and handsome',
    look: {
      build: 'regular', height: 'tall', skin: '#efc095', tattoos: 'none',
      eyes: 'almond', eyeColour: '#3b2618', brows: 'straight', nose: 'button', mouth: 'smirk', cheeks: 'none',
      hair: 'sidepart', hairColour: '#3b2618', facialHair: 'stubble',
      hat: 'none', hatColour: '#ffffff', glasses: 'none', glassesColour: '#22262c',
      top: 'polo', topColour: '#1e2430', topAccent: '#ffffff',
      bottoms: 'trousers', bottomsColour: '#c9a27a', socksColour: '#ffffff',
      shoesColour: '#ffffff', soleColour: '#22262c', gloves: 'left', glovesColour: '#ffffff',
      wrist: 'watch', wristColour: '#c9ced4', shoesStyle: 'saddle', shoesAccent: '#7a5236',
    },
  },
  {
    id: 'pramoth', name: 'Pramoth', blurb: 'Short, big and built for power',
    look: {
      build: 'heavy', height: 'short', skin: '#5c3220', tattoos: 'none',
      eyes: 'round', eyeColour: '#1c1712', brows: 'thick', nose: 'round', mouth: 'grin', cheeks: 'none',
      hair: 'short', hairColour: '#1c1712', facialHair: 'moustache',
      hat: 'cap', hatColour: '#e04848', glasses: 'none', glassesColour: '#22262c',
      top: 'polo', topColour: '#f08a3c', topAccent: '#ffffff',
      bottoms: 'shorts', bottomsColour: '#1e2430', socksColour: '#ffffff',
      shoesColour: '#ffffff', soleColour: '#22262c', gloves: 'left', glovesColour: '#ffffff',
      neck: 'chain', neckColour: '#d9a93a',
    },
  },
  {
    id: 'drt', name: 'DRT', blurb: 'Skinny, inked, bed-head hair',
    look: {
      build: 'slim', height: 'medium', skin: '#d0915f', tattoos: 'inked',
      eyes: 'sleepy', eyeColour: '#3b2618', brows: 'determined', nose: 'long', mouth: 'flat', cheeks: 'none',
      hair: 'messy', hairColour: '#1c1712', facialHair: 'stubble',
      hat: 'none', hatColour: '#22262c', glasses: 'none', glassesColour: '#22262c',
      top: 'tee', topColour: '#22262c', topAccent: '#8a929c',
      bottoms: 'shorts', bottomsColour: '#8a929c', socksColour: '#22262c',
      shoesColour: '#22262c', soleColour: '#ffffff', gloves: 'none', glovesColour: '#22262c',
      ears: 'studs', earColour: '#c9ced4', wrist: 'sweatband', wristColour: '#22262c', shoesStyle: 'hightop', shoesAccent: '#ffffff',
    },
  },
  {
    id: 'steven', name: 'Steven', blurb: 'Podgy, golden and always smiling',
    look: {
      build: 'chubby', height: 'medium', skin: '#e0a476', tattoos: 'none',
      eyes: 'happy', eyeColour: '#1c1712', brows: 'arched', nose: 'button', mouth: 'smile', cheeks: 'rosy',
      hair: 'short', hairColour: '#1c1712', facialHair: 'none',
      hat: 'bucket', hatColour: '#2f9e6a', glasses: 'round', glassesColour: '#22262c',
      top: 'tee', topColour: '#3fa7e0', topAccent: '#ffffff', topPattern: 'floral',
      bottoms: 'trousers', bottomsColour: '#1e2430', socksColour: '#ffffff',
      shoesColour: '#ffffff', soleColour: '#3fa7e0', gloves: 'left', glovesColour: '#ffffff',
    },
  },
  {
    id: 'henny', name: 'Henny', blurb: 'Tall and big: the gentle giant',
    look: {
      build: 'heavy', height: 'tall', skin: '#f7d0ae', tattoos: 'none',
      eyes: 'wide', eyeColour: '#6b8e23', brows: 'thick', nose: 'wide', mouth: 'grin', cheeks: 'none',
      hair: 'buzz', hairColour: '#3b2618', facialHair: 'beard',
      hat: 'backwards', hatColour: '#22262c', glasses: 'none', glassesColour: '#22262c',
      top: 'polo', topColour: '#7a4fd1', topAccent: '#f2c84b',
      bottoms: 'trousers', bottomsColour: '#22262c', socksColour: '#22262c', bottomsPattern: 'tartan', bottomsAccent: '#7a4fd1',
      shoesColour: '#22262c', soleColour: '#ffffff', gloves: 'both', glovesColour: '#22262c',
    },
  },
  {
    id: 'eyas', name: 'Eyas', blurb: 'Skinny, bald and a proper moustache',
    look: {
      build: 'slim', height: 'medium', skin: '#d0915f', tattoos: 'none',
      eyes: 'almond', eyeColour: '#3b2618', brows: 'thick', nose: 'long', mouth: 'smile', cheeks: 'none',
      hair: 'bald', hairColour: '#1c1712', facialHair: 'moustache',
      hat: 'none', hatColour: '#ffffff', glasses: 'aviators', glassesColour: '#d9a93a', lensColour: '#1a2230',
      top: 'polo', topColour: '#ffffff', topAccent: '#2f9e6a',
      bottoms: 'trousers', bottomsColour: '#8a929c', socksColour: '#ffffff',
      shoesStyle: 'loafer', shoesColour: '#7a5236', shoesAccent: '#f2c84b', soleColour: '#22262c',
      gloves: 'left', glovesColour: '#ffffff', wrist: 'watch', wristColour: '#d9a93a',
    },
  },
  {
    id: 'faly', name: 'Faly', blurb: 'Lanky, sky-high, never without his chain',
    look: {
      build: 'slim', height: 'xtall', skin: '#40241a', tattoos: 'none',
      eyes: 'happy', eyeColour: '#1c1712', brows: 'straight', nose: 'wide', mouth: 'grin', cheeks: 'none',
      hair: 'buzz', hairColour: '#1c1712', facialHair: 'goatee',
      hat: 'none', hatColour: '#22262c', glasses: 'none', glassesColour: '#22262c',
      top: 'tee', topColour: '#22262c', topAccent: '#f2c84b',
      bottoms: 'joggers', bottomsColour: '#22262c', bottomsAccent: '#f2c84b', socksColour: '#ffffff',
      shoesStyle: 'hightop', shoesColour: '#ffffff', shoesAccent: '#f2c84b', soleColour: '#22262c',
      gloves: 'left', glovesColour: '#22262c', neck: 'chain', neckColour: '#d9a93a',
    },
  },
  {
    id: 'weixiong', name: 'WeiXiong', blurb: 'Built like a wall, hair like a legend',
    look: {
      build: 'muscular', height: 'tall', skin: '#efc095', tattoos: 'none',
      eyes: 'almond', eyeColour: '#1c1712', brows: 'determined', nose: 'button', mouth: 'smirk', cheeks: 'none',
      hair: 'pompadour', hairColour: '#1c1712', facialHair: 'none',
      hat: 'none', hatColour: '#ffffff', glasses: 'none', glassesColour: '#22262c',
      top: 'tank', topColour: '#e04848', topAccent: '#ffffff',
      bottoms: 'shorts', bottomsColour: '#22262c', socksColour: '#ffffff', socksStyle: 'ankle',
      shoesStyle: 'classic', shoesColour: '#ffffff', shoesAccent: '#e04848', soleColour: '#22262c',
      gloves: 'both', glovesColour: '#22262c', glovesAccent: '#e04848', wrist: 'sweatband', wristColour: '#e04848',
    },
  },
  {
    id: 'gleb', name: 'Gleb', blurb: 'Medium height (he says tall), fashion crimes',
    look: {
      // Cowboy hat and boots for those extra centimetres; every pattern at once.
      build: 'regular', height: 'medium', skin: '#f7d0ae', tattoos: 'none',
      eyes: 'wide', eyeColour: '#3f7fbf', brows: 'arched', nose: 'long', mouth: 'grin', cheeks: 'rosy',
      hair: 'sidepart', hairColour: '#d9b26a', facialHair: 'none',
      hat: 'cowboy', hatColour: '#e070b0', hatPattern: 'dots', hatAccent: '#f2c84b',
      glasses: 'sport', glassesColour: '#e04848', lensColour: '#f08a3c',
      top: 'shirt', topColour: '#f08a3c', topAccent: '#7a4fd1', topPattern: 'floral',
      bottoms: 'shorts', bottomsColour: '#2f9e6a', bottomsPattern: 'tartan', bottomsAccent: '#e04848',
      socksStyle: 'knee', socksPattern: 'argyle', socksColour: '#7cc24a', socksAccent: '#e070b0',
      shoesStyle: 'boots', shoesColour: '#7a5236', shoesAccent: '#f2c84b', soleColour: '#ffffff',
      gloves: 'both', glovesColour: '#f2c84b', glovesAccent: '#3fa7e0',
      neck: 'bowtie', neckColour: '#3fa7e0', wrist: 'sweatband', wristColour: '#e070b0',
    },
  },
  {
    id: 'matrickseah', name: 'Matrick Seah', blurb: 'Stocky, strong, eyebrows of legend',
    look: {
      build: 'muscular', height: 'short', skin: '#efc095', tattoos: 'none',
      eyes: 'almond', eyeColour: '#1c1712', brows: 'bushy', nose: 'round', mouth: 'flat', cheeks: 'none',
      hair: 'short', hairColour: '#1c1712', facialHair: 'stubble',
      hat: 'none', hatColour: '#22262c', glasses: 'none', glassesColour: '#22262c',
      top: 'polo', topColour: '#2fb5b0', topAccent: '#ffffff',
      bottoms: 'trousers', bottomsColour: '#1e2430', socksColour: '#ffffff',
      shoesStyle: 'classic', shoesColour: '#ffffff', shoesAccent: '#2fb5b0', soleColour: '#22262c',
      gloves: 'left', glovesColour: '#ffffff', glovesAccent: '#2fb5b0', wrist: 'watch', wristColour: '#22262c',
    },
  },
];

// A look for a player who isn't on this device's Locker (pass the phone): a crew member gets their
// preset, anyone else a look generated from their name, so the same name always looks the same.
export function lookForName(name) {
  const key = String(name ?? '').toLowerCase().replace(/[^a-z]/g, '');
  const preset = GOLFER_PRESETS.find((p) => p.id === key || p.name.toLowerCase() === key);
  if (preset) return sanitizeLook({ ...DEFAULT_LOOK, ...preset.look });
  let h = 2166136261;
  for (const ch of key || 'player') h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const random = () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = Math.imul(h ^ (h >>> 15), h | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return sanitizeLook(randomLook(random));
}

// Which preset (if any) the look currently matches.
export function matchingPreset(look) {
  return GOLFER_PRESETS.find((p) => Object.entries(p.look).every(([k, v]) => look[k] === v))?.id ?? null;
}

// Every key a look can have, with its allowed values.
function allowedValues() {
  const allowed = {};
  for (const sections of Object.values(LOCKER_SECTIONS)) {
    for (const section of sections) {
      for (const control of section.controls) {
        if (!control.key) continue; // quick picks have no key of their own
        allowed[control.key] = control.type === 'choice'
          ? control.options.map(([id]) => id)
          : control.palette.map((p) => p.hex);
      }
    }
  }
  return allowed;
}
export const ALLOWED = allowedValues();

// Drop anything unknown (old saves, hand-edited storage) and fill gaps with defaults.
export function sanitizeLook(look) {
  const clean = { ...DEFAULT_LOOK };
  if (look && typeof look === 'object') {
    for (const [key, values] of Object.entries(ALLOWED)) {
      if (values.includes(look[key])) clean[key] = look[key];
    }
  }
  return clean;
}

const pick = (list, random) => list[Math.floor(random() * list.length)];

// A random but sensible look: same colour never used for top and bottoms.
export function randomLook(random = Math.random) {
  const look = {};
  for (const [key, values] of Object.entries(ALLOWED)) look[key] = pick(values, random);
  while (look.bottomsColour === look.topColour) look.bottomsColour = pick(ALLOWED.bottomsColour, random);
  if (random() < 0.5) look.hat = 'none';
  if (random() < 0.6) look.glasses = 'none';
  if (random() < 0.6) look.facialHair = 'none';
  if (random() < 0.7) look.tattoos = 'none';
  for (const k of ['topPattern', 'bottomsPattern', 'hatPattern', 'socksPattern']) if (random() < 0.55) look[k] = 'solid';
  for (const k of ['neck', 'wrist', 'ears']) if (random() < 0.6) look[k] = 'none';
  return look;
}

const LOOK_KEY = 'kopigolf.look';
export function loadLook() {
  try { return sanitizeLook(JSON.parse(localStorage.getItem(LOOK_KEY) || 'null')); } catch { return { ...DEFAULT_LOOK }; }
}
export function saveLook(look) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* storage blocked */ }
}
