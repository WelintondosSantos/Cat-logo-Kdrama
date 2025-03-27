const CONFIG = {
    basePath: 'img/',
    imageExtension: '.jpg',
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
      const genres = new Set(this.dramas.flatMap(drama => drama.genres));
      // Adiciona as opções de status
      ['Assistidos', 'Assistindo', 'Assistir em breve', 'Terminar de assistir',].forEach(status => genres.add(status));
      return ['Todos', ...[...genres].sort()];
    }
  
    createGenreFilter() {
      const filterContainer = document.createElement('div');
      filterContainer.className = 'genre-filter mb-4';
  
      filterContainer.innerHTML = `
        <div class="btn-group" role="group">
          ${this.getAllFilters().map(filter => `
            <button type="button" class="btn btn-outline-primary ${this.currentFilter === filter ? 'active' : ''}"
                    data-genre="${filter}" aria-label="Filtrar por ${filter}">
              ${filter}
            </button>
          `).join('')}
        </div>
      `;
  
      filterContainer.addEventListener('click', (e) => {
        if (e.target.matches('button')) {
          this.currentFilter = e.target.dataset.genre;
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
  
    // Filtra os dramas de acordo com o filtro (gênero ou status) e a busca
    filterDramas() {
      return this.dramas.filter(drama => {
        let matchesFilter;
        if (this.currentFilter === 'Todos') {
          matchesFilter = true;
        } else if (['Assistidos', 'Assistindo', 'Assistir em breve','Terminar de assistir'].includes(this.currentFilter)) {
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
  
      const img = new Image();
      img.src = getDramaImage(drama.image);
      img.className = 'drama-img';
      img.alt = `Capa do drama ${drama.title}`;
      img.loading = 'lazy';
      img.onerror = () => img.src = CONFIG.defaultImage;
  
      card.innerHTML = `
        <div class="d-flex flex-column align-items-center">
          <h5 class="drama-title">${drama.title}</h5>
          <div class="drama-genres">
            ${drama.genres.map(g => `<span class="badge bg-secondary">${g}</span>`).join('')}
          </div>
        </div>
      `;
  
      // Insere a imagem antes do conteúdo textual
      card.querySelector('div').prepend(img);
      return card;
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
  
  // Carrega os dados do arquivo JSON e inicializa o DramaManager
  fetch('dramas.json')
    .then(response => response.json())
    .then(data => {
      new DramaManager('dramaGrid', data);
    })
    .catch(error => console.error("Erro ao carregar os dramas:", error));
  
