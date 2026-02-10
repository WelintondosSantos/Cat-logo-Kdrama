const CONFIG = {
  basePath: 'assets/img/',
  imageExtension: '.webp',
  defaultImage: 'assets/img/placeholder.jpg'
};

// Função auxiliar para gerar o caminho completo da imagem
function getDramaImage(imageName) {
  return `${CONFIG.basePath}${imageName}${CONFIG.imageExtension}`;
}

// Gerenciador de Dados do Usuário (Cloud + LocalStorage)
class UserDataManager {
  static async loadData() {
    this.localStatus = JSON.parse(localStorage.getItem('userDramaStatus') || '{}');
    this.localFavorites = JSON.parse(localStorage.getItem('favoriteDramas') || '[]');
    this.cloudData = {}; // Map: dramaId -> { status, is_favorite }

    if (AuthManager && AuthManager.user) {
      await this.syncWithCloud();
    }
  }

  static async syncWithCloud() {
    // Fetch all user data from Supabase
    const { data, error } = await window.supabaseClient
      .from('user_library')
      .select('drama_id, status, is_favorite');

    if (error) {
      console.error('Error fetching user library:', error);
      return;
    }

    this.cloudData = {};
    if (data) {
      data.forEach(item => {
        this.cloudData[item.drama_id] = {
          status: item.status,
          is_favorite: item.is_favorite
        };
      });
    }
  }

  static getStatus(drama) {
    if (AuthManager && AuthManager.user) {
      const item = this.cloudData[drama.id];
      return item ? item.status : null;
    }
    return this.localStatus[drama.title] || null;
  }

  static isFavorite(drama) {
    if (AuthManager && AuthManager.user) {
      const item = this.cloudData[drama.id];
      return item ? item.is_favorite : false;
    }
    return this.localFavorites.includes(drama.title);
  }

  static async setStatus(drama, status) {
    if (AuthManager && AuthManager.user) {
      // Cloud Save
      // Optimistic update
      if (!this.cloudData[drama.id]) this.cloudData[drama.id] = {};
      this.cloudData[drama.id].status = status;

      const { error } = await window.supabaseClient
        .from('user_library')
        .upsert({
          user_id: AuthManager.user.id,
          drama_id: drama.id,
          status: status
        }, { onConflict: 'user_id, drama_id' }); // Upsert handles insert/update

      if (error) console.error("Cloud save error:", error);

    } else {
      // Local Save
      if (status) {
        this.localStatus[drama.title] = status;
      } else {
        delete this.localStatus[drama.title];
      }
      localStorage.setItem('userDramaStatus', JSON.stringify(this.localStatus));
    }
  }

  static async toggleFavorite(drama) {
    if (AuthManager && AuthManager.user) {
      // Cloud Toggle
      const currentFav = this.isFavorite(drama);
      const newFav = !currentFav;

      // Optimistic Update
      if (!this.cloudData[drama.id]) this.cloudData[drama.id] = {};
      this.cloudData[drama.id].is_favorite = newFav;

      const { error } = await window.supabaseClient
        .from('user_library')
        .upsert({
          user_id: AuthManager.user.id,
          drama_id: drama.id,
          is_favorite: newFav
        }, { onConflict: 'user_id, drama_id' });

      if (error) console.error("Cloud fav error:", error);
      return newFav;

    } else {
      // Local Toggle
      if (this.localFavorites.includes(drama.title)) {
        this.localFavorites = this.localFavorites.filter(t => t !== drama.title);
        localStorage.setItem('favoriteDramas', JSON.stringify(this.localFavorites));
        return false;
      } else {
        this.localFavorites.push(drama.title);
        localStorage.setItem('favoriteDramas', JSON.stringify(this.localFavorites));
        return true;
      }
    }
  }
}


class DramaManager {
  constructor(containerId, dramas) {
    this.container = document.getElementById(containerId);
    this.searchInput = document.getElementById('searchInput');
    this.currentFilter = 'Todos';
    this.searchTerm = '';
    this.dramas = dramas;

    // Variáveis para paginação
    this.currentPage = 1;
    this.itemsPerPage = 20;

    this.init();
  }

