'use strict';
const vocabulary=[
  {
    "word": "ate",
    "meaning": "食べた",
    "group": "verb",
    "base": "eat",
    "example": "I ate breakfast."
  },
  {
    "word": "enjoyed",
    "meaning": "楽しんだ",
    "group": "verb",
    "base": "enjoy",
    "example": "I enjoyed the movie."
  },
  {
    "word": "watched",
    "meaning": "（テレビやスポーツを）見た",
    "group": "verb",
    "base": "watch",
    "example": "I watched TV."
  },
  {
    "word": "bought",
    "meaning": "買った",
    "group": "verb",
    "base": "buy",
    "example": "I bought a book."
  },
  {
    "word": "played",
    "meaning": "（スポーツを）した／（楽器を）演奏した",
    "group": "verb",
    "base": "play",
    "example": "I played soccer."
  },
  {
    "word": "made",
    "meaning": "作った",
    "group": "verb",
    "base": "make",
    "example": "I made a cake."
  },
  {
    "word": "read",
    "meaning": "読んだ",
    "group": "verb",
    "base": "read",
    "example": "I read a book yesterday."
  },
  {
    "word": "smart",
    "meaning": "賢い",
    "group": "adjective",
    "base": null,
    "example": "She is smart."
  },
  {
    "word": "kind",
    "meaning": "親切な",
    "group": "adjective",
    "base": null,
    "example": "He is kind."
  },
  {
    "word": "funny",
    "meaning": "おもしろい",
    "group": "adjective",
    "base": null,
    "example": "He is funny."
  },
  {
    "word": "gentle",
    "meaning": "優しい",
    "group": "adjective",
    "base": null,
    "example": "She is gentle."
  },
  {
    "word": "creative",
    "meaning": "創造的な",
    "group": "adjective",
    "base": null,
    "example": "He is creative."
  },
  {
    "word": "famous",
    "meaning": "有名な",
    "group": "adjective",
    "base": null,
    "example": "She is famous."
  },
  {
    "word": "popular",
    "meaning": "人気のある",
    "group": "adjective",
    "base": null,
    "example": "He is popular."
  },
  {
    "word": "cool",
    "meaning": "かっこいい",
    "group": "adjective",
    "base": null,
    "example": "He is cool."
  },
  {
    "word": "created",
    "meaning": "創作した",
    "group": "verb",
    "base": "create",
    "example": "She created a character."
  },
  {
    "word": "wrote",
    "meaning": "書いた",
    "group": "verb",
    "base": "write",
    "example": "I wrote a letter."
  },
  {
    "word": "saved",
    "meaning": "救った",
    "group": "verb",
    "base": "save",
    "example": "He saved a cat."
  },
  {
    "word": "won",
    "meaning": "勝った",
    "group": "verb",
    "base": "win",
    "example": "We won the game."
  },
  {
    "word": "saved many people",
    "meaning": "たくさんの人々を救った",
    "group": "phrase",
    "base": "",
    "example": "My hero saved many people."
  },
  {
    "word": "wrote many books",
    "meaning": "たくさんの本を書いた",
    "group": "phrase",
    "base": "",
    "example": "My hero wrote many books."
  },
  {
    "word": "made beautiful dresses",
    "meaning": "美しいドレスを作った",
    "group": "phrase",
    "base": "",
    "example": "My hero made beautiful dresses."
  },
  {
    "word": "created popular movies",
    "meaning": "人気のある映画を作った",
    "group": "phrase",
    "base": "",
    "example": "My hero created popular movies."
  },
  {
    "word": "won the Nobel Prize",
    "meaning": "ノーベル賞を取った",
    "group": "phrase",
    "base": "",
    "example": "My hero won the Nobel Prize."
  },
  {
    "word": "created many songs",
    "meaning": "たくさんの歌を作った",
    "group": "phrase",
    "base": "",
    "example": "My hero created many songs."
  },
  {
    "word": "got a gold medal",
    "meaning": "金メダルを取った",
    "group": "phrase",
    "base": "",
    "example": "My hero got a gold medal."
  },
  {
    "word": "made many records",
    "meaning": "たくさんの記録を作った",
    "group": "phrase",
    "base": "",
    "example": "My hero made many records."
  },
  {
    "word": "performed in TV dramas",
    "meaning": "テレビドラマで演じた",
    "group": "phrase",
    "base": "",
    "example": "My hero performed in TV dramas."
  }
];
const builtinVocabulary=structuredClone(vocabulary);
function shuffleWords(items){const result=[...items];for(let i=result.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[result[i],result[j]]=[result[j],result[i]]}return result}
function createSpellingLetters(word){const alphabet='abcdefghijklmnopqrstuvwxyz';return shuffleWords([...spellingCharacters(word),...Array.from({length:3},()=>alphabet[Math.floor(Math.random()*alphabet.length)])])}
function spellingAnswer(letters,selected,pattern){const typed=selected.map(index=>letters[index]).join('');return pattern?formatSpellingAnswer(pattern,typed):typed}
function createVocabularyLesson(practiceMode=null){const modes=practiceMode?[practiceMode]:['text','voice','spelling'];return{queue:modes.flatMap(mode=>shuffleWords(vocabulary).map(v=>({word:v.word,mode}))),completed:0,attempts:0,missed:[],lastCorrect:false,total:vocabulary.length*modes.length,practiceMode}}
function advanceVocabularyLesson(lesson,correct){const task=lesson.queue.shift();if(!task)return;lesson.attempts++;if(correct)lesson.completed++;else{if(!lesson.missed.includes(task.word))lesson.missed.push(task.word);lesson.queue.splice(Math.min(3,lesson.queue.length),0,task)}}
