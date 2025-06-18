// Configuration
const CONFIG = {
  spotify: {
    clientId: '196e810886e5453caaea8894b982f905', // Reemplazar con tu Client ID
    redirectUri: window.location.origin,
    scopes: [
      'streaming',
      'user-read-email',
      'user-read-private',
      'user-read-playback-state',
      'user-modify-playback-state'
    ],
    trackUri: 'spotify:track:5G5NikhFA6Y57JvPj2ogpr'
  },
  slider: {
    autoSlide: true,
    slideDuration: 5000, // Exactly 5 seconds
    images: [
      'https://via.placeholder.com/800x400/1DB954/FFFFFF?text=Imagen+1',
      'https://via.placeholder.com/800x400/191414/1DB954?text=Imagen+2', 
      'https://via.placeholder.com/800x400/1DB954/000000?text=Imagen+3',
      'https://via.placeholder.com/800x400/000000/1DB954?text=Imagen+4'
    ]
  }
};

// Global variables
let spotifyPlayer = null;
let isPlaying = false;
let currentVolume = 0.5;
let accessToken = null;
let deviceId = null;
let currentSlide = 0;
let slideInterval = null;
let sliderPaused = false;

// DOM Elements
const elements = {
  playBtn: document.getElementById('playBtn'),
  playIcon: document.getElementById('playIcon'),
  volumeSlider: document.getElementById('volumeSlider'),
  volumeValue: document.getElementById('volumeValue'),
  trackTitle: document.getElementById('trackTitle'),
  trackArtist: document.getElementById('trackArtist'),
  albumCover: document.getElementById('albumCover'),
  loginBtn: document.getElementById('loginBtn'),
  authSection: document.getElementById('authSection'),
  connectionStatus: document.getElementById('connectionStatus'),
  loadingOverlay: document.getElementById('loadingOverlay'),
  sliderTrack: document.getElementById('sliderTrack'),
  sliderDots: document.getElementById('sliderDots'),
  prevBtn: document.getElementById('prevBtn'),
  nextBtn: document.getElementById('nextBtn')
};

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Initialize the application
function initializeApp() {
  console.log('Inicializando aplicación...');
  
  // Initialize slider
  initializeSlider();
  
  // Setup event listeners
  setupEventListeners();
  
  // Check for existing token
  checkForExistingToken();
  
  // Hide loading overlay
  setTimeout(() => {
    elements.loadingOverlay.classList.add('hidden');
  }, 1000);
}

// Setup event listeners
function setupEventListeners() {
  // Spotify controls
  elements.playBtn.addEventListener('click', togglePlayback);
  elements.volumeSlider.addEventListener('input', handleVolumeChange);
  elements.loginBtn.addEventListener('click', authenticateSpotify);
  
  // Slider controls
  elements.prevBtn.addEventListener('click', () => changeSlide(-1));
  elements.nextBtn.addEventListener('click', () => changeSlide(1));
  
  // Pause auto-slide on hover
  const sliderContainer = document.querySelector('.slider-container');
  sliderContainer.addEventListener('mouseenter', () => {
    sliderPaused = true;
    stopAutoSlide();
  });
  
  sliderContainer.addEventListener('mouseleave', () => {
    sliderPaused = false;
    if (CONFIG.slider.autoSlide) {
      startAutoSlide();
    }
  });
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Handle keyboard shortcuts
function handleKeyboard(event) {
  switch(event.code) {
    case 'Space':
      event.preventDefault();
      if (accessToken) togglePlayback();
      break;
    case 'ArrowLeft':
      event.preventDefault();
      changeSlide(-1);
      break;
    case 'ArrowRight':
      event.preventDefault();
      changeSlide(1);
      break;
  }
}

// Initialize image slider
function initializeSlider() {
  console.log('Inicializando slider...');
  
  const images = CONFIG.slider.images;
  
  // Create slider items
  images.forEach((imageUrl, index) => {
    const slideItem = document.createElement('div');
    slideItem.className = 'slider-item';
    
    const img = document.createElement('img');
    img.src = imageUrl;
    img.alt = `Imagen ${index + 1}`;
    img.onerror = () => {
      // Fallback if image fails to load
      slideItem.innerHTML = `<div class="slider-placeholder">Imagen ${index + 1}</div>`;
    };
    
    slideItem.appendChild(img);
    elements.sliderTrack.appendChild(slideItem);
  });
  
  // Create dots
  images.forEach((_, index) => {
    const dot = document.createElement('button');
    dot.className = `slider-dot ${index === 0 ? 'active' : ''}`;
    dot.setAttribute('aria-label', `Ir a imagen ${index + 1}`);
    dot.addEventListener('click', () => goToSlide(index));
    elements.sliderDots.appendChild(dot);
  });
  
  // Start auto-slide after a brief delay
  setTimeout(() => {
    if (CONFIG.slider.autoSlide && !sliderPaused) {
      startAutoSlide();
    }
  }, 1000);
}

// Start automatic sliding
function startAutoSlide() {
  // Clear any existing interval
  stopAutoSlide();
  
  console.log(`Iniciando auto-slide cada ${CONFIG.slider.slideDuration}ms`);
  
  slideInterval = setInterval(() => {
    if (!sliderPaused) {
      changeSlide(1);
    }
  }, CONFIG.slider.slideDuration);
}

// Stop automatic sliding
function stopAutoSlide() {
  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }
}

