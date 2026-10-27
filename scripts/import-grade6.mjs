// Rebuild the built-in curriculum from the locally verified textbook reference.
// Run from this checkout; the source screenshots stay outside public/.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { format } from 'prettier';

const reference = path.resolve(process.argv[2] || '../Textbook_Reference/Blue_Sky_Elementary_6');
const catalog = JSON.parse(fs.readFileSync(path.join(reference, 'Units_02_08_catalog.json')));
const unitOne = JSON.parse(
  fs.readFileSync(path.join(reference, 'Unit_01/metadata/vocabulary.json')),
);
const examples = {
  1: [
    'I like soccer.',
    'I have a red bag.',
    'I want a new pencil.',
    'I like math.',
    'I study English.',
    'I like music.',
    'I have a cat.',
    'I like cats.',
    'I have a dog.',
    'I like dogs.',
    'I like swimming.',
    'I like surfing.',
    'I like dancing.',
    'I like cooking.',
    'I like skiing.',
    'I like skating.',
    'I like running.',
    'I like singing.',
    'I like drawing.',
    'I like speaking English.',
    'I like playing soccer.',
    'I like playing the piano.',
    'My favorite food is sushi.',
    'My favorite sport is soccer.',
    'My favorite color is blue.',
    'My favorite subject is math.',
    'My favorite animal is a cat.',
  ],
  2: [
    'We can see a shrine.',
    'We can visit a temple.',
    'I like this garden.',
    'I like the festival.',
    'I like hot springs.',
    'We can see a castle.',
    'We can see a mountain.',
    'We can see a bridge.',
    'I like spring.',
    'I like summer.',
    'I like fall.',
    'I like winter.',
    'The garden is beautiful.',
    'The festival is exciting.',
    'The garden is relaxing.',
    'The festival is fun.',
    'The food is delicious.',
    'I can see a mountain.',
    'I eat rice.',
    'I visit my grandparents.',
    'I drink water.',
  ],
  3: [
    'There is a park in our town.',
    'Our school has a gym.',
    'Our school has a swimming pool.',
    'Our town has a stadium.',
    'We have a science museum.',
    'We have an aquarium.',
    'We have a zoo.',
    'We have a library.',
    'We have a shopping mall.',
    'We have a movie theater.',
    'We have an amusement park.',
    'We can walk on the sidewalk.',
    'We have a skate park.',
    'We can sit on the bench.',
    'We have a campsite.',
    'There is a street light.',
    'This library has free Wi-Fi.',
    'This building has a ramp.',
    'This building has an elevator.',
  ],
  4: [
    'My summer vacation was great.',
    'My summer vacation was fun.',
    'My summer vacation was good.',
    'My summer vacation was exciting.',
    'I went to the beach.',
    'I enjoyed swimming.',
    'I ate watermelon.',
    'I went to the park.',
    'I played badminton.',
    'I saw a rainbow.',
    'I went to the river.',
    'I enjoyed fishing.',
    'I ate grilled fish.',
    "I went to my grandparents' house.",
    'I watched a movie.',
    'I ate curry and rice.',
    'I played the piano.',
    'I made a model ship.',
    'I read a book.',
    'I went to the mountain.',
    'I enjoyed hiking.',
    'I saw a beetle.',
    'I went to the lake.',
    'I enjoyed camping.',
    'I watched fireworks.',
    'I went to the stadium.',
    'I bought a soccer uniform.',
    'I watched a soccer game.',
    'I went to the park.',
    'I saw a rainbow.',
  ],
  6: [
    'My favorite memory is the entrance ceremony.',
    'My favorite memory is the field trip.',
    'My favorite memory is the sports festival.',
    'My favorite memory is the school camp.',
    'My favorite memory is the swimming meet.',
    'My favorite memory is the school trip.',
    'My favorite memory is the drama festival.',
    'My favorite memory is the school marathon.',
    'My favorite memory is the music festival.',
    'My favorite memory is the graduation ceremony.',
    'I saw many animals.',
    'I ate lunch.',
    'I ran fast.',
    'I won first place.',
    'I made curry and rice.',
    'I enjoyed the campfire.',
    'I saw Tokyo Skytree.',
    'I bought souvenirs.',
    'I made a costume.',
    'I played Cinderella.',
    'I enjoyed singing.',
    'I played the recorder.',
  ],
  8: [
    'I want to join the baseball team.',
    'I want to join the swimming team.',
    'I want to join the tennis team.',
    'I want to join the track and field team.',
    'I want to join the soccer team.',
    'I want to join the chorus.',
    'I want to join the brass band.',
    'I want to join the art club.',
    'I want to join the science club.',
    'I want to join the judo club.',
    'I want to join the computer club.',
    'I want to join the English club.',
    'I want to join the dance club.',
    'I want to join the basketball team.',
    'I want to join the table tennis team.',
    'I want to go on a field trip.',
    'I want to sing in the chorus contest.',
    'I want to wear the school uniform.',
    'I want to attend Career Day.',
    'I want to make many friends.',
    'I want to study English hard.',
    'I want to do volunteer work.',
  ],
};
function legacy(file, name) {
  const context = vm.createContext({ structuredClone });
  return JSON.parse(
    vm.runInContext(fs.readFileSync(file, 'utf8') + `\nJSON.stringify(${name})`, context),
  );
}
const original = legacy('public/vocabulary.js', 'vocabulary');
const jobs = legacy('public/vocabulary-unit7.js', 'unitSevenVocabulary');
const canonical = (word) => word.replaceAll('’', "'");
const slug = (word) =>
  word
    .toLowerCase()
    .replace(/[^a-z]+/g, '-')
    .replace(/^-|-$/g, '');
