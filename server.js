const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const app = express();
const PORT = 3000;

// Datubāzes inicializācija
const db = new sqlite3.Database('./news.db', (err) => {
  if (err) console.error(err.message);
  else console.log('Database connected');
});

// Izveido tabulu
db.run(`CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT,
  link TEXT UNIQUE,
  guid TEXT,
  pubDate TEXT,
  description TEXT,
  image TEXT,
  categories TEXT,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.run(`CREATE TABLE IF NOT EXISTS fetch_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// RSS avotu konfigurācija
const RSS_SOURCES = {
  delfi: 'https://www.delfi.lv/rss/index.xml',
  apollo: 'https://www.apollo.lv/rss/zinas/',
  tvnet: 'https://www.tvnet.lv/rss/zinas'
};

const CACHE_DURATION = 10 * 60 * 1000; // 10 minūtes

function extractCDATA(text) {
  if (!text) return '';
  return text.replace('<![CDATA[', '').replace(']]>', '').trim();
}

function parseXML(xmlData) {
  const lines = xmlData.split('\n');
  const result = { channel: {}, items: [] };
  let currentItem = null;
  let insideChannel = false;
  let insideItem = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
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
    }
    
    if (line.startsWith('<item>')) {
      insideItem = true;
      currentItem = { categories: [] };
      continue;
    }
    
    if (line.startsWith('</item>')) {
      insideItem = false;
      result.items.push(currentItem);
      currentItem = null;
      continue;
    }
    
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
        currentItem.description = extractCDATA(line.replace(/<\/?description>/g, ''));
      }
      if (line.includes('<enclosure')) {
        const urlMatch = line.match(/url="([^"]+)"/);
        if (urlMatch) currentItem.image = urlMatch[1];
      }
    }
  }
  
  return result;
}

// Pārbauda vai vajag atjaunot datus
function needsRefresh(source) {
  return new Promise((resolve) => {
    db.get(
     `SELECT fetched_at FROM fetch_log WHERE source = ? ORDER BY fetched_at DESC LIMIT 1`,
      [source],
      (err, row) => {
        if (err || !row) {
         resolve(true);
          return;
        }
        const lastFetch = new Date(row.fetched_at).getTime();
       const now = Date.now();
        resolve(now - lastFetch > CACHE_DURATION);
      }
    );
  });
}

// Saglabā ziņas datubāzē
async function saveNews(source, items) {
  const stmt = db.prepare(`INSERT OR IGNORE INTO news 
    (source, title, link, guid, pubDate, description, image, categories) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
  
  for (const item of items) {
    stmt.run(
      source,
      item.title,
      item.link,
      item.guid,
      item.pubDate,
      item.description,
      item.image,
      JSON.stringify(item.categories)
    );
  }
  stmt.finalize();
  
  db.run(`INSERT INTO fetch_log (source) VALUES (?)`, [source]);
}

// Iegūst ziņas no datubāzes
function getNewsFromDB(source) {
  return new Promise((resolve, reject) => {
    db.all(
     `SELECT * FROM news WHERE source = ? ORDER BY fetched_at DESC LIMIT 50`,
      [source],
      (err, rows) => {
      if (err) reject(err);
        else {
         const items = rows.map(row => ({
            title: row.title,
            link: row.link,
            guid: row.guid,
        pubDate: row.pubDate,
            description: row.description,
          image: row.image,
            categories: JSON.parse(row.categories || '[]')
          }));
          resolve(items);
        }
      }
    );
  });
}

// Dinamiskais endpoint
app.get('/news/:source', async (req, res) => {
  const source = req.params.source.toLowerCase();
  const rssUrl = RSS_SOURCES[source];
  
  if (!rssUrl) {
    return res.status(404).json({
      success: false,
      error: 'Source not found',
      available: Object.keys(RSS_SOURCES)
    });
  }
  
  try {
    const refresh = await needsRefresh(source);
    
   if (refresh) {
      console.log(`Fetching fresh data for ${source}`);
      const response = await fetch(rssUrl);
     if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      
      const xmlData = await response.text();
      const result = parseXML(xmlData);
      
      await saveNews(source, result.items);
      
    res.json({
        success: true,
        source: source,
        cached: false,
        timestamp: new Date().toISOString(),
        items: result.items
      });
    } else {
      console.log(`Using cached data for ${source}`);
      const items = await getNewsFromDB(source);
      
      res.json({
        success: true,
        source: source,
        cached: true,
        timestamp: new Date().toISOString(),
        items: items
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({
    message: 'Latvijas Ziņu API',
    usage: '/news/:source',
    sources: Object.keys(RSS_SOURCES),
    cache: '10 minutes'
 });
});

app.listen(PORT, () => {
 console.log(`Server: http://localhost:${PORT}`);
});
