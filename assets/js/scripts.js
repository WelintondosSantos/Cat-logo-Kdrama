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
    try {
      this.localStatus = JSON.parse(localStorage.getItem('userDramaStatus') || '{}');
    } catch (e) {
      console.warn('Corrupted local status, resetting.', e);
      this.localStatus = {};
    }

    try {
      this.localFavorites = JSON.parse(localStorage.getItem('favoriteDramas') || '[]');
    } catch (e) {
      console.warn('Corrupted local favorites, resetting.', e);
      this.localFavorites = [];
    }

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

    // Load Reviews
    if (window.reviewManager) {
      window.reviewManager.loadReviews(drama.id);
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

// Gerenciador do Perfil do Usuário
class ProfileManager {
  constructor(dramas) {
    this.favContainer = document.getElementById('favoritesGrid');
    this.watchingContainer = document.getElementById('watchingGrid');
    this.planContainer = document.getElementById('planGrid');
    this.completedContainer = document.getElementById('completedGrid');
    this.droppedContainer = document.getElementById('droppedGrid');

    this.dramas = dramas || [];
    this.init();
  }

  async init() {
    console.log("ProfileManager init...", this.dramas.length, "dramas");

    // Setup listener first in case auth happens immediately after check
    const authHandler = async (e) => {
      if (e.detail.user) {
        console.log("Auth event detected, loading profile...");
        await this.loadAndRender();
      } else {
        console.log("Auth logout detected");
        window.location.href = 'index.html';
      }
    };
    document.addEventListener('auth:stateChanged', authHandler);

    // Initial check
    if (AuthManager.user) {
      console.log("User already logged in, loading...");
      await this.loadAndRender();
    } else {
      console.log("Waiting for auth...");
      // Fallback timeout
      setTimeout(() => {
        const favGrid = document.getElementById('favoritesGrid');
        if (!AuthManager.user && favGrid && favGrid.innerHTML.includes('spinner')) {
          console.warn("Auth timeout");
          favGrid.innerHTML = `
            <div class="alert alert-warning">
                Tempo de carregamento excedido. <a href="index.html" class="alert-link">Tente fazer login novamente</a> ou verifique sua conexão.
            </div>
          `;
          // Clear other spinners
          ['watchingGrid', 'planGrid', 'completedGrid', 'droppedGrid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
          });
        }
      }, 8000); // 8 seconds timeout
    }
  }

  async loadAndRender() {
    try {
      await UserDataManager.loadData();
      this.renderProfile();
    } catch (e) {
      console.error("Profile render error:", e);
      this.favContainer.innerHTML = '<p class="text-danger">Erro ao carregar dados.</p>';
    }
  }

  renderProfile() {
    console.log("Rendering profile...");

    // Favorites
    const favorites = this.dramas.filter(d => UserDataManager.isFavorite(d));
    this.renderSection(this.favContainer, favorites, 'Nenhum favorito ainda.');

    // Status Sections
    this.renderStatusSection(this.watchingContainer, 'Assistindo');
    this.renderStatusSection(this.planContainer, 'Assistir em breve');
    this.renderStatusSection(this.completedContainer, 'Assistidos');
    this.renderStatusSection(this.droppedContainer, 'Terminar de assistir');
  }

  renderStatusSection(container, status) {
    if (!container) return;
    const items = this.dramas.filter(d => UserDataManager.getStatus(d) === status);
    this.renderSection(container, items, `Nenhum drama em "${status}".`);
  }

  renderSection(container, items, emptyMsg) {
    if (!container) return;
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = `<p class="text-muted fst-italic">${emptyMsg}</p>`;
      return;
    }

    items.forEach(drama => {
      const card = this.createCard(drama);
      container.appendChild(card);
    });
  }

  createCard(drama) {
    const card = document.createElement('div');
    card.className = 'drama-card'; // Reuse CSS

    const isFav = UserDataManager.isFavorite(drama);
    const userStatus = UserDataManager.getStatus(drama);

    const img = new Image();
    img.src = getDramaImage(drama.image);
    img.className = 'drama-img';
    img.loading = 'lazy';
    img.onerror = () => img.src = CONFIG.defaultImage;

    const favBtn = document.createElement('button');
    favBtn.className = `favorite-btn ${isFav ? 'active' : ''}`;
    favBtn.innerHTML = isFav ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
    favBtn.onclick = async (e) => {
      e.stopPropagation();
      const newFav = await UserDataManager.toggleFavorite(drama);
      favBtn.classList.toggle('active');
      favBtn.innerHTML = newFav ? '<i class="bi bi-heart-fill"></i>' : '<i class="bi bi-heart"></i>';
    };

    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge bg-primary position-absolute top-0 end-0 m-2';
    statusBadge.textContent = userStatus || '';

    card.innerHTML = `
        <div class="d-flex flex-column align-items-center">
          <h5 class="drama-title">${drama.title}</h5>
        </div>
      `;

    card.querySelector('div').prepend(img);
    card.appendChild(favBtn);
    if (userStatus) card.appendChild(statusBadge);

    card.addEventListener('click', () => {
      if (window.dramaManager) {
        window.dramaManager.openDetailsModal(drama);
      }
    });

    return card;
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
    if (!this.toggleBtn) {
      console.warn('Theme toggle button not found. ThemeManager will run in headless mode.');
    }
    this.icon = this.toggleBtn;
    this.theme = localStorage.getItem('theme') || 'light';
    this.init();
  }

  init() {
    this.applyTheme(this.theme);
    if (this.toggleBtn) {
      this.toggleBtn.addEventListener('click', () => this.toggleTheme());
    }
  }

  applyTheme(theme) {
    document.documentElement.setAttribute('data-bs-theme', theme);
    if (this.toggleBtn) {
      this.toggleBtn.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    localStorage.setItem('theme', theme);
    this.theme = theme;
  }

  toggleTheme() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.applyTheme(newTheme);
  }
}

