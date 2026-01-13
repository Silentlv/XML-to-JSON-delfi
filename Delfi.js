const fs = require('fs');

// Nolasa XML failu
const xmlData = fs.readFileSync('xml.xml', 'utf8');

// Sadala pa rindām
const lines = xmlData.split('\n');

// Izņem CDATA
function extractCDATA(text) {
  if (!text) return '';
  return text
    .replace('<![CDATA[', '')
    .replace(']]>', '')
    .trim();
}

const result = {
  channel: {},
  items: []
};

let currentItem = null;
let insideChannel = false;
let insideItem = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();

  // ----- CHANNEL -----
  if (line.startsWith('<channel>')) {
    insideChannel = true;
    continue;
  }

  if (line.startsWith('</channel>')) {
    insideChannel = false;
    continue;
  }

  if (insideChannel && !insideItem) {
    if (line.startsWith('<title>')) {
      result.channel.title = extractCDATA(line.replace(/<\/?title>/g, ''));
    }
    if (line.startsWith('<link>')) {
      result.channel.link = extractCDATA(line.replace(/<\/?link>/g, ''));
    }
    if (line.startsWith('<description>')) {
      result.channel.description = extractCDATA(line.replace(/<\/?description>/g, ''));
    }
    if (line.startsWith('<language>')) {
      result.channel.language = extractCDATA(line.replace(/<\/?language>/g, ''));
    }
    if (line.startsWith('<lastBuildDate>')) {
      result.channel.lastBuildDate = extractCDATA(line.replace(/<\/?lastBuildDate>/g, ''));
    }
  }

  // ----- ITEM START -----
  if (line.startsWith('<item>')) {
    insideItem = true;
    currentItem = {
      categories: []
    };
    continue;
  }

  // ----- ITEM END -----
  if (line.startsWith('</item>')) {
    insideItem = false;
    result.items.push(currentItem);
    currentItem = null;
    continue;
  }

  // ----- ITEM CONTENT -----
  if (insideItem) {
    if (line.startsWith('<title>')) {
      currentItem.title = extractCDATA(line.replace(/<\/?title>/g, ''));
    }

    if (line.startsWith('<link>')) {
      currentItem.link = extractCDATA(line.replace(/<\/?link>/g, ''));
    }

    if (line.startsWith('<guid>')) {
      currentItem.guid = extractCDATA(line.replace(/<\/?guid>/g, ''));
    }

    if (line.startsWith('<pubDate>')) {
      currentItem.pubDate = extractCDATA(line.replace(/<\/?pubDate>/g, ''));
    }

    if (line.startsWith('<category>')) {
      currentItem.categories.push(
        extractCDATA(line.replace(/<\/?category>/g, ''))
      );
    }

    if (line.startsWith('<description>')) {
      currentItem.description = extractCDATA(
        line.replace(/<\/?description>/g, '')
      );
    }

    // enclosure image
    if (line.includes('<enclosure')) {
      const urlMatch = line.match(/url="([^"]+)"/);
      if (urlMatch) {
        currentItem.image = urlMatch[1];
      }
    }
  }
}

// Saglabā JSON
fs.writeFileSync(
  'output.json',
  JSON.stringify(result, null, 2),
  'utf8'
);

console.log('XML veiksmīgi pārveidots par JSON!');
console.log(`Kopējais ierakstu skaits: ${result.items.length}`);
