let currentSource = 'delfi';
let allNews = [];

// Ielādē ziņas
async function loadNews(source) {
  const container = document.getElementById('newsContainer');
  const status = document.getElementById('status');
  
  container.innerHTML = '<div class="loading">Ielādē ziņas...</div>';
  status.textContent = '';

  try {
    const response = await fetch(`http://localhost:3000/news/${source}`);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error);
    }

    allNews = data.items;
    
    status.textContent = `${data.cached ? '💾 No cache' : '🔄 Jaunākie dati'} • ${allNews.length} ziņas`;
    status.className = `status ${data.cached ? 'cached' : ''}`;
    
    displayNews(allNews);
  } catch (error) {
    container.innerHTML = `<div class="error">Kļūda: ${error.message}</div>`;
    status.textContent = '';
  }
}

// Attēlo ziņas
function displayNews(news) {
  const container = document.getElementById('newsContainer');
  
  if (news.length === 0) {
    container.innerHTML = '<div class="no-results">Nav atrasta neviena ziņa</div>';
    return;
  }

  container.innerHTML = `
    <div class="news-grid">
      ${news.map(item => `
        <div class="news-card" onclick="window.open('${item.link}', '_blank')">
          ${item.image ? `<img src="${item.image}" alt="${item.title}" class="news-image" onerror="this.style.display='none'">` : ''}
          <div class="news-content">
            <h2 class="news-title">${item.title}</h2>
            <p class="news-description">${item.description || ''}</p>
            <div class="news-meta">
              <span class="news-date">${formatDate(item.pubDate)}</span>
            </div>
            ${item.categories && item.categories.length > 0 ? `
              <div class="categories">
                ${item.categories.slice(0, 3).map(cat => `<span class="category">${cat}</span>`).join('')}
              </div>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Formatē datumu
function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  
  if (hours < 1) return 'Pirms brīža';
  if (hours < 24) return `Pirms ${hours}h`;
  
  return date.toLocaleDateString('lv-LV', { 
    day: 'numeric', 
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Meklēšana
document.getElementById('searchInput').addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  
  if (!query) {
    displayNews(allNews);
    return;
  }

  const filtered = allNews.filter(item => 
    item.title.toLowerCase().includes(query) ||
    (item.description && item.description.toLowerCase().includes(query))
  );
  
  displayNews(filtered);
});

// Tab pārslēgšana
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    
    currentSource = tab.dataset.source;
    document.getElementById('searchInput').value = '';
    loadNews(currentSource);
  });
});

// Sākotnējā ielāde
loadNews(currentSource);