const fs = require('fs');

// Nolasa XML failu
const xmlData = fs.readFileSync('xml.xml', 'utf8');

// Funkcija, lai izņemtu tekstu no CDATA
function extractCDATA(text) {
  if (!text) return '';
  const cdataMatch = text.match(/<!\[CDATA\[(.*?)\]\]>/s);
  return cdataMatch ? cdataMatch[1].trim() : text.trim();
}

// Funkcija, lai iegūtu tekstu starp XML tagiem
function getTagContent(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 's');
  const match = xml.match(regex);
  return match ? extractCDATA(match[1]) : '';
}

// Funkcija, lai iegūtu visus elementus pēc taga nosaukuma
function getAllTags(xml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>(.*?)<\/${tagName}>`, 'gs');
  const matches = [];
  let match;
  while ((match = regex.exec(xml)) !== null) {
    matches.push(extractCDATA(match[1]));
  }
  return matches;
}

// Funkcija, lai iegūtu atribūtu vērtību
function getAttributeValue(tag, attrName) {
  const regex = new RegExp(`${attrName}="([^"]*)"`, 'i');
  const match = tag.match(regex);
  return match ? match[1] : '';
}

// Izvelk kanāla informāciju
const channelMatch = xmlData.match(/<channel>(.*?)<\/channel>/s);
const channelXml = channelMatch ? channelMatch[1] : '';

const simplified = {
  channel: {
    title: getTagContent(channelXml, 'title'),
    link: getTagContent(channelXml, 'link'),
    description: getTagContent(channelXml, 'description'),
    lastBuildDate: getTagContent(channelXml, 'lastBuildDate'),
    language: getTagContent(channelXml, 'language')
  },
  items: []
};

// Izvelk visus <item> elementus
const itemRegex = /<item>(.*?)<\/item>/gs;
let itemMatch;

while ((itemMatch = itemRegex.exec(channelXml)) !== null) {
  const itemXml = itemMatch[1];
  
  // Iegūst enclosure URL
  const enclosureMatch = itemXml.match(/<enclosure[^>]*\/>/);
  const imageUrl = enclosureMatch ? getAttributeValue(enclosureMatch[0], 'url') : '';
  
  // Iegūst visas kategorijas
  const categories = getAllTags(itemXml, 'category');
  
  simplified.items.push({
    title: getTagContent(itemXml, 'title'),
    link: getTagContent(itemXml, 'link'),
    guid: getTagContent(itemXml, 'guid'),
    pubDate: getTagContent(itemXml, 'pubDate'),
    description: getTagContent(itemXml, 'description'),
    content: getTagContent(itemXml, 'content:encoded'),
    categories: categories,
    image: imageUrl
  });
}

// Saglabā JSON failā
fs.writeFileSync('output.json', JSON.stringify(simplified, null, 2), 'utf8');
console.log('XML veiksmīgi pārveidots par JSON!');
console.log(`Kopējais ierakstu skaits: ${simplified.items.length}`);