// Change slide
function changeSlide(direction) {
  const totalSlides = CONFIG.slider.images.length;
  currentSlide = (currentSlide + direction + totalSlides) % totalSlides;
  updateSlider();
}

// Go to specific slide
function goToSlide(index) {
  currentSlide = index;
  updateSlider();
  
  // Restart auto-slide after manual navigation
  if (CONFIG.slider.autoSlide && !sliderPaused) {
    startAutoSlide();
  }
}

// Update slider position and dots
function updateSlider() {
  const translateX = -currentSlide * 100;
  elements.sliderTrack.style.transform = `translateX(${translateX}%)`;
  
  // Update dots
  const dots = elements.sliderDots.querySelectorAll('.slider-dot');
  dots.forEach((dot, index) => {
    dot.classList.toggle('active', index === currentSlide);
  });
}

// Check for existing Spotify token
function checkForExistingToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');
  
  if (error) {
    console.error('Error de autenticación:', error);
    updateStatus('Error de autenticación', 'error');
    return;
  }
  
  if (code) {
    console.log('Código de autorización encontrado');
    exchangeCodeForToken(code);
  } else {
    // Check for token in URL hash (implicit grant)
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);
    const token = params.get('access_token');
    
    if (token) {
      accessToken = token;
      initializeSpotifyPlayer();
    } else {
      updateStatus('Conecta tu cuenta de Spotify', 'info');
    }
  }
}

// Authenticate with Spotify
function authenticateSpotify() {
  console.log('Iniciando autenticación con Spotify...');
  
  const authUrl = new URL('https://accounts.spotify.com/authorize');
  authUrl.searchParams.append('client_id', CONFIG.spotify.clientId);
  authUrl.searchParams.append('response_type', 'token');
  authUrl.searchParams.append('redirect_uri', CONFIG.spotify.redirectUri);
  authUrl.searchParams.append('scope', CONFIG.spotify.scopes.join(' '));
  
  window.location.href = authUrl.toString();
}

// Exchange authorization code for token
async function exchangeCodeForToken(code) {
  try {
    updateStatus('Obteniendo token...', 'info');
    
    // Note: In a real application, this should be done on the server
    // This is a simplified version for demonstration
    console.log('Intercambiando código por token...');
    
    // For now, redirect to implicit flow
    authenticateSpotify();
    
  } catch (error) {
    console.error('Error intercambiando código:', error);
    updateStatus('Error obteniendo token', 'error');
  }
}