  // Retorna um array com os filtros disponíveis (apenas gêneros)
  getAllFilters() {
    // Extrai os gêneros dos dramas e normaliza (Primeira letra maiúscula)
    const genres = new Set(this.dramas.flatMap(drama =>
      drama.genres.map(g => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase())
    ));

    // Convert Set to Array and Sort
    const sortedGenres = [...genres].sort();

    // Add Special Filters
    return ['Todos', 'Meus Favoritos', ...sortedGenres];
  }

  createGenreFilter() {
    const filterContainer = document.createElement('div');
    // Using new scroll container class
    filterContainer.className = 'filter-scroll-container';

    // No inner btn-group div needed for this layout, buttons are direct children
    filterContainer.innerHTML = this.getAllFilters().map(filter => {
      const isFavorite = filter === 'Meus Favoritos';
      const isActive = this.currentFilter === filter;

      // Icon for favorites
      const icon = isFavorite ? '<i class="bi bi-heart-fill me-1"></i>' : '';

      return `
        <button type="button" class="filter-pill ${isActive ? 'active' : ''}"
                data-genre="${filter}" aria-label="Filtrar por ${filter}">
          ${icon}${filter}
        </button>
        `;
    }).join('');

    filterContainer.addEventListener('click', (e) => {
      // Handle icon clicks by finding closest button
      const btn = e.target.closest('.filter-pill');
      if (btn) {
        // Update active state in UI immediately for better feel
        const allBtns = this.container ? this.container.querySelectorAll('.filter-pill') : document.querySelectorAll('.filter-pill');
        allBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.currentFilter = btn.dataset.genre;
        this.currentPage = 1; // Reinicia a página ao alterar o filtro
        this.updateFilters();
      }
    });

    return filterContainer;
  }

  setupSearch() {
    const searchHandler = (e) => {
      e.preventDefault();
      this.searchTerm = this.searchInput.value.toLowerCase().trim();
      this.currentPage = 1; // Reinicia a página ao realizar uma busca
      this.updateFilters();
    };

    document.getElementById('searchForm').addEventListener('submit', searchHandler);
    this.searchInput.addEventListener('input', searchHandler);
  }

  // Helper to check if a drama is favorite
  isFavorite(dramaTitle) {
    // Find drama object by title to pass to UserDataManager (since it needs ID for cloud)
    const drama = this.dramas.find(d => d.title === dramaTitle);
    return drama ? UserDataManager.isFavorite(drama) : false;
  }

  // Toggle favorite status
  async toggleFavorite(dramaTitle, btn) { // Made async
    const drama = this.dramas.find(d => d.title === dramaTitle);
    if (!drama) return;

    const isNowFav = await UserDataManager.toggleFavorite(drama);

    // Update UI
    if (isNowFav) {
      btn.classList.add('active');
      btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
    } else {
      btn.classList.remove('active');
      btn.innerHTML = '<i class="bi bi-heart"></i>';
    }

    // If currently viewing favorites, refresh the list to remove un-favorited item
    if (this.currentFilter === 'Meus Favoritos') {
      this.updateFilters();
    }
  }

  // Filtra os dramas de acordo com o filtro (gênero), status do usuário e a busca
  filterDramas() {
    return this.dramas.filter(drama => {
      // 1. Filter by Genre / Favorites
      let matchesGenre;
      if (this.currentFilter === 'Todos') {
        matchesGenre = true;
      } else if (this.currentFilter === 'Meus Favoritos') {
        matchesGenre = UserDataManager.isFavorite(drama);
      } else {
        matchesGenre = drama.genres.includes(this.currentFilter);
      }

      // 2. Filter by Search
      const matchesSearch = drama.title.toLowerCase().includes(this.searchTerm);

      return matchesGenre && matchesSearch;
    });
  }

  // Retorna os dramas que devem ser exibidos na página atual
  getPaginatedDramas(filteredDramas) {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    return filteredDramas.slice(startIndex, endIndex);
  }