// Gerenciador de Avaliações
class ReviewManager {
  constructor() {
    this.currentDramaId = null;
    this.reviewsList = document.getElementById('reviewsList');
    this.reviewForm = document.getElementById('reviewForm');
    this.userReviewFormContainer = document.getElementById('userReviewForm');

    this.setupListeners();
  }

  setupListeners() {
    if (this.reviewForm) {
      this.reviewForm.addEventListener('submit', (e) => this.handleSubmit(e));
    }
  }

  async loadReviews(dramaId) {
    this.currentDramaId = dramaId;
    this.reviewsList.innerHTML = '<div class="spinner-border spinner-border-sm text-primary" role="status"></div>';

    // Check if user is logged in to show form
    if (AuthManager && AuthManager.user) {
      this.userReviewFormContainer.classList.remove('d-none');
    } else {
      this.userReviewFormContainer.classList.add('d-none');
    }

    try {
      const { data: reviews, error } = await window.supabaseClient
        .from('reviews')
        .select(`
            id,
            rating,
            comment,
            created_at,
            user_id
        `) // Note: In a real app we would join with specific user profile table for names
        .eq('drama_id', dramaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      this.renderReviews(reviews);

    } catch (error) {
      console.error('Error loading reviews:', error);
      this.reviewsList.innerHTML = '<p class="text-danger small">Erro ao carregar avaliações.</p>';
    }
  }

  renderReviews(reviews) {
    this.reviewsList.innerHTML = '';

    if (!reviews || reviews.length === 0) {
      this.reviewsList.innerHTML = '<p class="text-muted small">Nenhuma avaliação ainda. Seja o primeiro a avaliar!</p>';
      return;
    }

    const startHtml = (rating) => {
      let stars = '';
      for (let i = 1; i <= 5; i++) {
        stars += i <= rating ? '<i class="bi bi-star-fill text-warning"></i>' : '<i class="bi bi-star text-secondary"></i>';
      }
      return stars;
    };

    reviews.forEach(review => {
      // Mask user ID for privacy since we don't have public profiles yet
      const displayUser = review.user_id === (AuthManager.user?.id) ? 'Você' : 'Usuário';

      const item = document.createElement('div');
      item.className = 'border-bottom pb-2';
      item.innerHTML = `
            <div class="d-flex justify-content-between align-items-start">
                <div>
                    <strong class="d-block small">${displayUser}</strong>
                    <div class="small">${startHtml(review.rating)}</div>
                </div>
                <small class="text-muted" style="font-size: 0.75rem;">
                    ${new Date(review.created_at).toLocaleDateString()}
                </small>
            </div>
            <p class="mb-0 small mt-1 text-break">${review.comment || ''}</p>
        `;
      this.reviewsList.appendChild(item);
    });
  }

  async handleSubmit(e) {
    e.preventDefault();
    if (!AuthManager.user || !this.currentDramaId) return;

    const rating = document.querySelector('input[name="rating"]:checked')?.value;
    const comment = document.getElementById('reviewComment').value;

    if (!rating) {
      alert('Por favor, selecione uma nota.');
      return;
    }

    try {
      const submitBtn = this.reviewForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      const { error } = await window.supabaseClient
        .from('reviews')
        .insert({
          user_id: AuthManager.user.id,
          drama_id: this.currentDramaId,
          rating: parseInt(rating),
          comment: comment
        });

      if (error) throw error;

      // Reset form
      this.reviewForm.reset();

      // Reload reviews
      await this.loadReviews(this.currentDramaId);

    } catch (error) {
      console.error('Error submitting review:', error);
      alert('Erro ao enviar avaliação: ' + error.message);
    } finally {
      const submitBtn = this.reviewForm.querySelector('button[type="submit"]');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Enviar';
    }
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
      window.dramaManager = dramaManager; // Expose for Profile usage
      window.reviewManager = new ReviewManager(); // Initialize Review Manager
      new ActorsManager('#atoresCarousel');

      // Initialize Profile if element exists
      if (document.getElementById('favoritesGrid')) {
        new ProfileManager(dramas);
      }

      // Listen for Auth Changes to reload data
      document.addEventListener('auth:stateChanged', async () => {
        await UserDataManager.loadData();
        dramaManager.currentPage = 1;
        dramaManager.updateFilters();
      });
    }
  } catch (error) {
    console.error("Erro ao carregar os dramas do Supabase:", error);

    const errorMsg = `
      <div class="alert alert-danger mx-3 my-3" role="alert">
        <h4 class="alert-heading">Erro de Carregamento</h4>
        <p>Ocorreu um problema ao carregar os dados. Tente recarregar a página.</p>
        <hr>
        <p class="mb-0 small">Detalhes técnicos: ${error.message}</p>
        ${error.message.includes('supa') ? '<p class="small mt-1">Verifique as credenciais do Supabase ou sua conexão.</p>' : ''}
      </div>
    `;

    // Show error in dramaGrid checking if it's the main container
    const dramaGrid = document.getElementById('dramaGrid');
    if (dramaGrid) {
      dramaGrid.innerHTML = errorMsg;
      if (dramaGrid.classList.contains('d-none')) {
        // We are likely on profile page or grid is hidden.
        // Try to find profile containers to show error
        const favGrid = document.getElementById('favoritesGrid');
        if (favGrid) {
          favGrid.innerHTML = errorMsg;
          // Also clear other spinners
          ['watchingGrid', 'planGrid', 'completedGrid', 'droppedGrid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = '';
          });
        } else {
          // If grid is hidden and no favGrid, force show grid to show error?
          dramaGrid.classList.remove('d-none');
        }
      }
    } else {
      // Fallback for pages without dramaGrid
      document.body.insertAdjacentHTML('afterbegin', errorMsg);
    }
  }
}

// Inicia a aplicação
initApp();