// Initialize Spotify Web Playback SDK
function initializeSpotifyPlayer() {
  console.log('Inicializando reproductor de Spotify...');
  updateStatus('Inicializando reproductor...', 'info');
  
  window.onSpotifyWebPlaybackSDKReady = () => {
    spotifyPlayer = new Spotify.Player({
      name: 'Reproductor Web',
      getOAuthToken: cb => cb(accessToken),
      volume: currentVolume
    });

    // Error handling
    spotifyPlayer.addListener('initialization_error', ({ message }) => {
      console.error('Error de inicialización:', message);
      updateStatus('Error inicializando reproductor', 'error');
    });

    spotifyPlayer.addListener('authentication_error', ({ message }) => {
      console.error('Error de autenticación:', message);
      updateStatus('Error de autenticación', 'error');
    });

    spotifyPlayer.addListener('account_error', ({ message }) => {
      console.error('Error de cuenta:', message);
      updateStatus('Error de cuenta Premium requerida', 'error');
    });

    spotifyPlayer.addListener('playback_error', ({ message }) => {
      console.error('Error de reproducción:', message);
      updateStatus('Error de reproducción', 'error');
    });

    // Playbook status updates
    spotifyPlayer.addListener('player_state_changed', (state) => {
      if (!state) return;
      
      isPlaying = !state.paused;
      updatePlayButton();
      updateTrackInfo(state.track_window.current_track);
    });

    // Ready
    spotifyPlayer.addListener('ready', ({ device_id }) => {
      console.log('Reproductor listo con Device ID:', device_id);
      deviceId = device_id;
      updateStatus('Reproductor conectado', 'success');
      elements.authSection.style.display = 'none';
    });

    // Not Ready
    spotifyPlayer.addListener('not_ready', ({ device_id }) => {
      console.log('Dispositivo desconectado:', device_id);
      updateStatus('Dispositivo desconectado', 'error');
    });

    // Connect to the player
    spotifyPlayer.connect().then(success => {
      if (success) {
        console.log('Conectado exitosamente al reproductor');
      } else {
        console.error('Falló la conexión al reproductor');
        updateStatus('Error conectando reproductor', 'error');
      }
    });
  };
}

// Toggle playback
async function togglePlayback() {
  if (!spotifyPlayer || !deviceId) {
    console.log('Reproductor no disponible');
    return;
  }

  try {
    if (isPlaying) {
      await spotifyPlayer.pause();
      console.log('Reproducción pausada');
    } else {
      // First, transfer playback to this device and start the specific track
      await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        body: JSON.stringify({
          uris: [CONFIG.spotify.trackUri]
        }),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });
      console.log('Reproducción iniciada');
    }
  } catch (error) {
    console.error('Error controlando reproducción:', error);
    updateStatus('Error controlando reproducción', 'error');
  }
}

// Handle volume change
function handleVolumeChange(event) {
  const volume = parseInt(event.target.value) / 100;
  currentVolume = volume;
  
  if (spotifyPlayer) {
    spotifyPlayer.setVolume(volume).then(() => {
      console.log(`Volumen establecido a ${Math.round(volume * 100)}%`);
    });
  }
  
  elements.volumeValue.textContent = `${Math.round(volume * 100)}%`;
}

// Update play button
function updatePlayButton() {
  elements.playIcon.textContent = isPlaying ? '⏸️' : '▶️';
  elements.playBtn.setAttribute('aria-label', isPlaying ? 'Pausar' : 'Reproducir');
}

// Update track information
function updateTrackInfo(track) {
  if (!track) return;
  
  elements.trackTitle.textContent = track.name;
  elements.trackArtist.textContent = track.artists.map(artist => artist.name).join(', ');
  
  // Update album cover
  if (track.album.images.length > 0) {
    const img = document.createElement('img');
    img.src = track.album.images[0].url;
    img.alt = 'Album cover';
    elements.albumCover.innerHTML = '';
    elements.albumCover.appendChild(img);
  }
}

// Update connection status
function updateStatus(message, type) {
  elements.connectionStatus.textContent = message;
  elements.connectionStatus.className = `status status--${type}`;
}

// Handle page visibility change
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    sliderPaused = true;
    stopAutoSlide();
  } else if (CONFIG.slider.autoSlide && !sliderPaused) {
    sliderPaused = false;
    startAutoSlide();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  updateSlider();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  stopAutoSlide();
  if (spotifyPlayer) {
    spotifyPlayer.disconnect();
  }
});

// Check if CLIENT_ID needs to be configured
if (CONFIG.spotify.clientId === 'TU_SPOTIFY_CLIENT_ID') {
  console.warn('⚠️ Configura tu SPOTIFY_CLIENT_ID en el archivo app.js');
  updateStatus('Configura tu Spotify Client ID', 'warning');
}

// Export for debugging
window.musicApp = {
  CONFIG,
  spotifyPlayer,
  changeSlide,
  goToSlide,
  togglePlayback,
  updateStatus
};