  createDramaCard(drama) {
    const card = document.createElement('div');
    card.className = 'drama-card';

    const isFav = this.isFavorite(drama.title);
    // NOTE: getStatus is now async-compatible internally, but here strictly returns sync value from loaded cache
    // since UI render is sync.
    const userStatus = UserDataManager.getStatus(drama);

    const img = new Image();
    img.src = getDramaImage(drama.image);
    img.className = 'drama-img';
    img.alt = `Capa do drama ${drama.title}`;
    img.loading = 'lazy';
    img.onerror = () => img.src = CONFIG.defaultImage;

    // Favorite Button
    const favBtn = document.createElement('button');
    favBtn.className = `favorite-btn ${isFav ? 'active' : ''}`;
    favBtn.innerHTML = isFav ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
    favBtn.onclick = (e) => {
      e.stopPropagation(); // Prevent triggering card click
      this.toggleFavorite(drama.title, favBtn);
    };

    // Status Badge/Dropdown
    const statusContainer = document.createElement('div');
    statusContainer.className = 'status-wrapper';
    statusContainer.innerHTML = `
      <div class="dropdown">
        <button class="btn btn-sm btn-light dropdown-toggle status-btn" type="button" data-bs-toggle="dropdown" aria-expanded="false" onclick="event.stopPropagation()">
          ${userStatus || 'Status'}
        </button>
        <ul class="dropdown-menu dropdown-menu-end">
          <li><a class="dropdown-item" href="#" data-status="Assistidos">Assistidos</a></li>
          <li><a class="dropdown-item" href="#" data-status="Assistindo">Assistindo</a></li>
          <li><a class="dropdown-item" href="#" data-status="Assistir em breve">Assistir em breve</a></li>
          <li><a class="dropdown-item" href="#" data-status="Terminar de assistir">Terminar de assistir</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" data-status="">Remover Status</a></li>
        </ul>
      </div>
    `;

    // Handle Status Change
    statusContainer.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', async (e) => { // Async handler
        e.preventDefault();
        e.stopPropagation();
        const newStatus = e.target.dataset.status;
        await UserDataManager.setStatus(drama, newStatus);

        // Update Button Text
        const btn = statusContainer.querySelector('.status-btn');
        btn.textContent = newStatus || 'Status';
      });
    });

    card.innerHTML = `
        <div class="d-flex flex-column align-items-center">
          <h5 class="drama-title">${drama.title}</h5>
          <div class="drama-genres">
            ${drama.genres.map(g => `<span class="badge bg-secondary">${g}</span>`).join('')}
          </div>
        </div>
      `;

    // Append Elements
    card.appendChild(favBtn);
    card.appendChild(statusContainer); // Add status dropdown
    card.querySelector('div').prepend(img);

    // Open Details Modal on click
    card.addEventListener('click', () => this.openDetailsModal(drama));

    return card;
  }

  openDetailsModal(drama) {
    // Populate Data
    document.getElementById('dramaModalLabel').textContent = drama.title;

    const poster = document.getElementById('modalPoster');
    poster.src = getDramaImage(drama.image);
    poster.alt = drama.title;
    poster.onerror = () => poster.src = CONFIG.defaultImage;

    // Genres Tags
    const tagsContainer = document.getElementById('modalTags');
    tagsContainer.innerHTML = drama.genres.map(g =>
      `<span class="badge bg-secondary">${g}</span>`
    ).join('');

    // Status Badge (User Status) moved to main details area, not tags
    // const userStatus = UserStatusManager.getStatus(drama.title);
    // const statusBadge = document.createElement('span');
    // statusBadge.className = 'badge bg-primary';
    // statusBadge.textContent = userStatus || 'Sem Status';
    // tagsContainer.appendChild(statusBadge);

    // Details with Fallback
    document.getElementById('modalSynopsis').textContent = drama.sinopse || "Sinopse não disponível para este título.";
    document.getElementById('modalYear').textContent = drama.ano || "-";
    document.getElementById('modalEpisodes').textContent = drama.episodios ? `${drama.episodios} eps` : "-";

    // User Status Dropdown in Modal
    this.renderModalStatusDropdown(drama);


    // Cast
    const castContainer = document.getElementById('modalCast');
    if (drama.elenco && drama.elenco.length > 0) {
      castContainer.innerHTML = drama.elenco.map(actor =>
        `<span class="cast-pill">${actor}</span>`
      ).join('');
    } else {
      castContainer.innerHTML = '<span class="text-muted small">Elenco não informado</span>';
    }

    // Show Modal
    const modal = new bootstrap.Modal(document.getElementById('dramaModal'));
    modal.show();
  }

  renderModalStatusDropdown(drama) {
    const container = document.getElementById('modalStatusContainer');
    if (!container) return;

    const userStatus = UserDataManager.getStatus(drama);

    container.innerHTML = `
      <div class="dropdown mt-3">
        <button class="btn btn-outline-primary dropdown-toggle w-100" type="button" data-bs-toggle="dropdown" aria-expanded="false">
          Status: <strong>${userStatus || 'Definir Status'}</strong>
        </button>
        <ul class="dropdown-menu w-100 text-center">
          <li><a class="dropdown-item" href="#" data-status="Assistidos">✔️ Assistidos</a></li>
          <li><a class="dropdown-item" href="#" data-status="Assistindo">▶️ Assistindo</a></li>
          <li><a class="dropdown-item" href="#" data-status="Assistir em breve">📅 Assistir em breve</a></li>
          <li><a class="dropdown-item" href="#" data-status="Terminar de assistir">⏸️ Terminar de assistir</a></li>
          <li><hr class="dropdown-divider"></li>
          <li><a class="dropdown-item text-danger" href="#" data-status="">🗑️ Remover Status</a></li>
        </ul>
      </div>
    `;

    container.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        e.preventDefault();
        const newStatus = e.target.dataset.status;
        await UserDataManager.setStatus(drama, newStatus);

        // Re-render dropdown to show new status
        this.renderModalStatusDropdown(drama);
      });
    });
  }

  // Renderiza os controles de paginação
  renderPagination(totalItems) {
    // Remove a paginação anterior, se existir
    const existingPagination = document.getElementById('pagination');
    if (existingPagination) {
      existingPagination.remove();
    }

    const totalPages = Math.ceil(totalItems / this.itemsPerPage);
    if (totalPages <= 1) return; // Não exibe a paginação se houver somente uma página

    const paginationContainer = document.createElement('div');
    paginationContainer.id = 'pagination';
    paginationContainer.className = 'pagination-container mt-4 d-flex justify-content-center';

    // Botão "Anterior"
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Anterior';
    prevButton.className = 'btn btn-outline-primary me-2';
    prevButton.disabled = this.currentPage === 1;
    prevButton.addEventListener('click', () => {
      if (this.currentPage > 1) {
        this.currentPage--;
        this.updateFilters();
      }
    });
    paginationContainer.appendChild(prevButton);

    // Informação da página atual
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Página ${this.currentPage} de ${totalPages}`;
    paginationContainer.appendChild(pageInfo);

    // Botão "Próximo"
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Próximo';
    nextButton.className = 'btn btn-outline-primary ms-2';
    nextButton.disabled = this.currentPage === totalPages;
    nextButton.addEventListener('click', () => {
      if (this.currentPage < totalPages) {
        this.currentPage++;
        this.updateFilters();
      }
    });
    paginationContainer.appendChild(nextButton);

    // Insere a paginação após o container de dramas
    this.container.parentNode.insertBefore(paginationContainer, this.container.nextSibling);
  }

  updateFilters() {
    const filtered = this.filterDramas();

    if (filtered.length === 0) {
      this.container.innerHTML = `
        <div class="empty-state">
          <h3>😢 Opa!</h3>
          <p>Nenhum drama encontrado para "${this.searchTerm}" no filtro "${this.currentFilter}".</p>
          <button class="btn btn-primary mt-2" onclick="document.getElementById('searchInput').value=''; document.getElementById('searchInput').dispatchEvent(new Event('input'))">
            Limpar Pesquisa
          </button>
        </div>
      `;
      // Remove pagination if empty
      const existingPagination = document.getElementById('pagination');
      if (existingPagination) existingPagination.remove();
      return;
    }

    const paginatedDramas = this.getPaginatedDramas(filtered);
    this.container.replaceChildren(...paginatedDramas.map(drama => this.createDramaCard(drama)));

    // Atualiza o estado ativo dos botões de filtro
    document.querySelectorAll('.genre-filter button').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.genre === this.currentFilter);
    });

    // Renderiza os controles de paginação
    this.renderPagination(filtered.length);
  }

  init() {
    // Insere o filtro acima do container de dramas
    this.container.parentNode.insertBefore(this.createGenreFilter(), this.container);
    this.setupSearch();
    this.updateFilters();
  }
}


// Gerenciador de Atores
class ActorsManager {
  constructor(containerId) {
    this.container = document.querySelector(containerId);
    this.carouselInner = this.container.querySelector('.carousel-inner');
    this.init();
  }

  async init() {
    try {
      // SUBSTITUIÇÃO: Fetch do Supabase em vez de arquivo JSON
      // const response = await fetch('atores.json');
      // const actors = await response.json();

      const { data: actors, error } = await window.supabaseClient
        .from('atores')
        .select('*');

      if (error) throw error;

      if (actors) {
        this.renderActors(actors);
      }
    } catch (error) {
      console.error("Erro ao carregar atores do Supabase:", error);
      // Fallback opcional ou mensagem de erro na UI
      this.carouselInner.innerHTML = '<div class="text-center p-4">Erro ao carregar atores. Verifique a conexão.</div>';
    }
  }

  renderActors(actors) {
    this.carouselInner.innerHTML = '';
    const chunkSize = 5; // Atores por slide

    for (let i = 0; i < actors.length; i += chunkSize) {
      const chunk = actors.slice(i, i + chunkSize);
      const isFirst = i === 0;

      const carouselItem = document.createElement('div');
      carouselItem.className = `carousel-item ${isFirst ? 'active' : ''}`;

      const flexContainer = document.createElement('div');
      flexContainer.className = 'd-flex flex-wrap justify-content-center align-items-stretch';

      chunk.forEach(actor => {
        // Normalize image path to handle legacy "./atores/" paths from database
        let imagePath = actor.image;
        if (imagePath.includes('./atores/') || imagePath.startsWith('atores/')) {
          imagePath = imagePath.replace(/^(\.\/)?atores\//, 'assets/img/actors/');
        }

        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${imagePath}" class="card-img-top" alt="${actor.name}" loading="lazy">
            <div class="card-body">
              <h5 class="card-title text-center">${actor.name}</h5>
            </div>
          `;
        flexContainer.appendChild(card);
      });

      carouselItem.appendChild(flexContainer);
      this.carouselInner.appendChild(carouselItem);
    }
  }
}