const profiles = {},
  provenance = [];
for (const unit of [1, 2, 3, 4, 5, 6, 7, 8]) {
  const source = unit === 1 ? unitOne.items : catalog.items.filter((item) => item.unit === unit);
  const sourceRoot = unit === 1 ? path.join(reference, 'Unit_01') : reference;
  const images = new Map();
  for (const item of source) {
    const image = `/assets/vocabulary/g6-unit${unit}/${path.basename(item.image)}`;
    const destination = 'public' + image;
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(sourceRoot, item.image), destination);
    images.set(canonical(item.word), image);
    provenance.push({
      unit,
      word: canonical(item.word),
      image,
      sourcePage: unit === 1 ? 1 : item.source_page,
      sourceImageSha256: item.image_sha256,
      source: 'Blue Sky elementary 6 vocabulary appendix',
      acquisition:
        unit === 1
          ? 'native-pixel crop of user-provided screenshot, no upscaling'
          : 'native-pixel crop of reader zoom capture, no upscaling',
    });
  }
  const vocabulary =
    unit === 5
      ? original
      : unit === 7
        ? jobs
        : source.map((item, i) => {
            const word = canonical(item.word);
            if (!examples[unit][i]) throw Error(`Missing sentence for ${unit}: ${word}`);
            return {
              word,
              meaning: item.meaning_ja,
              group:
                unit === 1 && i < 3
                  ? 'verb'
                  : unit === 2 && i >= 12 && i <= 16
                    ? 'adjective'
                    : unit === 2 && i >= 17
                      ? 'verb'
                      : unit === 4 && i < 4
                        ? 'adjective'
                        : unit === 4 && i >= 28
                          ? 'verb'
                          : word.includes(' ')
                            ? 'phrase'
                            : 'other',
              base: '',
              example: examples[unit][i],
              // Abstract feelings/ownership cannot be uniquely inferred from an
              // illustration. Keep their pictures on study cards, use meanings
              // for assessment instead. Teachers can opt back into picture tasks.
              ...(unit === 1 && i < 3 ? { pictureEnabled: false } : {}),
            };
          });
  profiles[unit] = vocabulary.map((word) => {
    const audio = `/assets/words/${slug(word.word)}.wav`;
    return {
      ...word,
      image: images.get(word.word) || null,
      audio: fs.existsSync('public' + audio) ? audio : null,
    };
  });
}
// The purple past-tense row is shared by Unit 4 and Unit 5 in the textbook.
profiles[4].push(
  ...profiles[5].filter((word) =>
    ['ate', 'enjoyed', 'watched', 'bought', 'played', 'made', 'read'].includes(word.word),
  ),
);
fs.writeFileSync(
  'server/editor/grade6-content.mjs',
  await format(
    '// Generated by scripts/import-grade6.mjs; examples are original classroom prompts.\n' +
      'export const gradeSixContent = ' +
      JSON.stringify(profiles, null, 2) +
      ';\n',
    { ...JSON.parse(fs.readFileSync('.prettierrc.json', 'utf8')), parser: 'babel' },
  ),
);
fs.mkdirSync('docs/content', { recursive: true });
fs.writeFileSync(
  'docs/content/grade6-image-sources.json',
  JSON.stringify(
    {
      capturedOn: '2026-10-24',
      count: provenance.length,
      note: 'Reference originals remain outside public/. App includes only the individual word illustrations.',
      items: provenance,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Imported ' + provenance.length + ' illustrations; curricula:',
  Object.fromEntries(Object.entries(profiles).map(([u, w]) => [u, w.length])),
);
