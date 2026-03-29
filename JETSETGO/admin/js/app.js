/**
 * JETSETGO Admin Panel - Main Application
 * FREE/OPEN SOURCE Edition
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== CONFIGURATION ====================
const SUPABASE_URL = 'https://icgtllieipahixesllux.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImljZ3RsbGllaXBhaGl4ZXNzbHV4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA3MTczNjEsImV4cCI6MjA4NjI5MzM2MX0._9U_u91RaJ3B6k5iPxI0AKUL8DZ8m5zmpi9hJQAyX1U';

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ==================== APP STATE ====================
const state = {
  currentPage: 'dashboard',
  connectionStatus: 'connecting',
  stats: {
    totalParts: 0,
    totalTires: 0,
    totalSources: 0,
    activeJobs: 0
  },
  settings: {
    groqApiKey: '',
    hfApiKey: '',
    lineAccessToken: '',
    lineChannelSecret: '',
    embeddingMode: 'transformersjs'
  }
};

// ==================== DOM ELEMENTS ====================
const elements = {
  // Navigation
  sidebar: document.getElementById('sidebar'),
  menuToggle: document.getElementById('menuToggle'),
  navItems: document.querySelectorAll('.nav-item'),
  pageTitle: document.getElementById('pageTitle'),
  connectionStatus: document.getElementById('connectionStatus'),

  // Pages
  pages: document.querySelectorAll('.page'),
  pageContainer: document.getElementById('pageContainer'),

  // Dashboard
  totalParts: document.getElementById('totalParts'),
  totalTires: document.getElementById('totalTires'),
  totalSources: document.getElementById('totalSources'),
  activeJobs: document.getElementById('activeJobs'),
  recentJobsTable: document.getElementById('recentJobsTable'),
  validationQueueTable: document.getElementById('validationQueueTable'),
  dbUsage: document.getElementById('db-usage'),
  storageUsage: document.getElementById('storage-usage'),

  // Upload
  uploadArea: document.getElementById('uploadArea'),
  fileInput: document.getElementById('fileInput'),
  uploadBtn: document.getElementById('uploadBtn'),
  autoIngest: document.getElementById('autoIngest'),
  generateEmbeddings: document.getElementById('generateEmbeddings'),
  uploadProgress: document.getElementById('uploadProgress'),
  uploadProgressFill: document.getElementById('uploadProgressFill'),
  uploadStatus: document.getElementById('uploadStatus'),
  uploadedFilesTable: document.getElementById('uploadedFilesTable'),

  // Ingestion
  ingestionJobsTable: document.getElementById('ingestionJobsTable'),
  jobDetailCard: document.getElementById('jobDetailCard'),
  jobDetailContent: document.getElementById('jobDetailContent'),

  // Parts Catalog
  partsSearchInput: document.getElementById('partsSearchInput'),
  partsCategoryFilter: document.getElementById('partsCategoryFilter'),
  exportPartsBtn: document.getElementById('exportPartsBtn'),
  partsCatalogTable: document.getElementById('partsCatalogTable'),
  partsPagination: document.getElementById('partsPagination'),

  // Tires Catalog
  tiresSearchInput: document.getElementById('tiresSearchInput'),
  tiresTypeFilter: document.getElementById('tiresTypeFilter'),
  exportTiresBtn: document.getElementById('exportTiresBtn'),
  tiresCatalogTable: document.getElementById('tiresCatalogTable'),
  tiresPagination: document.getElementById('tiresPagination'),

  // Validation
  validationSeverityFilter: document.getElementById('validationSeverityFilter'),
  validationStatusFilter: document.getElementById('validationStatusFilter'),
  validationGrid: document.getElementById('validationGrid'),

  // Search Test
  searchQueryInput: document.getElementById('searchQueryInput'),
  searchTestBtn: document.getElementById('searchTestBtn'),
  searchTestResults: document.getElementById('searchTestResults'),
  searchResultsMeta: document.getElementById('searchResultsMeta'),
  searchResultsList: document.getElementById('searchResultsList'),

  // Analytics
  totalSearches: document.getElementById('totalSearches'),
  uniqueUsers: document.getElementById('uniqueUsers'),
  avgResponseTime: document.getElementById('avgResponseTime'),
  positiveFeedback: document.getElementById('positiveFeedback'),
  topSearchesList: document.getElementById('topSearchesList'),
  recentSearchesList: document.getElementById('recentSearchesList'),

  // Settings
  settingsForm: document.getElementById('settingsForm'),
  groqApiKey: document.getElementById('groqApiKey'),
  hfApiKey: document.getElementById('hfApiKey'),
  lineAccessToken: document.getElementById('lineAccessToken'),
  lineChannelSecret: document.getElementById('lineChannelSecret'),
  embeddingMode: document.getElementById('embeddingMode'),

  // System Status
  pgvectorStatus: document.getElementById('pgvectorStatus'),
  vectorIndexStatus: document.getElementById('vectorIndexStatus'),
  groqApiStatus: document.getElementById('groqApiStatus'),
  embeddingStatus: document.getElementById('embeddingStatus'),

  // Modal
  editModal: document.getElementById('editModal'),
  editModalTitle: document.getElementById('editModalTitle'),
  editModalClose: document.getElementById('editModalClose'),
  editModalBody: document.getElementById('editModalBody'),
  editModalCancel: document.getElementById('editModalCancel'),
  editModalSave: document.getElementById('editModalSave'),

  // Toast
  toastContainer: document.getElementById('toastContainer')
};

// ==================== INITIALIZATION ====================
async function init() {
  setupEventListeners();
  loadSettings();
  await checkConnection();
  await loadDashboardData();

  // Auto-refresh every 30 seconds
  setInterval(async () => {
    await checkConnection();
    if (state.currentPage === 'dashboard') {
      await loadDashboardData();
    }
  }, 30000);
}

function setupEventListeners() {
  // Menu toggle (mobile)
  elements.menuToggle?.addEventListener('click', () => {
    elements.sidebar?.classList.toggle('active');
  });

  // Navigation
  elements.navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      if (page) navigateTo(page);
    });
  });

  // Upload area
  elements.uploadArea?.addEventListener('click', () => elements.fileInput?.click());
  elements.uploadArea?.addEventListener('dragover', handleDragOver);
  elements.uploadArea?.addEventListener('dragleave', handleDragLeave);
  elements.uploadArea?.addEventListener('drop', handleDrop);
  elements.fileInput?.addEventListener('change', handleFileSelect);
  elements.uploadBtn?.addEventListener('click', handleUpload);

  // Search filters
  elements.partsSearchInput?.addEventListener('input', debounce(() => loadPartsCatalog(), 300));
  elements.partsCategoryFilter?.addEventListener('change', loadPartsCatalog);
  elements.tiresSearchInput?.addEventListener('input', debounce(() => loadTiresCatalog(), 300));
  elements.tiresTypeFilter?.addEventListener('change', loadTiresCatalog);

  // Search test
  elements.searchTestBtn?.addEventListener('click', handleSearchTest);

  // Settings form
  elements.settingsForm?.addEventListener('submit', handleSaveSettings);

  // Modal
  elements.editModalClose?.addEventListener('click', closeModal);
  elements.editModalCancel?.addEventListener('click', closeModal);
  elements.editModal?.addEventListener('click', (e) => {
    if (e.target === elements.editModal) closeModal();
  });

  // Validation filters
  elements.validationSeverityFilter?.addEventListener('change', loadValidationQueue);
  elements.validationStatusFilter?.addEventListener('change', loadValidationQueue);
}

// ==================== NAVIGATION ====================
function navigateTo(page) {
  state.currentPage = page;

  // Update nav items
  elements.navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Update page visibility
  elements.pages.forEach(p => {
    p.classList.toggle('active', p.id === `page-${page}`);
  });

  // Update title
  const titles = {
    'dashboard': 'Dashboard',
    'catalog-upload': 'Upload Catalog',
    'ingestion': 'Ingestion Jobs',
    'parts-catalog': 'Parts Catalog',
    'tires-catalog': 'Tires Catalog',
    'validation': 'Data Validation',
    'search-test': 'Search Test',
    'analytics': 'Analytics',
    'settings': 'Settings'
  };
  elements.pageTitle.textContent = titles[page] || 'Dashboard';

  // Close mobile menu
  elements.sidebar?.classList.remove('active');

  // Load page data
  loadPageData(page);
}

async function loadPageData(page) {
  switch (page) {
    case 'dashboard':
      await loadDashboardData();
      break;
    case 'catalog-upload':
      await loadUploadedFiles();
      break;
    case 'ingestion':
      await loadIngestionJobs();
      break;
    case 'parts-catalog':
      await loadPartsCatalog();
      break;
    case 'tires-catalog':
      await loadTiresCatalog();
      break;
    case 'validation':
      await loadValidationQueue();
      break;
    case 'analytics':
      await loadAnalytics();
      break;
    case 'settings':
      await checkSystemStatus();
      break;
  }
}

// ==================== CONNECTION CHECK ====================
async function checkConnection() {
  const statusDot = elements.connectionStatus?.querySelector('.status-dot');

  try {
    const { data, error } = await supabase
      .from('parts_catalog')
      .select('id')
      .limit(1);

    if (error) throw error;

    state.connectionStatus = 'connected';
    statusDot?.classList.add('connected');
    statusDot?.classList.remove('error');
    elements.connectionStatus.innerHTML = '<span class="status-dot connected"></span>Connected';
  } catch (err) {
    state.connectionStatus = 'error';
    statusDot?.classList.remove('connected');
    statusDot?.classList.add('error');
    elements.connectionStatus.innerHTML = '<span class="status-dot error"></span>Connection Error';
    console.error('Connection check failed:', err);
  }
}

// ==================== DASHBOARD ====================
async function loadDashboardData() {
  try {
    // Load stats
    const [partsCount, tiresCount, sourcesCount, jobsCount] = await Promise.all([
      supabase.from('parts_catalog').select('id', { count: 'exact', head: true }),
      supabase.from('tires_catalog').select('id', { count: 'exact', head: true }),
      supabase.from('catalog_sources').select('id', { count: 'exact', head: true }),
      supabase.from('ingestion_jobs').select('id', { count: 'exact', head: true })
        .eq('status', 'running')
    ]);

    state.stats.totalParts = partsCount.count || 0;
    state.stats.totalTires = tiresCount.count || 0;
    state.stats.totalSources = sourcesCount.count || 0;
    state.stats.activeJobs = jobsCount.count || 0;

    elements.totalParts.textContent = formatNumber(state.stats.totalParts);
    elements.totalTires.textContent = formatNumber(state.stats.totalTires);
    elements.totalSources.textContent = formatNumber(state.stats.totalSources);
    elements.activeJobs.textContent = state.stats.activeJobs;

    // Load recent jobs
    const { data: recentJobs } = await supabase
      .from('ingestion_jobs')
      .select('*, catalog_sources(name)')
      .order('created_at', { ascending: false })
      .limit(5);

    if (recentJobs && recentJobs.length > 0) {
      elements.recentJobsTable.innerHTML = recentJobs.map(job => `
        <tr>
          <td>${job.catalog_sources?.name || 'Unknown'}</td>
          <td><span class="status-badge status-${job.status}">${job.status}</span></td>
          <td>
            <div class="progress-bar" style="width: 100px; height: 4px;">
              <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
            </div>
          </td>
          <td>${formatDate(job.created_at)}</td>
        </tr>
      `).join('');
    } else {
      elements.recentJobsTable.innerHTML = '<tr><td colspan="4" class="empty-state">No recent jobs</td></tr>';
    }

    // Load validation queue
    const { data: validationQueue } = await supabase
      .from('validation_queue')
      .select('*')
      .eq('status', 'pending')
      .order('severity', { ascending: false })
      .limit(5);

    if (validationQueue && validationQueue.length > 0) {
      elements.validationQueueTable.innerHTML = validationQueue.map(item => `
        <tr>
          <td><span class="status-badge" style="background: ${getSeverityColor(item.severity)}">${item.severity}</span></td>
          <td>${item.table_name}</td>
          <td>${item.status}</td>
        </tr>
      `).join('');
    } else {
      elements.validationQueueTable.innerHTML = '<tr><td colspan="3" class="empty-state">No pending validations</td></tr>';
    }

    // Update usage (mock data for now - would need API calls)
    elements.dbUsage.textContent = 'Checking...';
    elements.storageUsage.textContent = 'Checking...';

  } catch (err) {
    console.error('Error loading dashboard:', err);
    showToast('Error loading dashboard data', 'error');
  }
}

// ==================== UPLOAD HANDLERS ====================
let selectedFile = null;

function handleDragOver(e) {
  e.preventDefault();
  elements.uploadArea?.classList.add('dragover');
}

function handleDragLeave(e) {
  e.preventDefault();
  elements.uploadArea?.classList.remove('dragover');
}

function handleDrop(e) {
  e.preventDefault();
  elements.uploadArea?.classList.remove('dragover');

  const files = e.dataTransfer?.files;
  if (files && files.length > 0) {
    selectFile(files[0]);
  }
}

function handleFileSelect(e) {
  const files = e.target?.files;
  if (files && files.length > 0) {
    selectFile(files[0]);
  }
}

function selectFile(file) {
  selectedFile = file;

  // Validate file
  const validTypes = ['application/pdf', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/csv'];
  const maxSize = 50 * 1024 * 1024; // 50MB

  if (!validTypes.includes(file.type) && !file.name.match(/\.(pdf|xlsx|xls|csv)$/i)) {
    showToast('Invalid file type. Please upload PDF, Excel, or CSV files.', 'error');
    return;
  }

  if (file.size > maxSize) {
    showToast('File too large. Maximum size is 50MB.', 'error');
    return;
  }

  // Update UI
  elements.uploadArea.querySelector('p').textContent = `${file.name} (${formatBytes(file.size)})`;
  elements.uploadBtn.disabled = false;
}

async function handleUpload() {
  if (!selectedFile) return;

  elements.uploadProgress.style.display = 'block';
  elements.uploadBtn.disabled = true;

  try {
    // Create catalog source record
    const { data: source, error: sourceError } = await supabase
      .from('catalog_sources')
      .insert({
        name: selectedFile.name,
        type: selectedFile.name.endsWith('.pdf') ? 'pdf' : 'excel',
        file_size: selectedFile.size,
        status: 'processing'
      })
      .select()
      .single();

    if (sourceError) throw sourceError;

    // Upload file to Supabase Storage
    const fileName = `${source.id}/${selectedFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from('jetsetgo-catalogs')
      .upload(fileName, selectedFile);

    if (uploadError) throw uploadError;

    // Update source with file path
    await supabase
      .from('catalog_sources')
      .update({ file_path: fileName })
      .eq('id', source.id);

    // Start ingestion if auto-ingest is checked
    if (elements.autoIngest.checked) {
      await startIngestion(source.id);
    }

    // Reset UI
    elements.uploadProgress.style.display = 'none';
    elements.uploadArea.querySelector('p').textContent = 'Drag & drop files here or click to browse';
    elements.uploadBtn.disabled = true;
    selectedFile = null;
    elements.fileInput.value = '';

    showToast('File uploaded successfully!', 'success');
    await loadUploadedFiles();

  } catch (err) {
    console.error('Upload error:', err);
    showToast('Error uploading file: ' + err.message, 'error');
    elements.uploadProgress.style.display = 'none';
    elements.uploadBtn.disabled = false;
  }
}

async function startIngestion(sourceId) {
  try {
    const { error } = await supabase.functions.invoke('jetsetgo-ingest', {
      body: { sourceId }
    });

    if (error) throw error;

    showToast('Ingestion started!', 'success');
  } catch (err) {
    console.error('Ingestion error:', err);
    showToast('Error starting ingestion: ' + err.message, 'error');
  }
}

async function loadUploadedFiles() {
  try {
    const { data: sources } = await supabase
      .from('catalog_sources')
      .select('*')
      .order('upload_date', { ascending: false })
      .limit(20);

    if (sources && sources.length > 0) {
      elements.uploadedFilesTable.innerHTML = sources.map(source => `
        <tr>
          <td>${source.name}</td>
          <td>${source.type}</td>
          <td>${formatBytes(source.file_size || 0)}</td>
          <td><span class="status-badge status-${source.status}">${source.status}</span></td>
          <td>${formatDate(source.upload_date)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewSourceDetails('${source.id}')">View</button>
          </td>
        </tr>
      `).join('');
    } else {
      elements.uploadedFilesTable.innerHTML = '<tr><td colspan="6" class="empty-state">No files uploaded</td></tr>';
    }
  } catch (err) {
    console.error('Error loading uploaded files:', err);
  }
}

// ==================== INGESTION JOBS ====================
async function loadIngestionJobs() {
  try {
    const { data: jobs } = await supabase
      .from('ingestion_jobs')
      .select('*, catalog_sources(name)')
      .order('created_at', { ascending: false })
      .limit(20);

    if (jobs && jobs.length > 0) {
      elements.ingestionJobsTable.innerHTML = jobs.map(job => `
        <tr>
          <td><code>${job.id.slice(0, 8)}</code></td>
          <td>${job.catalog_sources?.name || 'Unknown'}</td>
          <td>${job.stage || '-'}</td>
          <td>
            <div class="progress-bar" style="width: 100px; height: 4px;">
              <div class="progress-fill" style="width: ${job.progress || 0}%"></div>
            </div>
            ${job.progress || 0}%
          </td>
          <td><span class="status-badge status-${job.status}">${job.status}</span></td>
          <td>${formatDate(job.started_at || job.created_at)}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="viewJobDetails('${job.id}')">View</button>
          </td>
        </tr>
      `).join('');
    } else {
      elements.ingestionJobsTable.innerHTML = '<tr><td colspan="7" class="empty-state">No ingestion jobs</td></tr>';
    }
  } catch (err) {
    console.error('Error loading ingestion jobs:', err);
  }
}

// ==================== PARTS CATALOG ====================
async function loadPartsCatalog() {
  try {
    let query = supabase
      .from('parts_catalog')
      .select('*')
      .eq('is_active', true)
      .order('part_number')
      .limit(50);

    // Apply filters
    const searchTerm = elements.partsSearchInput?.value;
    if (searchTerm) {
      query = query.or(`part_number.ilike.%${searchTerm}%,part_name_th.ilike.%${searchTerm}%,part_name_en.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%`);
    }

    const category = elements.partsCategoryFilter?.value;
    if (category) {
      query = query.eq('category', category);
    }

    const { data: parts } = await query;

    if (parts && parts.length > 0) {
      elements.partsCatalogTable.innerHTML = parts.map(part => `
        <tr>
          <td><strong>${part.part_number}</strong></td>
          <td>${part.oem_number || '-'}</td>
          <td>${part.part_name_th || '-'}</td>
          <td>${part.part_name_en || '-'}</td>
          <td>${part.brand || '-'}</td>
          <td>${part.category || '-'}</td>
          <td>${part.price ? `${part.price} THB` : '-'}</td>
          <td>${part.stock_quantity || 0}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editPart('${part.id}')">Edit</button>
          </td>
        </tr>
      `).join('');
    } else {
      elements.partsCatalogTable.innerHTML = '<tr><td colspan="9" class="empty-state">No parts found</td></tr>';
    }
  } catch (err) {
    console.error('Error loading parts catalog:', err);
  }
}

// ==================== TIRES CATALOG ====================
async function loadTiresCatalog() {
  try {
    let query = supabase
      .from('tires_catalog')
      .select('*')
      .eq('is_active', true)
      .order('brand')
      .limit(50);

    // Apply filters
    const searchTerm = elements.tiresSearchInput?.value;
    if (searchTerm) {
      query = query.or(`part_number.ilike.%${searchTerm}%,brand.ilike.%${searchTerm}%,model.ilike.%${searchTerm}%,size.ilike.%${searchTerm}%`);
    }

    const tireType = elements.tiresTypeFilter?.value;
    if (tireType) {
      query = query.eq('tire_type', tireType);
    }

    const { data: tires } = await query;

    if (tires && tires.length > 0) {
      elements.tiresCatalogTable.innerHTML = tires.map(tire => `
        <tr>
          <td><strong>${tire.part_number}</strong></td>
          <td>${tire.brand}</td>
          <td>${tire.model}</td>
          <td>${tire.size}</td>
          <td>${tire.tire_type || '-'}</td>
          <td>${tire.price ? `${tire.price} THB` : '-'}</td>
          <td>${tire.stock_quantity || 0}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editTire('${tire.id}')">Edit</button>
          </td>
        </tr>
      `).join('');
    } else {
      elements.tiresCatalogTable.innerHTML = '<tr><td colspan="8" class="empty-state">No tires found</td></tr>';
    }
  } catch (err) {
    console.error('Error loading tires catalog:', err);
  }
}

// ==================== VALIDATION QUEUE ====================
async function loadValidationQueue() {
  try {
    let query = supabase
      .from('validation_queue')
      .select('*')
      .order('severity', { ascending: false })
      .limit(20);

    const severity = elements.validationSeverityFilter?.value;
    if (severity) {
      query = query.eq('severity', severity);
    }

    const status = elements.validationStatusFilter?.value;
    if (status) {
      query = query.eq('status', status);
    }

    const { data: validations } = await query;

    if (validations && validations.length > 0) {
      elements.validationGrid.innerHTML = validations.map(v => `
        <div class="validation-card ${v.severity}">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span class="status-badge" style="background: ${getSeverityColor(v.severity)}">${v.severity}</span>
            <span class="status-badge status-${v.status}">${v.status}</span>
          </div>
          <p><strong>Table:</strong> ${v.table_name}</p>
          <pre style="background: var(--bg-darker); padding: 0.5rem; border-radius: 4px; overflow: auto; max-height: 150px; font-size: 0.75rem;">${JSON.stringify(v.proposed_data, null, 2)}</pre>
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button class="btn btn-sm btn-primary" onclick="approveValidation('${v.id}')">Approve</button>
            <button class="btn btn-sm btn-secondary" onclick="rejectValidation('${v.id}')">Reject</button>
            <button class="btn btn-sm btn-secondary" onclick="editValidation('${v.id}')">Edit</button>
          </div>
        </div>
      `).join('');
    } else {
      elements.validationGrid.innerHTML = '<div class="empty-state">No items in validation queue</div>';
    }
  } catch (err) {
    console.error('Error loading validation queue:', err);
  }
}

// ==================== SEARCH TEST ====================
async function handleSearchTest() {
  const query = elements.searchQueryInput?.value.trim();
  if (!query) {
    showToast('Please enter a search query', 'warning');
    return;
  }

  const searchTarget = document.querySelector('input[name="searchTarget"]:checked')?.value || 'parts';
  const hybridSearch = elements.hybridSearch?.checked;

  elements.searchTestBtn.disabled = true;
  elements.searchTestBtn.textContent = 'Searching...';
  elements.searchTestResults.style.display = 'none';

  try {
    // Call the search function
    const { data, error } = await supabase.functions.invoke('jetsetgo-rag-query', {
      body: {
        query,
        catalogType: searchTarget,
        hybridMode: hybridSearch
      }
    });

    if (error) throw error;

    // Display results
    elements.searchTestResults.style.display = 'block';
    elements.searchResultsMeta.textContent = `Found ${data.results?.length || 0} results in ${data.responseTime || 0}ms`;

    if (data.results && data.results.length > 0) {
      elements.searchResultsList.innerHTML = data.results.map((result, index) => `
        <div class="result-item">
          <div class="result-item-header">
            <strong>${result.part_number || result.name || 'Result ' + (index + 1)}</strong>
            <span class="similarity-score">${(result.similarity * 100).toFixed(1)}%</span>
          </div>
          <p>${result.part_name_th || result.part_name_en || result.description || ''}</p>
          ${result.price ? `<p><strong>Price:</strong> ${result.price} THB</p>` : ''}
          ${result.stock_quantity !== undefined ? `<p><strong>Stock:</strong> ${result.stock_quantity}</p>` : ''}
        </div>
      `).join('');
    } else {
      elements.searchResultsList.innerHTML = '<p class="empty-state">No results found</p>';
    }

  } catch (err) {
    console.error('Search error:', err);
    showToast('Search failed: ' + err.message, 'error');
  } finally {
    elements.searchTestBtn.disabled = false;
    elements.searchTestBtn.textContent = 'Search';
  }
}

// ==================== ANALYTICS ====================
async function loadAnalytics() {
  try {
    // Load search analytics from the view
    const { data: dailyStats } = await supabase
      .from('jetsetgo_daily_search_analytics')
      .select('*')
      .order('date', { ascending: false })
      .limit(1);

    if (dailyStats && dailyStats.length > 0) {
      const stats = dailyStats[0];
      elements.totalSearches.textContent = formatNumber(stats.total_searches || 0);
      elements.uniqueUsers.textContent = formatNumber(stats.unique_users || 0);
      elements.avgResponseTime.textContent = `${Math.round(stats.avg_response_time || 0)}ms`;
      elements.positiveFeedback.textContent = `${stats.positive_rate || 0}%`;
    }

    // Load top searches
    const { data: topSearches } = await supabase
      .from('jetsetgo_popular_searches')
      .select('*')
      .order('search_count', { ascending: false })
      .limit(10);

    if (topSearches && topSearches.length > 0) {
      elements.topSearchesList.innerHTML = topSearches.map(search => `
        <li>
          <span>${search.query_normalized}</span>
          <span>${search.search_count} searches</span>
        </li>
      `).join('');
    }

    // Load recent searches
    const { data: recentSearches } = await supabase
      .from('search_logs')
      .select('query, created_at, results_count')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentSearches && recentSearches.length > 0) {
      elements.recentSearchesList.innerHTML = recentSearches.map(search => `
        <li>
          <span>${search.query}</span>
          <span>${formatDate(search.created_at)}</span>
        </li>
      `).join('');
    }

  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// ==================== SETTINGS ====================
function loadSettings() {
  const settings = localStorage.getItem('jetsetgo_settings');
  if (settings) {
    state.settings = JSON.parse(settings);
    elements.groqApiKey.value = state.settings.groqApiKey || '';
    elements.hfApiKey.value = state.settings.hfApiKey || '';
    elements.lineAccessToken.value = state.settings.lineAccessToken || '';
    elements.lineChannelSecret.value = state.settings.lineChannelSecret || '';
    elements.embeddingMode.value = state.settings.embeddingMode || 'transformersjs';
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();

  state.settings = {
    groqApiKey: elements.groqApiKey.value,
    hfApiKey: elements.hfApiKey.value,
    lineAccessToken: elements.lineAccessToken.value,
    lineChannelSecret: elements.lineChannelSecret.value,
    embeddingMode: elements.embeddingMode.value
  };

  localStorage.setItem('jetsetgo_settings', JSON.stringify(state.settings));
  showToast('Settings saved!', 'success');
}

async function checkSystemStatus() {
  // Check pgvector
  try {
    const { data } = await supabase.rpc('jetsetgo_check_pgvector');
    elements.pgvectorStatus.textContent = 'Enabled';
    elements.pgvectorStatus.className = 'status-value';
  } catch (err) {
    elements.pgvectorStatus.textContent = 'Not Available';
    elements.pgvectorStatus.className = 'status-value error';
  }

  // Check vector indexes
  try {
    const { data } = await supabase.from('jetsetgo_vector_stats').select('*');
    elements.vectorIndexStatus.textContent = 'Active';
    elements.vectorIndexStatus.className = 'status-value';
  } catch (err) {
    elements.vectorIndexStatus.textContent = 'Error';
    elements.vectorIndexStatus.className = 'status-value error';
  }

  // Groq API status
  if (state.settings.groqApiKey) {
    elements.groqApiStatus.textContent = 'Configured';
    elements.groqApiStatus.className = 'status-value';
  } else {
    elements.groqApiStatus.textContent = 'Not Configured';
    elements.groqApiStatus.className = 'status-value warning';
  }

  // Embedding status
  elements.embeddingStatus.textContent = state.settings.embeddingMode === 'transformersjs'
    ? 'Client-side (FREE)'
    : 'Hugging Face API';
  elements.embeddingStatus.className = 'status-value';
}

// ==================== UTILITIES ====================
function formatNumber(num) {
  return new Intl.NumberFormat('th-TH').format(num);
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleString('th-TH');
}

function getSeverityColor(severity) {
  const colors = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#22c55e'
  };
  return colors[severity] || '#64748b';
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer?.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function closeModal() {
  elements.editModal?.classList.remove('active');
}

// ==================== GLOBAL FUNCTIONS ====================
window.viewSourceDetails = async (sourceId) => {
  // Show source details modal
  showToast('Source details coming soon!', 'info');
};

window.viewJobDetails = async (jobId) => {
  // Show job details
  elements.jobDetailCard.style.display = 'block';
  elements.jobDetailContent.innerHTML = '<p>Loading job details...</p>';

  try {
    const { data: job } = await supabase
      .from('ingestion_jobs')
      .select('*, catalog_sources(*)')
      .eq('id', jobId)
      .single();

    if (job) {
      elements.jobDetailContent.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
          <div><strong>Status:</strong> <span class="status-badge status-${job.status}">${job.status}</span></div>
          <div><strong>Stage:</strong> ${job.stage || '-'}</div>
          <div><strong>Progress:</strong> ${job.progress || 0}%</div>
          <div><strong>Started:</strong> ${formatDate(job.started_at || job.created_at)}</div>
          <div><strong>Records Processed:</strong> ${job.records_processed || 0}</div>
          <div><strong>Records Successful:</strong> ${job.records_successful || 0}</div>
          ${job.error_message ? `<div colspan="2"><strong>Error:</strong> ${job.error_message}</div>` : ''}
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading job details:', err);
  }
};

window.editPart = async (partId) => {
  showToast('Edit part coming soon!', 'info');
};

window.editTire = async (tireId) => {
  showToast('Edit tire coming soon!', 'info');
};

window.approveValidation = async (validationId) => {
  try {
    await supabase
      .from('validation_queue')
      .update({ status: 'approved' })
      .eq('id', validationId);
    showToast('Validation approved!', 'success');
    await loadValidationQueue();
  } catch (err) {
    showToast('Error approving validation', 'error');
  }
};

window.rejectValidation = async (validationId) => {
  try {
    await supabase
      .from('validation_queue')
      .update({ status: 'rejected' })
      .eq('id', validationId);
    showToast('Validation rejected', 'info');
    await loadValidationQueue();
  } catch (err) {
    showToast('Error rejecting validation', 'error');
  }
};

window.editValidation = async (validationId) => {
  showToast('Edit validation coming soon!', 'info');
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', init);
