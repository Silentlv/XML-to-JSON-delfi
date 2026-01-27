const express = require('express');
const app = express();
const PORT = 3000;

// Funkcija CDATA ekstrakcēšanai
function extractCDATA(text) {
  if (!text) return '';
  return text
    .replace('<![CDATA[', '')
    .replace(']]>', '')
    .trim();
}

// Funkcija XML parsēšanai
function parseXML(xmlData) {
  const lines = xmlData.split('\n');
  
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
      if (line.startsWith('<category')) {
        currentItem.categories.push(
          extractCDATA(line.replace(/<category[^>]*>|<\/category>/g, ''))
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
  
  return result;
}

// API endpoint /delfi
app.get('/delfi', async (req, res) => {
  try {
    const response = await fetch('https://www.delfi.lv/rss/index.xml');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    
    const xmlData = await response.text();
    const result = parseXML(xmlData);
    
    res.json({
      success: true,
      source: 'Delfi.lv',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// API endpoint /apollo
app.get('/apollo', async (req, res) => {
  try {
    const response = await fetch('https://www.apollo.lv/rss/zinas/');
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
    
    const xmlData = await response.text();
    const result = parseXML(xmlData);
    
    res.json({
      success: true,
      source: 'Apollo.lv',
      timestamp: new Date().toISOString(),
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Saknes endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Latvijas Ziņu API',
    endpoints: [
      { path: '/delfi', description: 'Delfi.lv ziņas' },
      { path: '/apollo', description: 'Apollo.lv ziņas' }
    ]
  });
});

// Servera palaišana
app.listen(PORT, () => {
  console.log(`Server: http://localhost:${PORT}`);
});
