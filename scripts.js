const CONFIG = {
  basePath: 'img/',
  imageExtension: '.webp',
  defaultImage: 'src/img/placeholder.jpg'
};

// Função auxiliar para gerar o caminho completo da imagem
function getDramaImage(imageName) {
  return `${CONFIG.basePath}${imageName}${CONFIG.imageExtension}`;
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

  // Retorna um array com os filtros disponíveis (gêneros + status)
  getAllFilters() {
    // Extrai os gêneros dos dramas
    // Extrai os gêneros dos dramas e normaliza (Primeira letra maiúscula)
    const genres = new Set(this.dramas.flatMap(drama =>
      drama.genres.map(g => g.charAt(0).toUpperCase() + g.slice(1).toLowerCase())
    ));
    // Adiciona as opções de status
    ['Assistidos', 'Assistindo', 'Assistir em breve', 'Terminar de assistir',].forEach(status => genres.add(status));

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
  isFavorite(title) {
    const favorites = JSON.parse(localStorage.getItem('favoriteDramas') || '[]');
    return favorites.includes(title);
  }

  // Toggle favorite status
  toggleFavorite(title, btn) {
    let favorites = JSON.parse(localStorage.getItem('favoriteDramas') || '[]');
    if (favorites.includes(title)) {
      favorites = favorites.filter(t => t !== title);
      btn.classList.remove('active');
      btn.innerHTML = '<i class="bi bi-heart"></i>';
    } else {
      favorites.push(title);
      btn.classList.add('active');
      btn.innerHTML = '<i class="bi bi-heart-fill"></i>';
    }
    localStorage.setItem('favoriteDramas', JSON.stringify(favorites));

    // If currently viewing favorites, refresh the list to remove un-favorited item
    if (this.currentFilter === 'Meus Favoritos') {
      this.updateFilters();
    }
  }

  // Filtra os dramas de acordo com o filtro (gênero ou status) e a busca
  filterDramas() {
    return this.dramas.filter(drama => {
      let matchesFilter;
      if (this.currentFilter === 'Todos') {
        matchesFilter = true;
      } else if (this.currentFilter === 'Meus Favoritos') {
        matchesFilter = this.isFavorite(drama.title);
      } else if (['Assistidos', 'Assistindo', 'Assistir em breve', 'Terminar de assistir'].includes(this.currentFilter)) {
        matchesFilter = drama.status === this.currentFilter;
      } else {
        matchesFilter = drama.genres.includes(this.currentFilter);
      }
      const matchesSearch = drama.title.toLowerCase().includes(this.searchTerm);
      return matchesFilter && matchesSearch;
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
      e.stopPropagation(); // Prevent triggering card click if we add one later
      this.toggleFavorite(drama.title, favBtn);
    };

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

    // Status Badge
    const statusBadge = document.createElement('span');
    statusBadge.className = 'badge bg-primary';
    statusBadge.textContent = drama.status;
    tagsContainer.appendChild(statusBadge);

    // Details with Fallback
    document.getElementById('modalSynopsis').textContent = drama.sinopse || "Sinopse não disponível para este título.";
    document.getElementById('modalYear').textContent = drama.ano || "-";
    document.getElementById('modalEpisodes').textContent = drama.episodios ? `${drama.episodios} eps` : "-";

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
      const response = await fetch('atores.json');
      const actors = await response.json();
      this.renderActors(actors);
    } catch (error) {
      console.error("Erro ao carregar atores:", error);
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
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
          <img src="${actor.image}" class="card-img-top" alt="${actor.name}" loading="lazy">
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

// Carrega os dados do arquivo JSON e inicializa o DramaManager
fetch('dramas.json')
  .then(response => response.json())
  .then(data => {
    new DramaManager('dramaGrid', data);
    new ActorsManager('#atoresCarousel');
    new ThemeManager();
  })
  .catch(error => console.error("Erro ao carregar os dramas:", error));