class ThemeManager {
  constructor() {
    this.toggleBtn = document.getElementById('themeToggle');
    this.icon = this.toggleBtn;
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    this.applyTheme(this.theme);
    this.toggleBtn.addEventListener('click', () => this.toggleTheme());
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    this.toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    localStorage.setItem('theme', theme);
    this.theme = theme;
  }

  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }
}

// Carrega os dados do Supabase e inicializa o DramaManager
async function initApp() {
  try {
    // SUBSTITUIÇÃO: Fetch do Supabase em vez de 'dramas.json'
    // fetch('dramas.json')...

    const { data: dramas, error } = await window.supabaseClient
      .from('dramas')
      .select('*')
      .order('title', { ascending: true });

    if (error) throw error;

    if (dramas) {
      new ThemeManager();
      // Load user data first!
      await UserDataManager.loadData();

      const dramaManager = new DramaManager('dramaGrid', dramas);
      new ActorsManager('#atoresCarousel');

      // Listen for Auth Changes to reload data
      document.addEventListener('auth:stateChanged', async () => {
        await UserDataManager.loadData();
        dramaManager.currentPage = 1;
        dramaManager.updateFilters();
      });
    }
  } catch (error) {
    console.error("Erro ao carregar os dramas do Supabase:", error);
    document.getElementById('dramaGrid').innerHTML = `
      <div class="alert alert-danger" role="alert">
        Erro ao carregar dados. Verifique suas credenciais do Supabase em supa-client.js
        <br>Erro: ${error.message}
      </div>
    `;
  }
}

// Inicia a aplicação
initApp();
